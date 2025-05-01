import { SPLToken } from '@neonevm/token-transfer-core';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { neonWalletProgramAddress, SolanaNeonAccount } from '@neonevm/solana-sign';
import { createApproveInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { parseUnits } from 'ethers';

export const usdc: SPLToken = {
  chainId: 245022926,
  address: '0xD6AE78Fd3E022AC6Bbc0fab385B4CD5924c480f7',
  address_spl: '4MymVAaQos56woWKnwJdBaKB1XTnQ397KE36WYAZ6qV6',
  name: 'USDC (v2 Demo)',
  symbol: 'USDC',
  decimals: 6,
  logoURI: 'https://raw.githubusercontent.com/neonlabsorg/token-list/master/assets/usd-coin-usdc-logo.svg'
};
export const wsol: SPLToken = {
  chainId: 245022926,
  address: '0x165D4788242D98786a1db0dA79953d35702eADEd',
  address_spl: 'ExYuMMxSy5P6Lhbay2TX1BCn5LJRqFnKwW5d6EQpPHS4',
  name: 'wSOL (v2 Demo)',
  symbol: 'wSOL',
  decimals: 9,
  logoURI: 'https://raw.githubusercontent.com/neonlabsorg/token-list/master/assets/solana-wsol-logo.svg'
};

export async function approveTokenV2Instruction(solanaUser: SolanaNeonAccount, neonEvmProgram: PublicKey, token: SPLToken, amount: number): Promise<TransactionInstruction> {
  const fullAmount = parseUnits(amount.toString(), token.decimals);
  const tokenATA = getAssociatedTokenAddressSync(new PublicKey(token.address_spl), solanaUser.publicKey);
  const [delegatePDA] = neonWalletProgramAddress(token.address, neonEvmProgram);
  return createApproveInstruction(tokenATA, delegatePDA, solanaUser.publicKey, fullAmount);
}
