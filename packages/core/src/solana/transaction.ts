import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SendOptions, Signer, Transaction } from '@solana/web3.js';
import { solanaTransactionLog } from '@neonevm/token-transfer-core';
import { delay } from '../utils';
import { SolanaTransactionSignature } from '../models';

export function toSigner({ publicKey, secretKey }: Keypair): Signer {
  return { publicKey, secretKey };
}

export async function sendSolanaTransaction(connection: Connection, transaction: Transaction, signers: Signer[],
                                            confirm = false, options?: SendOptions, name = ''): Promise<SolanaTransactionSignature> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.sign(...signers);
  solanaTransactionLog(transaction);
  const signature = await connection.sendRawTransaction(transaction.serialize(), options);
  if (confirm) {
    await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
  }
  console.log(`Transaction${name ? ` ${name}` : ''} signature: ${signature}`);
  console.log(`https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=http://localhost:8899`);
  return { signature, blockhash, lastValidBlockHeight };
}

export async function solanaAirdrop(connection: Connection, publicKey: PublicKey, lamports: number): Promise<number> {
  let balance = await connection.getBalance(publicKey);
  if (balance < 1e9) {
    await connection.requestAirdrop(publicKey, lamports);
    await delay(3e3);
    balance = await connection.getBalance(publicKey);
  }
  console.log(`${publicKey.toBase58()} balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  return balance;
}
