import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
  createBalanceAccountInstruction,
  createScheduledNeonEvmTransaction,
  NeonClientApi,
  NeonProxyRpcApi,
  ScheduledTransaction,
  solanaAirdrop,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import {
  GasToken,
  NEON_STATUS_DEVNET_SNAPSHOT,
  NEON_TOKEN_MINT_DEVNET,
  NeonProgramStatus
} from '@neonevm/token-transfer-core';
import { JsonRpcProvider, toBeHex } from 'ethers';

import { BaseContract, CHAIN_ID, NEON_CORE_API_RPC_URL, NEON_CORE_API_URL, SOLANA_URL } from './utils';

const networkUrls = [{
  id: 111,
  token: 'NEON',
  solana: SOLANA_URL,
  neonProxy: NEON_CORE_API_RPC_URL,
  neonApi: NEON_CORE_API_URL
}, {
  id: 112,
  token: 'SOL',
  solana: SOLANA_URL,
  neonProxy: NEON_CORE_API_RPC_URL,
  //neonProxy: `${NEON_CORE_API_RPC_URL}/sol`,
  neonApi: NEON_CORE_API_URL
}];

function SolanaNativeApp() {
  const [chainId] = useState<any>(CHAIN_ID);
  const [proxyStatus, setProxyStatus] = useState<NeonProgramStatus>(NEON_STATUS_DEVNET_SNAPSHOT);
  const [gasTokens, setGasTokens] = useState<GasToken[]>([]);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [responseLog, setResponseLog] = useState<string>('');

  // connect solana/neon networks
  const networkUrl = useMemo(() => {
    const id = networkUrls.findIndex(i => i.id === chainId);
    return id > -1 ? networkUrls[id] : networkUrls[0];
  }, [chainId]);
  const connection = useMemo(() => {
    console.log(networkUrl.solana);
    return new Connection(networkUrl.solana, 'confirmed');
  }, [networkUrl]);

  const solanaProvider = useMemo(() => {
    return new PhantomWalletAdapter();
  }, [connection]);

  const ethersProvider: any = useMemo(() => {
    return new JsonRpcProvider(networkUrl.neonProxy);
  }, [networkUrl]);

  const proxyRpcApi = useMemo(() => {
    return new NeonProxyRpcApi(networkUrl.neonProxy);
  }, [networkUrl]);

  const proxyClientApi = useMemo(() => {
    return new NeonClientApi(networkUrl.neonApi);
  }, [networkUrl]);

  const neonEvmProgram = useMemo(() => {
    if (proxyStatus) {
      return new PublicKey(proxyStatus?.neonEvmProgramId!);
    }
    return new PublicKey(NEON_STATUS_DEVNET_SNAPSHOT.neonEvmProgramId);
  }, [proxyStatus]);

  const chainTokenMint = useMemo(() => {
    const id = gasTokens.findIndex(i => parseInt(i.tokenChainId, 16) === chainId);
    if (id > -1) {
      return new PublicKey(gasTokens[id].tokenMint);
    }
    return new PublicKey(NEON_TOKEN_MINT_DEVNET);
  }, [gasTokens, chainId]);

  const solanaUser = useMemo(() => {
    if (publicKey) {
      return new SolanaNeonAccount(publicKey, neonEvmProgram, chainTokenMint, chainId);
    }
    return null;
  }, [publicKey]);

  const getProxyStatus = useCallback(async () => {
    const proxyStatus = await proxyRpcApi.evmParams();
    const gasTokens = await proxyRpcApi.nativeTokenList();
    // @ts-ignore
    setProxyStatus(proxyStatus);
    setGasTokens(gasTokens);
  }, [proxyRpcApi]);

  const handleConnect = useCallback(async () => {
    if (!solanaProvider.connected && !solanaProvider.connecting) {
      await solanaProvider.connect();
      if (solanaProvider.publicKey) {
        setPublicKey(solanaProvider.publicKey);
        await solanaAirdrop(connection, solanaProvider.publicKey, 21e9);
      }
    } else {
      await solanaProvider.disconnect();
      setPublicKey(null);
    }
    setResponseLog('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solanaProvider, publicKey]);

  const handleTransaction = useCallback(async () => {
    setResponseLog('');
    if (publicKey && solanaUser) {
      setLoading(true);
      const baseContract = new BaseContract();
      let nonce = Number(await proxyRpcApi.getTransactionCount(solanaUser.neonWallet));
      let account = await connection.getAccountInfo(solanaUser.balanceAddress);

      // remove this finch
      if (account !== null) {
        const balanceNonce = solanaUser.nonce(account);
        nonce = balanceNonce > nonce ? balanceNonce : nonce;
      }

      const maxFeePerGas = 0x77359400;
      console.log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

      const scheduledTransaction = new ScheduledTransaction({
        nonce: nonce > 0 ? toBeHex(nonce) : '0x',
        payer: solanaUser.neonWallet,
        target: baseContract.address,
        callData: baseContract.transactionData(solanaUser.publicKey),
        maxFeePerGas: toBeHex(maxFeePerGas),
        chainId: toBeHex(112)
      });

      const createScheduledTransaction = await createScheduledNeonEvmTransaction({
        chainId,
        signerAddress: solanaUser.publicKey,
        tokenMintAddress: solanaUser.tokenMint,
        neonEvmProgram,
        neonWallet: solanaUser.neonWallet,
        neonWalletNonce: nonce,
        neonTransaction: scheduledTransaction.serialize()
      });

      const treasuryPool = createScheduledTransaction.instructions[0].keys[2].pubkey;
      await solanaAirdrop(connection, treasuryPool, 21e9);

      try {
        if (account === null) {
          createScheduledTransaction.instructions.unshift(createBalanceAccountInstruction(neonEvmProgram, solanaUser.publicKey, solanaUser.neonWallet, solanaUser.chainId));
        }

        createScheduledTransaction.feePayer = publicKey;
        createScheduledTransaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        const signedTransaction = await solanaProvider.signTransaction(createScheduledTransaction);
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), { skipPreflight: false });
        console.log(`Solana signature: ${signature}`);
        const [transaction] = await proxyClientApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 5e3);
        const { transaction_hash, result_hash } = transaction;
        console.log(`Scheduled transaction result`, transaction);
        console.log(await proxyRpcApi.getTransactionReceipt(`0x${transaction_hash}`));
        console.log(await proxyRpcApi.getTransactionReceipt(`0x${result_hash}`));
        setResponseLog(JSON.stringify(transaction, null, '  '));
      } catch (e: unknown) {
        console.log(e);
        setResponseLog(JSON.stringify(e, null, '  '));
      }
    }
    setLoading(false);
  }, [publicKey, neonEvmProgram, connection]);

  const showWallet = useMemo(() => {
    if (solanaProvider.connected) {
      const publicKey = solanaProvider.publicKey?.toBase58();
      return publicKey ? `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}` : `Loading...`;
    }
    if (solanaProvider.connecting) {
      return `Connecting...`;
    }
    return `Connect wallet`;
  }, [publicKey]);

  const sendText = useMemo(() => {
    return loading ? `Wait...` : `Send scheduled transaction`;
  }, [loading]);

  const disabled = useMemo(() => {
    return !publicKey;
  }, [publicKey]);

  useEffect(() => {
    getProxyStatus();
  }, [getProxyStatus]);

  return (
    <div className="form-content">
      <h1 className="title-1">
        <i className="logo"></i>
        <div className="flex flex-row items-center justify-between w-full">
          <span className="text-[18px]">Solana native</span>
        </div>
        <a
          href="https://github.com/neonlabsorg/neon-solana-signer/tree/main/packages/ui"
          target="_blank" rel="noreferrer">
          <i className="github"></i>
        </a>
      </h1>
      <form className="form mb-[20px]">
        <button type="button" className="form-button" onClick={handleConnect}>{showWallet}</button>
        <button type="button" className="form-button" onClick={handleTransaction} disabled={disabled || loading}>
          {sendText}
        </button>
      </form>
      {responseLog && <div className="result-log">{responseLog}</div>}
    </div>
  );
}

export default SolanaNativeApp;
