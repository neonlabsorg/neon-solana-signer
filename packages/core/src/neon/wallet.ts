import { JsonRpcProvider, keccak256, TransactionRequest, Wallet } from 'ethers';
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { HexString } from '../models';
import { log } from '../utils';

export function base58ToHex(mint: string): string {
  const bytes = bs58.decode(mint);
  const bytes32Value = Buffer.from(bytes);
  return `0x${bytes32Value.toString('hex')}`;
}

export function privateKeyFromWallet(solanaWallet: PublicKey, neonWallet: HexString): HexString {
  return keccak256(Buffer.from(`${neonWallet.slice(2)}${solanaWallet.toBase58()}`, 'utf-8'));
}

export function getTransactionReceipt(provider: JsonRpcProvider, transactionHash: HexString): Promise<any> {
  return provider.waitForTransaction(transactionHash);
}

export async function signNeonTransaction(provider: JsonRpcProvider, solanaWallet: Keypair, neonWallet: Wallet, transaction: TransactionRequest): Promise<HexString> {
  try {
    const privateKey = privateKeyFromWallet(solanaWallet.publicKey, neonWallet.address);
    const walletSigner = new Wallet(privateKey, provider);
    log(privateKey, walletSigner);
    const result = await walletSigner.signTransaction(transaction);
    log(result);
    return result;
  } catch (e) {
    log(e);
  }
  return ``;
}
