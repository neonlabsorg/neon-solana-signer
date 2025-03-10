import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  ScheduledTransaction
} from '@neonevm/solana-sign';
import {
  CounterContract,
  createAndSendScheduledTransaction,
  estimateFee
} from './utils';
import { useProxyContext } from './contexts/Proxy.tsx';

function SolanaNativeSimpleTransaction() {
  const { publicKey, signTransaction } = useWallet();
  const {
    solanaUser,
    proxyRpcApi,
    chainId,
    neonEvmProgram,
    connection,
    provider
  } = useProxyContext();

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [responseLog, setResponseLog] = useState<string>('');
  const [count, setCount] = useState<number>(0);

  const counterContract = useMemo(() => {
    return new CounterContract(provider);
  }, [provider]);

  const getCount = useCallback(async () => {
    const counter = await counterContract.getCount();
    setCount(counter);
  }, [counterContract]);

  useEffect(() => {
    if(provider) {
      getCount();
    }
  }, [provider, getCount]);

  const handleTransaction = useCallback(async (action: string) => {
    setResponseLog('');
    if (publicKey && solanaUser && signTransaction) {
      setLoadingAction(action);
      const nonce = Number(await proxyRpcApi.getTransactionCount(solanaUser.neonWallet));
      //Encodes the data for a transaction that calls specified function
      const data = counterContract.transactionData(action);

      const { maxPriorityFeePerGas, gasLimit, maxFeePerGas } = await estimateFee(proxyRpcApi, solanaUser, data, counterContract.address);

      const scheduledTransaction = new ScheduledTransaction({
        nonce: nonce,
        payer: solanaUser.neonWallet,
        target: counterContract.address,
        callData: data,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
        gasLimit: gasLimit[0],
        chainId: chainId //Important! Use only SOL chain ID: 245022927 for devnet or 112 for local development
      });

      try {
        const txLog = await createAndSendScheduledTransaction({
          chainId,
          scheduledTransaction,
          neonEvmProgram,
          proxyRpcApi,
          solanaUser,
          nonce,
          connection,
          signMethod: signTransaction
        });
        setResponseLog(txLog);
        await getCount();
      } catch (e: unknown) {
        console.log(e);
        setResponseLog(JSON.stringify(e, null, '  '));
      }
    }
    setLoadingAction(null);
  }, [counterContract, getCount, chainId, solanaUser, proxyRpcApi, publicKey, signTransaction, neonEvmProgram, connection]);

  const getButtonText = useCallback((action: string) => {
    return loadingAction === action ? 'Wait...' : `Send ${action} transaction`;
  }, [loadingAction]);

  const disabled = useMemo(() => {
    return !publicKey;
  }, [publicKey]);

  return (
    <div className="tab-content">
      <form className="form mb-[20px]">
        <div className="form-label pb-4">
          <label>Current count: <span className='font-bold text-xl'>{count}</span></label>
        </div>
        <button type="button" className="form-button" onClick={() => handleTransaction('increase')} disabled={disabled || !!loadingAction}>
          {getButtonText('increase')}
        </button>
        <button type="button" className="form-button" onClick={() => handleTransaction('clear')} disabled={disabled || !!loadingAction || count === 0 }>
          {getButtonText('clear')}
        </button>
      </form>
      {responseLog && <div className="result-log">{responseLog}</div>}
    </div>
  );
}

export default SolanaNativeSimpleTransaction;
