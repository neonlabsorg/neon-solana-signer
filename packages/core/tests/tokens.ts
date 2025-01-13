// todo improve to import from @neonevm/solana-contracts
// copy from packages/contracts/build/token-list.ts
// the token-list.ts build when deployed scripts/deployer.ts

import { NEON_TOKEN_MINT_DECIMALS, SPLToken } from '@neonevm/token-transfer-core';

export const usdt: SPLToken = {
  chainId: 112,
  address_spl: 'HLSej1xmZmvg9XtKq9fY4pyniBtqnDdELJsU2C3AbNAy',
  address: '0x659f09b99027E04acBF3A6dF454ffFC3e24FCF18',
  decimals: 6,
  name: 'USDT',
  symbol: 'USDT',
  logoURI: 'https://raw.githubusercontent.com/neonlabsorg/token-list/master/assets/tether-usdt-logo.svg'
};
export const usdc: SPLToken = {
  chainId: 112,
  address_spl: '8BmQaAfexB4XHbgzxnts1xT2MaafGvhENoH9Jyyqtzdr',
  address: '0x91061b6534e8806D3Eac21fe795aB5f153cE2C55',
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
