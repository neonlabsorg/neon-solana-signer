import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SendOptions,
  Signer,
  Transaction,
  TransactionSignature
} from '@solana/web3.js';
import { solanaTransactionLog } from '@neonevm/token-transfer-core';
import { delay } from '../utils';

export function toSigner({ publicKey, secretKey }: Keypair): Signer {
  return { publicKey, secretKey };
}

export async function sendSolanaTransaction(connection: Connection, transaction: Transaction, signers: Signer[],
                                            confirm = false, options?: SendOptions): Promise<TransactionSignature> {
  transaction.sign(...signers);
  solanaTransactionLog(transaction);
  const signature = await connection.sendRawTransaction(transaction.serialize(), options);
  if (confirm) {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
  }
  return signature;
}

export async function requestAirdrop(connection: Connection, publicKey: PublicKey, lamports: number): Promise<number> {
  let balance = await connection.getBalance(publicKey);
  if (balance < 1e4) {
    await connection.requestAirdrop(publicKey, lamports);
    await delay(3e3);
    balance = await connection.getBalance(publicKey);
  }
  console.log(`${publicKey.toBase58()} balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  return balance;
}
