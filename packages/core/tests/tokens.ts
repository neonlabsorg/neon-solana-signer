// todo improve to import from @neonevm/solana-contracts
// copy from packages/contracts/build/token-list.ts
// the token-list.ts build when deployed scripts/deployer.ts

import { NEON_TOKEN_MINT_DECIMALS, SPLToken } from '@neonevm/token-transfer-core';

export const usdt: SPLToken = {
  chainId: 112,
  address_spl: 'EtLzKp1gUfHNiEZyrUTusvYuaBqbbgtosSXVkAcZoNS2',
  address: '0x283a8F40c7bEe9EE8C36e9C4Dc0A1040597AD722',
  decimals: 6,
  name: 'USDT',
  symbol: 'USDT',
  logoURI: 'https://raw.githubusercontent.com/neonlabsorg/token-list/master/assets/tether-usdt-logo.svg'
};
export const usdc: SPLToken = {
  chainId: 112,
  address_spl: 'AQtwkFgKis3J7gwjAExJ5SceYzDZDndzE8HceLLtJ8wV',
  address: '0x4Ba8768e6e1234c7cbF0972dfF0bb97eeA4B3280',
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
