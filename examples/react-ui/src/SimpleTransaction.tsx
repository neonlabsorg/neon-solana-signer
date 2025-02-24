import { useCallback, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  createBalanceAccountInstruction,
  createScheduledNeonEvmTransaction,
  ScheduledTransaction,
  solanaAirdrop,
} from '@neonevm/solana-sign';
import {
  BaseContract
} from './utils';
import { useProxyContext } from './contexts/Proxy.tsx';

function SolanaNativeSimpleTransaction() {
  const { publicKey, signTransaction } = useWallet();
  const {
    solanaUser,
    proxyRpcApi,
    chainId,
    neonEvmProgram,
    connection
  } = useProxyContext();

  const [loading, setLoading] = useState<boolean>(false);
  const [responseLog, setResponseLog] = useState<string>('');

  const handleTransaction = useCallback(async () => {
    setResponseLog('');
    if (publicKey && solanaUser && signTransaction) {
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
        const signedTransaction = await signTransaction(createScheduledTransaction);
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
  }, [chainId, solanaUser, proxyRpcApi, publicKey, signTransaction, neonEvmProgram, connection]);

  const sendText = useMemo(() => {
    return loading ? `Wait...` : `Send simple scheduled transaction`;
  }, [loading]);

  const disabled = useMemo(() => {
    return !publicKey;
  }, [publicKey]);

  return (
    <div className="tab-content">
      <form className="form mb-[20px]">
        <button type="button" className="form-button" onClick={handleTransaction} disabled={disabled || loading}>
          {sendText}
        </button>
      </form>
      {responseLog && <div className="result-log">{responseLog}</div>}
    </div>
  );
}

export default SolanaNativeSimpleTransaction;
