import { Commitment, Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { SPLToken } from '@neonevm/token-transfer-core';
import { JsonRpcProvider } from 'ethers';
import { log } from './log';
import { delay } from './delay';
import { post } from './rest';

export class FaucetDropper {
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async requestERC20(wallet: string, address_spl: string, amount: number): Promise<any> {
    try {
      return post(`${this.url}/request_erc20`, { amount, wallet, address_spl });
    } catch (e) {
      return 0;
    }
  }

  async requestNeon(wallet: string, amount: number): Promise<any> {
    try {
      return await post(`${this.url}/request_neon`, { amount, wallet });
    } catch (e) {
      return 0;
    }
  }
}

export async function neonAirdrop(provider: JsonRpcProvider, faucet: FaucetDropper, wallet: string, amount: number, tokenName: string = 'NEON', decimals = 18): Promise<bigint> {
  let balance = await provider.getBalance(wallet);
  if (balance < BigInt(amount) * BigInt(10 ** decimals)) {
    const requestAmount = amount > 100 ? 100 : amount;
    await faucet.requestNeon(wallet, requestAmount);
    await delay(4e3);
    return neonAirdrop(provider, faucet, wallet, amount, tokenName, decimals);
  }
  log(`${wallet} balance: ${balance / BigInt(10 ** decimals)} ${tokenName}`);
  return balance;
}

export async function erc20Airdrop(provider: JsonRpcProvider, faucet: FaucetDropper, wallet: string, token: SPLToken, amount: number): Promise<bigint> {
  let balance = await provider.getBalance(wallet);
  if (balance < BigInt(amount) * BigInt(10 ** token.decimals)) {
    const requestAmount = amount > 100 ? 100 : amount;
    await faucet.requestERC20(wallet, token.address_spl, requestAmount);
    await delay(4e3);
    return neonAirdrop(provider, faucet, wallet, amount, token.symbol, token.decimals);
  }
  log(`${wallet} balance: ${balance / BigInt(10 ** token.decimals)} ${token.symbol}`);
  return balance;
}

export async function solanaAirdrop(connection: Connection, publicKey: PublicKey, lamports: number, commitment: Commitment = 'finalized'): Promise<number> {
  let balance = await connection.getBalance(publicKey);
  if (balance < lamports) {
    const signature = await connection.requestAirdrop(publicKey, lamports);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature }, commitment);
    balance = await connection.getBalance(publicKey);
  }
  log(`${publicKey.toBase58()} balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  return balance;
}
