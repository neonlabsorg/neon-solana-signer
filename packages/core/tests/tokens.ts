// todo improve to import from @neonevm/solana-contracts
// copy from packages/contracts/build/token-list.ts
// the token-list.ts build when deployed scripts/deployer.ts

import { NEON_TOKEN_MINT_DECIMALS, SPLToken } from '@neonevm/token-transfer-core';

export const usdt: SPLToken = {
  chainId: 112,
  address_spl: 'HMCqaKRaaRcG1BaPhMuwAdbXc6JQzhy1PFmwVS5o3oVh',
  address: '0x579915762C5DF797B99a160FEa16761b429508eC',
  decimals: 6,
  name: 'USDT',
  symbol: 'USDT',
  logoURI: 'https://raw.githubusercontent.com/neonlabsorg/token-list/master/assets/tether-usdt-logo.svg'
};
export const usdc: SPLToken = {
  chainId: 112,
  address_spl: 'Fo8iKAx6nqqpx7P3nk2hCqAjnevyT53uCqWiKmb4Sp1h',
  address: '0x932554318a538d42067CD4f9d0Fb61dFb80AA97a',
  decimals: 6,
  name: 'USDC',
  symbol: 'USDC',
  logoURI: 'https://raw.githubusercontent.com/neonlabsorg/token-list/master/assets/tether-usdt-logo.svg'
};

export const erc20Tokens: SPLToken[] = [usdt, usdc];

export const wNEON: SPLToken = {
  chainId: 111,
  address_spl: '',
  address: '0x5ddf708fcf2b9d6619c8801d4f7380ff3cee8f40',
  decimals: 18,
  name: 'Wrapped Neon',
  symbol: 'wNEON',
  logoURI: 'https://raw.githubusercontent.com/neonlabsorg/token-list/master/assets/wrapped-neon-logo.svg'
};

export const NEON: SPLToken = {
  chainId: 111,
  address_spl: '',
  address: '',
  decimals: NEON_TOKEN_MINT_DECIMALS,
  name: 'Neon',
  symbol: 'NEON',
  logoURI: 'https://raw.githubusercontent.com/neonlabsorg/token-list/main/neon_token_md.png'
};

export const NEON_TRANSFER_CONTRACT_TESTNET = `0xb16664cb5f5f5e1380029d6636dc5410ad501cf7`;
