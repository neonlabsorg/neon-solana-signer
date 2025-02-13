import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  createBalanceAccountInstruction,
  createScheduledNeonEvmTransaction,
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
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { JsonRpcProvider } from 'ethers';
import './App.css'

import { BaseContract, CHAIN_ID, NEON_CORE_API_RPC_URL, SOLANA_URL } from './utils';

function SolanaNativeApp() {
  const [chainId, setChainId] = useState<number>(CHAIN_ID);
  const [proxyStatus, setProxyStatus] = useState<NeonProgramStatus>(NEON_STATUS_DEVNET_SNAPSHOT);
  const [gasTokens, setGasTokens] = useState<GasToken[]>([]);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [responseLog, setResponseLog] = useState<string>('');

  const connection = useMemo<Connection>(() => {
    return new Connection(SOLANA_URL, 'confirmed');
  }, []);

  const provider = useMemo<JsonRpcProvider>(() => {
    return  new JsonRpcProvider(NEON_CORE_API_RPC_URL);
  }, []);

  const solanaProvider = useMemo<PhantomWalletAdapter>(() => {
    return new PhantomWalletAdapter();
  }, []);

  const proxyRpcApi = useMemo(() => {
    return new NeonProxyRpcApi(NEON_CORE_API_RPC_URL);
  }, []);

  const neonEvmProgram = useMemo<PublicKey>(() => {
    if (proxyStatus) {
      return new PublicKey(proxyStatus?.neonEvmProgramId);
    }
    return new PublicKey(NEON_STATUS_DEVNET_SNAPSHOT.neonEvmProgramId);
  }, [proxyStatus]);

  const chainTokenMint = useMemo<PublicKey>(() => {
    const id = gasTokens.findIndex(i => parseInt(i.tokenChainId, 16) === chainId);
    if (id > -1) {
      return new PublicKey(gasTokens[id].tokenMint);
    }
    return new PublicKey(NEON_TOKEN_MINT_DEVNET);
  }, [gasTokens, chainId]);

  const getProxyStatus = useCallback(async () => {
    const proxyStatus = await proxyRpcApi.evmParams();
    const gasTokens = await proxyRpcApi.nativeTokenList();
    console.log(`Proxy status: ${JSON.stringify(proxyStatus)},\n\nGas tokens: ${JSON.stringify(gasTokens)}`);
    setProxyStatus(proxyStatus);
    setGasTokens(gasTokens);
  }, [proxyRpcApi]);

  const initData = useCallback(async () => {
    try {
      const chainId = Number((await provider.getNetwork())?.chainId);
      console.log(`CHAIN ID: ${chainId}`);
      setChainId(chainId);
      getProxyStatus();
    } catch (err) {
      console.error('Can\'t fetch chain ID: ', err);
    }
  }, [provider]);

  //Get all necessary proxy data
  useEffect(() => {
    initData();
  }, []);

  const solanaUser = useMemo(() => {
    if (!publicKey) return null;
    return new SolanaNeonAccount(publicKey, neonEvmProgram, chainTokenMint, chainId);
  }, [publicKey, neonEvmProgram, chainTokenMint, chainId]);

  const handleConnect = useCallback(async () => {
    if (!solanaProvider.connected && !solanaProvider.connecting) {
      await solanaProvider.connect();
      if (solanaProvider.publicKey) {
        setPublicKey(solanaProvider.publicKey);
        try{
          console.log("Solana Airdrop");
          await solanaAirdrop(connection, solanaProvider.publicKey, 1e9);
        } catch (e) {
          console.error('Can\'t airdrop SOL: ', e);
        }
      }
    } else {
      await solanaProvider.disconnect();
      setPublicKey(null);
    }
    setResponseLog('');
  }, [connection, solanaProvider]);

  const handleTransaction = useCallback(async () => {
    setResponseLog('');
    if (publicKey && solanaUser) {
      setLoading(true);
      const baseContract = new BaseContract();
      const nonce = Number(await proxyRpcApi.getTransactionCount(solanaUser.neonWallet));
      const account = await connection.getAccountInfo(solanaUser.balanceAddress);
      console.log('Balance account: ', account);

      const maxFeePerGas = 0x77359400;
      console.log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

      const scheduledTransaction = new ScheduledTransaction({
        nonce: nonce,
        payer: solanaUser.neonWallet,
        target: baseContract.address,
        callData: baseContract.transactionData(solanaUser.publicKey),
        maxFeePerGas: maxFeePerGas,
        chainId: chainId //Important! Use only SOL chain ID: 245022927 for devnet or 112 for local development
      });

      const createScheduledTransaction = createScheduledNeonEvmTransaction({
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
        if (!account) {
          createScheduledTransaction.instructions.unshift(createBalanceAccountInstruction(neonEvmProgram, solanaUser.publicKey, solanaUser.neonWallet, solanaUser.chainId));
        }

        createScheduledTransaction.feePayer = publicKey;
        createScheduledTransaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        const signedTransaction = await solanaProvider.signTransaction(createScheduledTransaction);
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), { skipPreflight: false });
        console.log(`Solana signature: ${signature}`);

        const transactions = await proxyRpcApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 7e3);
        console.log(`Scheduled transactions result`, transactions);
        for (const transaction of transactions) {
          const { transactionHash } = transaction;
          const { result } = await proxyRpcApi.getTransactionReceipt(transactionHash);
          console.log(result);
          console.log(await proxyRpcApi.getTransactionReceipt(transactionHash));
          setResponseLog(JSON.stringify(transaction, null, '  '));
        }
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

  return (
    <div className="form-content">
      <h1 className="title-1">
        <i className="logo"></i>
        <div className="flex flex-row items-center justify-between w-full">
          <span className="text-[24px]">Solana native</span>
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
