import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SendOptions, Signer, Transaction } from '@solana/web3.js';
import { solanaTransactionLog } from '@neonevm/token-transfer-core';
import { JsonRpcProvider, Wallet } from 'ethers';
import { delay, FaucetDropper } from '../utils';
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
  if (balance < lamports) {
    await connection.requestAirdrop(publicKey, lamports);
    await delay(3e3);
    balance = await connection.getBalance(publicKey);
  }
  console.log(`${publicKey.toBase58()} balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  return balance;
}

export async function neonAirdrop(provider: JsonRpcProvider, faucet: FaucetDropper, wallet: Wallet, amount: number): Promise<bigint> {
  let balance = await provider.getBalance(wallet.address);
  if (balance < BigInt(amount * (10 ** 18))) {
    await faucet.requestNeon(wallet.address, 100);
    await delay(4e3);
    return neonAirdrop(provider, faucet, wallet, amount);
  }
  console.log(`${wallet.address} balance: ${balance} NEON`);
  return balance;
}
