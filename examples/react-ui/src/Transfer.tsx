import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  ScheduledTransaction,
} from '@neonevm/solana-sign';
import {
  authAccountAddress,
  toFullAmount
} from '@neonevm/token-transfer-core';
import { claimTransactionData, mintNeonTransactionData } from '@neonevm/token-transfer-ethers';
import { createApproveInstruction, getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Big } from 'big.js';
import { TokenBalance, TransferDirection } from './models';
import {
  balanceView,
  BIG_ZERO,
  mintTokenBalanceEthers,
  neonBalanceEthers,
  sendSolanaTransaction,
  solanaBalance,
  splTokenBalance,
  tokenList,
  getOrCreateAssociatedTokenAccount,
  estimateFee,
  createAndSendScheduledTransaction
} from './utils';
import { FormInput } from './components/FormInput/FormInput.tsx';
import { FormSelect } from './components/FormSelect/FormSelect.tsx';
import { useProxyContext } from './contexts/Proxy.tsx';

function SolanaNativeTransferApp() {
  const { publicKey, signTransaction } = useWallet();
  const {
    solanaUser,
    proxyRpcApi,
    chainId,
    neonEvmProgram,
    provider,
    connection
  } = useProxyContext();
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [amount, setAmount] = useState<string>('0.1');
  const [submitDisable, setSubmitDisable] = useState<boolean>(false);
  const [log, setLog] = useState<string>('');

  const splToken = useMemo(() => {
    return tokenList.find(i => i.symbol === token);
  }, [token]);

  const [tokenBalance, setTokenBalance] = useState<TokenBalance>({
    neon: BIG_ZERO,
    solana: BIG_ZERO
  });

  const [walletBalance, setWalletBalance] = useState<TokenBalance>({
    neon: BIG_ZERO,
    solana: BIG_ZERO
  });

  const neonWallet = useMemo(() => {
    return solanaUser?.neonWallet;
  }, [solanaUser]);

  const [transfer, setTransfer] = useState<TransferDirection>({
    direction: 'solana',
    from: publicKey?.toBase58() || '',
    to: neonWallet || ''
  });

  useEffect(() => {
    setTransfer(prevTransfer => ({
      ...prevTransfer,
      from: publicKey?.toBase58() || '',
      to: neonWallet || ''
    }));
  }, [publicKey, neonWallet]);

  const transferDisabled = useMemo(() => {
    const balance = tokenBalance[transfer.direction];
    return !publicKey || !neonWallet || !token || submitDisable || balance.lt(new Big(amount));
  }, [publicKey, token, submitDisable, neonWallet, tokenBalance, transfer.direction, amount]);

  const handleTransferDirection = (): void => {
    setLog('');
    const isSolanaDirection = transfer.direction === 'solana';
    const changeDirection: TransferDirection = {
      direction: isSolanaDirection ? 'neon' : 'solana',
      from: isSolanaDirection ? neonWallet : (publicKey?.toBase58() || ''),
      to: isSolanaDirection ? (publicKey?.toBase58() || '') : neonWallet
    };
    setTransfer(changeDirection);
  };

  const handleAmount = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setAmount(event.target.value);
    setLog('');
  }, []);

  const handleSelect = useCallback((event: React.ChangeEvent<HTMLSelectElement>): void => {
    setToken(event.target.value);
    setLog('');
  }, []);

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
        solana,
        neon
      }))
      if(solana.eq(0) && transfer.direction === 'solana') setLog(`You need to have some ${splToken.symbol} on Solana`);
      if(neon.eq(0) && transfer.direction === 'neon') setLog(`You need to have some ${splToken.symbol} on Neon`);
    }
  }, [transfer.direction, splToken, connection, neonWallet, publicKey, provider]);

  const getWalletBalance = useCallback(async () => {
    if(neonWallet) {
      const solana = await solanaBalance(connection, publicKey!);
      const neon = await neonBalanceEthers(provider, neonWallet);
      setWalletBalance(() => ({ solana, neon }));
    }
  }, [provider, publicKey, connection, neonWallet]);

  const sendText = useMemo(() => {
    return loading ? `Wait...` : `Submit`;
  }, [loading]);

  useEffect(() => {
    if (publicKey) {
      getTokenBalance();
      getWalletBalance();
    }
  }, [getTokenBalance, getWalletBalance, splToken, publicKey]);

  const handleSubmit = useCallback(async () => {
    if (token && splToken && solanaUser) {
      setLoading(true);
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
          const signature = await sendSolanaTransaction(connection, transaction, signTransaction, solanaUser.publicKey, true);
          console.log(`Solana signature: ${signature}`);

          const { maxPriorityFeePerGas, gasLimit, maxFeePerGas } = await estimateFee(proxyRpcApi, solanaUser, climeToData, splToken.address);
          const scheduledTransaction = new ScheduledTransaction({
            nonce: nonce,
            payer: solanaUser.neonWallet,
            target: splToken.address,
            callData: climeToData,
            maxFeePerGas: maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
            gasLimit: gasLimit[0],
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
            signMethod: signTransaction!
          });
          setLog(txLog);
        } catch (e) {
          setLog(`Transfer ${amount} ${token} from Solana to Neon EVM failed due to: \n${e}`);
        }
      } else {
        try {
          console.log(`Transfer ${amount} ${token} from Neon EVM to Solana`);
          await getOrCreateAssociatedTokenAccount(connection, signTransaction, solanaUser.publicKey, splToken);
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
            gasLimit: gasLimit[0],
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
            signMethod: signTransaction!
          });
          setLog(txLog);
        } catch (e) {
          setLog(`Transfer ${amount} ${token} from Neon EVM to Solana failed due to: \n${e}`);
        }
      }
      setLoading(false);
      setSubmitDisable(false);
      await getTokenBalance();
      await getWalletBalance();
    }
  }, [provider, getTokenBalance, getWalletBalance, chainId, amount, connection, neonEvmProgram, proxyRpcApi, transfer.direction, token, splToken, solanaUser, signTransaction]);

  return (
    <div className="tab-content">
      <form className="form">
        <div className="flex flex-row gap-[8px] items-end mb-[18px]">
          <FormInput
            label="From"
            value={transfer.from!}
            disabled={true}
            rightLabel={`(${directionBalance('from')})`}
          />
          <div>
            <button className="icon-button" type="button"
                    onClick={handleTransferDirection}></button>
          </div>
          <FormInput
            label="To"
            value={transfer.to!}
            disabled={true}
            rightLabel={`(${directionBalance('to')})`}
          />
        </div>
        <FormSelect
          label="token"
          value={token}
          onChange={handleSelect}
          options={tokenList.map(i => ({
            value: i.symbol,
            label: `${i.name} (${i.symbol})`
          }))}
          disabled={submitDisable}
        />
        <FormInput
          label="Amount"
          value={amount}
          onInput={handleAmount}
          placeholder="0"
          disabled={true}
          rightLabel={amountView}
        />
        <button type="button" className="form-button mt-8" onClick={handleSubmit} disabled={transferDisabled}>
          {sendText}
        </button>
      </form>
      { log && <div className="result-log">{log}</div> }
    </div>
  );
}

export default SolanaNativeTransferApp;
