import { Connection, Commitment, Transaction, PublicKey } from '@solana/web3.js';
import {
  ScheduledTransactionStatus,
  createScheduledNeonEvmTransaction,
  NeonProxyRpcApi,
  SolanaNeonAccount,
  ScheduledTransaction,
  PreparatorySolanaTransaction
} from '@neonevm/solana-sign';
import { Big } from 'big.js';
import { CreateScheduledTransactionParams } from '../models';
import { delay } from './delay.ts';


export async function sendSolanaTransaction(connection: Connection, transaction: Transaction, signTransaction: any, feePayer: PublicKey, confirm = false, commitment: Commitment = 'finalized'): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.feePayer = feePayer;
  transaction.recentBlockhash = blockhash;
  const signedTransaction = await signTransaction(transaction);
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

export async function estimateFee(proxyRpcApi: NeonProxyRpcApi, solanaUser: SolanaNeonAccount, transactionData: string, toAddress: string, preparatorySolanaTransactions?: PreparatorySolanaTransaction[]): Promise<{
  maxFeePerGas: number;
  maxPriorityFeePerGas: number;
  gasLimit: number[];
}> {
  const { maxPriorityFeePerGas: maxPriorityFee, maxFeePerGas: maxFee } = await proxyRpcApi.getMaxFeePerGas();
  const { result, error } = await proxyRpcApi.estimateScheduledGas({
    scheduledSolanaPayer: solanaUser.publicKey.toBase58(),
    transactions: [{
      from: solanaUser.neonWallet,
      to: toAddress,
      data: transactionData
    }],
    preparatorySolanaTransactions
  });
  if(error) {
    console.error('Error estimateScheduledGas: ', error);
  }
  console.log(`Max fee per Gas: ${result} \n${maxPriorityFee} \n${maxFee}`);

  const maxFeePerGas = parseInt(result?.maxFeePerGas, 16) || maxFee;
  const maxPriorityFeePerGas = parseInt(result?.maxPriorityFeePerGas, 16) || maxPriorityFee;
  const gasLimit = result?.gasList.map(i => parseInt(i, 16)) || [1e7];
  return { maxFeePerGas, maxPriorityFeePerGas, gasLimit }
}

export async function createAndSendScheduledTransaction({ chainId, scheduledTransaction, neonEvmProgram, proxyRpcApi, solanaUser, nonce, connection, signMethod, approveInstruction }: CreateScheduledTransactionParams): Promise<string> {
  const createScheduledTransaction = createScheduledNeonEvmTransaction({
    chainId: chainId,
    signerAddress: solanaUser.publicKey,
    tokenMintAddress: solanaUser.tokenMint,
    neonEvmProgram: neonEvmProgram,
    neonWallet: solanaUser.neonWallet,
    neonWalletNonce: nonce,
    neonTransaction: scheduledTransaction.serialize()
  });

  if (approveInstruction) createScheduledTransaction.instructions.unshift(approveInstruction);

  const scheduledTransactionSignature = await sendSolanaTransaction(connection, createScheduledTransaction, signMethod, solanaUser.publicKey, true);
  console.log(`Scheduled tx signature: ${scheduledTransactionSignature} \nhttps://explorer.solana.com/tx/${scheduledTransactionSignature}?cluster=devnet`);

  const transactions = await proxyRpcApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 3e5);
  return scheduledTransactionsLog(transactions);
}

export async function sendMultipleScheduledTransaction(transaction: Transaction, transactions: ScheduledTransaction[], { proxyRpcApi, solanaUser, connection, signMethod }: Omit<CreateScheduledTransactionParams, 'nonce' | 'chainId' | 'scheduledTransaction' | 'neonEvmProgram'>): Promise<string> {
  const scheduledTransactionSignature = await sendSolanaTransaction(connection, transaction, signMethod, solanaUser.publicKey, true);
  console.log(`Scheduled tx signature: ${scheduledTransactionSignature} \nhttps://explorer.solana.com/tx/${scheduledTransactionSignature}?cluster=devnet`);
  const results = [];
  for (const transaction of transactions) {
    results.push(proxyRpcApi.sendRawScheduledTransaction(`0x${transaction.serialize()}`));
  }
  const resultsHash = await Promise.all(results);
  await delay(3e3);
  return resultsHash ? resultsHash.map(({ result }) => {
    return `transactionHash: ${result} <br> check transaction status on: <a href="https://devnet.neonscan.org/tx/${result}" target="_blank">neonscan</a>`;
  }).join('\n') : '';
}
