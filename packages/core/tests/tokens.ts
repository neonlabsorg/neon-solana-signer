// todo improve to import from @neonevm/solana-contracts
// copy from packages/contracts/build/token-list.ts
// the token-list.ts build when deployed scripts/deployer.ts

import { NEON_TOKEN_MINT_DECIMALS, SPLToken } from '@neonevm/token-transfer-core';

export const usdt: SPLToken = {
  chainId: 112,
  address_spl: '4jFifrpHCABsXTrxMyZ48haUYGQ1B24Afc5e6hhqDr3s',
  address: '0x5Ef4736ccb0e08CAe66a4710FA8cDb78d561D6d3',
  decimals: 6,
  name: 'USDT',
  symbol: 'USDT',
  logoURI: 'https://raw.githubusercontent.com/neonlabsorg/token-list/master/assets/tether-usdt-logo.svg'
};
export const usdc: SPLToken = {
  chainId: 112,
  address_spl: 'ELpiQDfA6911fQykWJshd6bJcuwG9njTMHWv3fc6irUB',
  address: '0x166165dae95dE8650b75bC8e9c325CF1e151E871',
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
