import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync
} from '@solana/spl-token';
import {
  AccountInfo,
  Connection,
  PublicKey,
  Transaction
} from '@solana/web3.js';
import { SPLToken } from '@neonevm/token-transfer-core';
import { sendSolanaTransaction } from './transfer';

export async function getOrCreateAssociatedTokenAccount(connection: Connection, signMethod: any, solanaWallet: PublicKey, token: SPLToken): Promise<AccountInfo<Buffer>> {
  const tokenMint = new PublicKey(token.address_spl);
  const tokenAccount = getAssociatedTokenAddressSync(tokenMint, solanaWallet);
  let account = await connection.getAccountInfo(tokenAccount);
  if (!account) {
    const transaction = new Transaction();
    transaction.add(createAssociatedTokenAccountInstruction(solanaWallet, tokenAccount, solanaWallet, tokenMint));
    transaction.recentBlockhash = (await connection.getLatestBlockhash('finalized')).blockhash;
    const signature = await sendSolanaTransaction(connection, transaction, signMethod, solanaWallet, true);
    account = await connection.getAccountInfo(tokenAccount);
    console.log(`Token Account created`, signature);
  }
  return account!;
}
