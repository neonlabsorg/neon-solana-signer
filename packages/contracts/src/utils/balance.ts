import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { erc20Abi, NEON_TOKEN_MINT_DECIMALS, SPLToken } from '@neonevm/token-transfer-core';
import { Big } from 'big.js';
import {
  AccountInfo,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  Signer,
  TokenAmount,
  Transaction
} from '@solana/web3.js';
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { delay, NeonAddress, sendSolanaTransaction } from '@neonevm/solana-sign';

export async function mintTokenBalance(wallet: Wallet, token: SPLToken, contractAbi: any = erc20Abi, method = 'balanceOf'): Promise<number> {
  const tokenInstance = new Contract(token.address, contractAbi, wallet);
  if (tokenInstance[method]) {
    const balanceOf = tokenInstance[method];
    const balance: bigint = await balanceOf(wallet.address);

    return (new Big(balance.toString()).div(Big(10).pow(token.decimals))).toNumber();
  }
  return 0;
}

export function balanceView(amount: string | bigint | number, decimals: number): number {
  return (new Big(amount.toString()).div(Big(10).pow(decimals))).toNumber();
}

export async function tokenBalance(provider: JsonRpcProvider, address: NeonAddress, token: SPLToken, contractAbi: any = erc20Abi, method = 'balanceOf'): Promise<number> {
  const tokenInstance = new Contract(token.address, contractAbi, provider);
  if (tokenInstance[method]) {
    const balanceOf = tokenInstance[method];
    const balance: bigint = await balanceOf(address);
    return (new Big(balance.toString()).div(Big(10).pow(token.decimals))).toNumber();
  }
  return 0;
}

export async function solanaBalance(connection: Connection, address: PublicKey): Promise<Big> {
  const balance = await connection.getBalance(address);
  return new Big(balance).div(LAMPORTS_PER_SOL);
}

export async function neonBalance(provider: JsonRpcProvider, address: Wallet): Promise<Big> {
  const balance = await provider.getBalance(address);
  return new Big(balance.toString()).div(Big(10).pow(NEON_TOKEN_MINT_DECIMALS));
}

export async function splTokenBalance(connection: Connection, walletPubkey: PublicKey, token: SPLToken): Promise<TokenAmount | null> {
  const mintAccount = new PublicKey(token.address_spl);
  const assocTokenAccountAddress = getAssociatedTokenAddressSync(mintAccount, walletPubkey);
  const account = await connection?.getAccountInfo(assocTokenAccountAddress);
  if (!account) {
    return null;
  }
  const response = await connection?.getTokenAccountBalance(assocTokenAccountAddress);
  return response?.value;
}

export async function createAssociatedTokenAccount(connection: Connection, signer: Signer, token: SPLToken): Promise<AccountInfo<Buffer>> {
  const solanaWallet = signer.publicKey;
  const tokenMint = new PublicKey(token.address_spl);
  const tokenAccount = getAssociatedTokenAddressSync(tokenMint, solanaWallet);
  let account = await connection.getAccountInfo(tokenAccount);
  console.log(account?.owner);
  if (!account) {
    const transaction = new Transaction();
    transaction.add(createAssociatedTokenAccountInstruction(solanaWallet, tokenAccount, solanaWallet, tokenMint));
    transaction.recentBlockhash = (await connection.getLatestBlockhash('finalized')).blockhash;
    await sendSolanaTransaction(connection, transaction, [signer], true, { skipPreflight: false });
    await delay(2e3);
    account = await connection.getAccountInfo(tokenAccount);
  }
  return account!;
}
