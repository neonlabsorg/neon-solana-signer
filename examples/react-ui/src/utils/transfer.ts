import { Connection, Commitment, Transaction } from '@solana/web3.js';
import { BaseMessageSignerWalletAdapter } from '@solana/wallet-adapter-base';
import {
  ScheduledTransactionStatus,
  createScheduledNeonEvmTransaction,
  EstimatedScheduledGasPayResponse,
  HexString,
  NeonProxyRpcApi,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { Big } from 'big.js';
import { CreateScheduledTransactionParams } from '../models';

function isBaseMessageSignerWalletAdapter(provider: any): provider is BaseMessageSignerWalletAdapter {
  return provider && typeof provider.signTransaction === 'function';
}

export async function sendSolanaTransaction<T extends BaseMessageSignerWalletAdapter>(connection: Connection, transaction: Transaction, provider: T, confirm = false, commitment: Commitment = 'finalized'): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.feePayer = provider.publicKey!;
  transaction.recentBlockhash = blockhash;
  const signedTransaction = isBaseMessageSignerWalletAdapter(provider) ? await provider.signTransaction(transaction) : transaction.sign(provider);
  const signature = await connection.sendRawTransaction(signedTransaction.serialize(), { skipPreflight: false });
  if(confirm) await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature }, commitment);
  return signature;
}

export function scheduledTransactionsLog(transactions: ScheduledTransactionStatus[]): string {
  const log = transactions.map(({ transactionHash, status, resultHash  }) => {
    return `transactionHash: ${transactionHash} \nstatus: ${status} \nresultHash: ${resultHash}`;
  }).join('\n');
  console.log(log);
  return log;
}

export function balanceView(amount: string | bigint | number, decimals: number): number {
  return (new Big(amount.toString()).div(Big(10).pow(decimals))).toNumber();
}

export async function estimateFee(proxyRpcApi: NeonProxyRpcApi, solanaUser: SolanaNeonAccount, transactionData: string, splTokenAddress: string): Promise<{
  maxFeePerGas: HexString;
  maxPriorityFeePerGas: HexString;
  gasLimit: HexString;
}> {
  const { result } = await proxyRpcApi.estimateScheduledGas({
    scheduledSolanaPayer: solanaUser.publicKey.toBase58(),
    transactions: [{
      from: solanaUser.neonWallet,
      to: splTokenAddress,
      data: transactionData
    }]
  });
  const { maxPriorityFeePerGas: priorityFee, maxFeePerGas: maxFee } = await proxyRpcApi.getMaxFeePerGas();
  console.log(`Max fee per Gas: ${result} \n${priorityFee} \n${maxFee}`);

  const maxFeePerGas = maxFee || result?.maxFeePerGas;
  const maxPriorityFeePerGas = priorityFee || result?.maxPriorityFeePerGas;
  const gasLimit = result?.gasList[0];
  return { maxFeePerGas, maxPriorityFeePerGas, gasLimit }
}

export async function createAndSendScheduledTransaction({ chainId, scheduledTransaction, neonEvmProgram, proxyRpcApi, solanaUser, nonce, connection, solanaProvider }: CreateScheduledTransactionParams): Promise<string> {
  //TODO: fix return type of createScheduledNeonEvmTransaction
  //@ts-ignore
  const createScheduledTransaction = createScheduledNeonEvmTransaction({
    chainId: chainId,
    signerAddress: solanaUser.publicKey,
    tokenMintAddress: solanaUser.tokenMint,
    neonEvmProgram: neonEvmProgram,
    neonWallet: solanaUser.neonWallet,
    neonWalletNonce: nonce,
    neonTransaction: scheduledTransaction.serialize()
  });

  //TODO: fix return type of createScheduledNeonEvmTransaction
  //@ts-ignore
  const scheduledTransactionSignature = await sendSolanaTransaction(connection, createScheduledTransaction, solanaProvider, true);
  console.log(`Scheduled tx signature: ${scheduledTransactionSignature} \nhttps://explorer.solana.com/tx/${scheduledTransactionSignature}?cluster=devnet`);

  const transactions = await proxyRpcApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 3e5);
  return scheduledTransactionsLog(transactions);
}
