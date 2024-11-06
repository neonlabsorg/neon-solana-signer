import { PublicKey } from '@solana/web3.js';

export interface GasToken {
  tokenName: string;
  tokenMint: string;
  tokenChainId: `0x${string}`;
}

export interface GasTokenData {
  tokenMintAddress: PublicKey;
  gasToken: GasToken;
}
