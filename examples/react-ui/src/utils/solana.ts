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
import { BaseMessageSignerWalletAdapter } from '@solana/wallet-adapter-base';

export async function getOrCreateAssociatedTokenAccount(connection: Connection, signer: BaseMessageSignerWalletAdapter, token: SPLToken): Promise<AccountInfo<Buffer>> {
  const solanaWallet = signer.publicKey!;
  const tokenMint = new PublicKey(token.address_spl);
  const tokenAccount = getAssociatedTokenAddressSync(tokenMint, solanaWallet);
  let account = await connection.getAccountInfo(tokenAccount);
  if (!account) {
    const transaction = new Transaction();
    transaction.add(createAssociatedTokenAccountInstruction(solanaWallet, tokenAccount, solanaWallet, tokenMint));
    transaction.recentBlockhash = (await connection.getLatestBlockhash('finalized')).blockhash;
    const signature = await sendSolanaTransaction(connection, transaction, signer, true);
    account = await connection.getAccountInfo(tokenAccount);
    console.log(`Token Account created`, signature);
  }
  return account!;
}
