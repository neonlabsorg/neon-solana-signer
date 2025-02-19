import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  createBalanceAccountInstruction,
  createScheduledNeonEvmTransaction,
  NeonProxyRpcApi,
  ScheduledTransaction,
  solanaAirdrop,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import {
  authAccountAddress,
  GasToken,
  NEON_STATUS_DEVNET_SNAPSHOT,
  NEON_TOKEN_MINT_DEVNET,
  NeonProgramStatus,
  toFullAmount
} from '@neonevm/token-transfer-core';
import { claimTransactionData, mintNeonTransactionData } from '@neonevm/token-transfer-ethers';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { JsonRpcProvider } from 'ethers';
import { createApproveInstruction, getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Big } from 'big.js';
import './App.css';
import { TokenBalance, TransferDirection } from './models';
import {
  BaseContract,
  balanceView,
  BIG_ZERO,
  CHAIN_ID,
  mintTokenBalanceEthers,
  NEON_CORE_API_RPC_URL,
  neonBalanceEthers,
  SOLANA_URL,
  sendSolanaTransaction,
  solanaBalance,
  splTokenBalance,
  tokenList,
  getOrCreateAssociatedTokenAccount,
  estimateFee,
  createAndSendScheduledTransaction
} from './utils';

function SolanaNativeApp() {
  const [token, setToken] = useState<string>('');
  const [chainId, setChainId] = useState<number>(CHAIN_ID as number);
  const [proxyStatus, setProxyStatus] = useState<NeonProgramStatus>(NEON_STATUS_DEVNET_SNAPSHOT);
  const [gasTokens, setGasTokens] = useState<GasToken[]>([]);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [responseLog, setResponseLog] = useState<string>('');
  const [amount, setAmount] = useState<string>('0.1');
  const [submitDisable, setSubmitDisable] = useState<boolean>(false);
  const [transactionLog, setTransactionLog] = useState<string>('');

  const splToken = useMemo(() => {
    return tokenList.find(i => i.symbol === token);
  }, [token]);

  const provider = useMemo<JsonRpcProvider>(() => {
    return new JsonRpcProvider(NEON_CORE_API_RPC_URL);
  }, []);

  const connection = useMemo<Connection>(() => {
    return new Connection(SOLANA_URL, 'confirmed');
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

  const [tokenBalance, setTokenBalance] = useState<TokenBalance>({
    neon: BIG_ZERO,
    solana: BIG_ZERO
  });

  const [walletBalance, setWalletBalance] = useState<TokenBalance>({
    neon: BIG_ZERO,
    solana: BIG_ZERO
  });

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

  const neonWallet = useMemo(() => {
    return solanaUser?.neonWallet;
  }, [solanaUser]);

  const [transfer, setTransfer] = useState<TransferDirection>({
    direction: 'solana',
    from: solanaProvider.publicKey?.toBase58() || '',
    to: neonWallet || ''
  });

  useEffect(() => {
    setTransfer(prevTransfer => ({
      ...prevTransfer,
      from: solanaProvider.publicKey?.toBase58() || '',
      to: neonWallet || ''
    }));
  }, [solanaProvider.publicKey, neonWallet]);

  const handleConnect = useCallback(async () => {
    if (!solanaProvider.connected && !solanaProvider.connecting) {
      await solanaProvider.connect();
      if (solanaProvider.publicKey) {
        setPublicKey(solanaProvider.publicKey);
        try {
          console.log('Solana Airdrop');
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

      const data = baseContract.transactionData(solanaUser.publicKey);

      const { result } = await proxyRpcApi.estimateScheduledGas({
        scheduledSolanaPayer: solanaUser.publicKey.toBase58(),
        transactions: [{
          from: solanaUser.neonWallet,
          to: baseContract.address,
          data: data
        }]
      });
      console.log('Estimated scheduled gas: ', result);
      const maxFeePerGas = result?.maxFeePerGas || 0x77359400;
      console.log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

      const scheduledTransaction = new ScheduledTransaction({
        nonce: nonce,
        payer: solanaUser.neonWallet,
        target: baseContract.address,
        callData: data,
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
    return loading ? `Wait...` : `Send simple scheduled transaction`;
  }, [loading]);

  const disabled = useMemo(() => {
    return !publicKey;
  }, [publicKey]);

  const transferDisabled = useMemo(() => {
    const balance = tokenBalance[transfer.direction];
    return !publicKey || !neonWallet || !token || submitDisable || balance.lt(new Big(amount));
  }, [publicKey, token, submitDisable, neonWallet, tokenBalance, transfer.direction, amount]);

  const handleTransferDirection = (): void => {
    setTransactionLog('');
    const isSolanaDirection = transfer.direction === 'solana';
    const changeDirection: TransferDirection = {
      direction: isSolanaDirection ? 'neon' : 'solana',
      from: isSolanaDirection ? neonWallet : (solanaProvider.publicKey?.toBase58() || ''),
      to: isSolanaDirection ? (solanaProvider.publicKey?.toBase58() || '') : neonWallet
    };
    setTransfer(changeDirection);
  };

  const handleAmount = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setAmount(event.target.value);
    setTransactionLog('');
  }, []);

  const handleSelect = useCallback((event: React.ChangeEvent<HTMLSelectElement>): void => {
    setToken(event.target.value);
    setTransactionLog('');
  }, []);

  //TODO: refactor
  const directionBalance = useCallback((position: 'from' | 'to'): string => {
    const evmToken = `SOL NeonEVM`;
    const solana = `SOL Solana`;
    switch (position) {
      case 'from': {
        const token = transfer.direction === 'solana' ? solana : evmToken;
        return `${new Big(walletBalance[transfer.direction].toString()).toFixed(3)} ${token}`;
      }
      case 'to': {
        const to = transfer.direction === 'solana' ? 'neon' : 'solana';
        const token = transfer.direction === 'solana' ? evmToken : solana;
        return `${new Big(walletBalance[to].toString()).toFixed(3)} ${token}`;
      }
    }
  }, [walletBalance, transfer.direction]);

  //TODO: refactor
  const amountView = useCallback(() => {
    const balance = new Big(tokenBalance[transfer.direction].toString());
    return `${balance.gt(0) ? balance.toFixed(3) : ''}${splToken?.symbol ? ` ${splToken.symbol}` : ''}`;
  }, [tokenBalance, transfer.direction, splToken]);

  const getTokenBalance = useCallback(async () => {
    if (splToken && neonWallet) {
      const solana = await splTokenBalance(connection, publicKey!, splToken);
      const neon = await mintTokenBalanceEthers(neonWallet, splToken, provider);
      setTokenBalance(prevBalance => ({
        ...prevBalance,
        solana: new Big(solana.amount).div(Math.pow(10, solana.decimals)),
        neon
      }))
    }
  }, [splToken, connection, neonWallet, publicKey, provider]);

  const getWalletBalance = useCallback(async () => {
    if(neonWallet) {
      const solana = await solanaBalance(connection, publicKey!);
      const neon = await neonBalanceEthers(provider, neonWallet);
      setWalletBalance(() => ({ solana, neon }));
    }
  }, [provider, publicKey, connection, neonWallet]);

  useEffect(() => {
    if (publicKey) {
      getTokenBalance();
      getWalletBalance();
    }
  }, [getTokenBalance, getWalletBalance, splToken, publicKey]);

  const handleSubmit = useCallback(async () => {
    if (token && splToken && solanaUser) {
      setSubmitDisable(true);
      if (transfer.direction === 'solana') {
        try {
          console.log(`Transfer ${amount} ${token} from Solana to Neon EVM`);
          const fromATA = getAssociatedTokenAddressSync(new PublicKey(splToken.address_spl), solanaUser.publicKey);
          const tokenAmount = toFullAmount(amount, splToken.decimals);
          const climeToData = claimTransactionData(fromATA, solanaUser.neonWallet, tokenAmount);
          const nonce = Number(await proxyRpcApi.getTransactionCount(solanaUser.neonWallet));

          //Approve for climeTo
          const transaction = new Transaction();
          const [delegatePDA] = authAccountAddress(solanaUser.neonWallet, neonEvmProgram, splToken);
          const approveInstruction = createApproveInstruction(fromATA, delegatePDA, solanaUser.publicKey, tokenAmount);
          transaction.instructions.push(approveInstruction);
          const signature = await sendSolanaTransaction(connection, transaction, solanaProvider, true);
          console.log(`Solana signature: ${signature}`);

          const { maxPriorityFeePerGas, gasLimit, maxFeePerGas } = await estimateFee(proxyRpcApi, solanaUser, climeToData, splToken.address);
          const scheduledTransaction = new ScheduledTransaction({
            nonce: nonce,
            payer: solanaUser.neonWallet,
            target: splToken.address,
            callData: climeToData,
            maxFeePerGas: maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
            gasLimit: gasLimit,
            chainId: chainId
          });

          const txLog = await createAndSendScheduledTransaction({
            chainId,
            scheduledTransaction,
            neonEvmProgram,
            proxyRpcApi,
            solanaUser,
            nonce,
            connection,
            solanaProvider
          });
          setTransactionLog(txLog);
        } catch (e) {
          setTransactionLog(`Transfer ${amount} ${token} from Solana to Neon EVM failed due to: \n${e}`);
        }
      } else {
        try {
          console.log(`Transfer ${amount} ${token} from Neon EVM to Solana`);
          await getOrCreateAssociatedTokenAccount(connection, solanaProvider, splToken);
          const balance = await mintTokenBalanceEthers(solanaUser.neonWallet, splToken, provider);
          console.log(`Token balance: ${balance} ${splToken.symbol}`);

          const associatedToken = getAssociatedTokenAddressSync(new PublicKey(splToken.address_spl), solanaUser.publicKey);
          const account = await getAccount(connection, associatedToken);
          if (account) {
            console.log(`Token balance: ${balanceView(account.amount, splToken.decimals)}  ${splToken.symbol}`);
          }
          const data = mintNeonTransactionData(associatedToken, splToken, amount);

          const nonce = Number(await proxyRpcApi.getTransactionCount(solanaUser.neonWallet));

          const { maxPriorityFeePerGas, gasLimit, maxFeePerGas } = await estimateFee(proxyRpcApi, solanaUser, data, splToken.address);

          const scheduledTransaction = new ScheduledTransaction({
            nonce: nonce,
            payer: solanaUser.neonWallet,
            index: 0,
            target: splToken.address,
            callData: data,
            maxFeePerGas: maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
            gasLimit: gasLimit,
            chainId: chainId
          });

          console.log(scheduledTransaction.data);

          const txLog = await createAndSendScheduledTransaction({
            chainId,
            scheduledTransaction,
            neonEvmProgram,
            proxyRpcApi,
            solanaUser,
            nonce,
            connection,
            solanaProvider
          });
          setTransactionLog(txLog);
        } catch (e) {
          setTransactionLog(`Transfer ${amount} ${token} from Neon EVM to Solana failed due to: \n${e}`);
        }
      }
      setSubmitDisable(false);
      await getTokenBalance();
      await getWalletBalance();
    }
  }, [provider, getTokenBalance, getWalletBalance, chainId, amount, connection, neonEvmProgram, proxyRpcApi, transfer.direction, token, splToken, solanaUser, solanaProvider]);

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
      <h1 className="title-1 mt-12">Token transfer</h1>
      <form className="form mb-[20px]">
        <div className="flex flex-row gap-[8px] items-end mb-[18px]">
          <div>
            <label htmlFor="select" className="form-label flax flex-row justify-between">
              <span>From</span>
              <span>({directionBalance('from')})</span>
            </label>
            <input value={transfer.from} className="form-input" disabled={true}></input>
          </div>
          <div>
            <button className="icon-button" type="button"
                    onClick={handleTransferDirection}></button>
          </div>
          <div>
            <label htmlFor="select" className="form-label flax flex-row justify-between">
              <span>To</span>
              <span>({directionBalance('to')})</span>
            </label>
            <input value={transfer.to} className="form-input" disabled={true}></input>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="select" className="form-label">Select token</label>
          <select value={token} onChange={handleSelect} className="form-select"
                  disabled={submitDisable}>
            <option value="" disabled={true}>Select Token</option>
            {tokenList.map((i, k) =>
              <option value={i.symbol} key={k}>{i.name} ({i.symbol})</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="select" className="form-label flex flex-row justify-between">
            <span>Amount</span>
            <span>{amountView()}</span>
          </label>
          <input value={amount} onInput={handleAmount} className="form-input" placeholder="0"
                 disabled={true}></input>
        </div>
        <button type="button" className="form-button" onClick={handleSubmit} disabled={transferDisabled}>
          Submit
        </button>
      </form>
      { transactionLog && <div className="result-log">{transactionLog}</div> }
    </div>
  );
}

export default SolanaNativeApp;
