import { Connection, Transaction, PublicKey } from '@solana/web3.js';
import type { Commitment } from '@solana/web3.js';
import {
  createScheduledNeonEvmTransaction,
} from '@neonevm/solana-sign';
import type { ScheduledTransactionStatus } from '@neonevm/solana-sign';
import { Big } from 'big.js';
import type { CreateScheduledTransactionParams } from '@/models';


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
