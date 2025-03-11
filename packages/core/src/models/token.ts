import { PublicKey } from '@solana/web3.js';
import { SolanaAddress } from './api';

export interface GasToken {
  tokenName: string;
  tokenMint: SolanaAddress;
  tokenChainId: `0x${string}`;
}

export interface GasTokenData {
  tokenMintAddress: PublicKey;
  gasToken: GasToken;
}
