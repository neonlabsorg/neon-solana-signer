import { PublicKey } from '@solana/web3.js';
import { GasToken, GasTokenData } from '../models';

export function getGasToken(tokenList: GasToken[], chainId: number): GasTokenData {
  const gasToken = tokenList.find(i => parseInt(i.tokenChainId, 16) === chainId)!;
  const tokenMintAddress = new PublicKey(gasToken.tokenMint);
  return { gasToken, tokenMintAddress };
}
