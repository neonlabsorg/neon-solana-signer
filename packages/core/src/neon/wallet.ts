import { JsonRpcProvider, keccak256, TransactionRequest, Wallet } from 'ethers';
import { Keypair, PublicKey } from '@solana/web3.js';
import { HexString } from '../models';

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
    console.log(privateKey, walletSigner);
    const result = await walletSigner.signTransaction(transaction);
    console.log(result);
    return result;
  } catch (e) {
    console.log(e);
  }
  return ``;
}
