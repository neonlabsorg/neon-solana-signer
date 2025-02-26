import { SPLToken } from '@neonevm/token-transfer-core';
import { Big } from 'big.js';

export const NEON_CHAIN_IDS: Record<string, number | string>[] = [
  { id: 111, name: 'neon_local' },
  { id: 112, name: 'sol_local' },
  { id: 245022926, name: 'devnet' },
  { id: 245022940, name: 'testnet' },
  { id: 245022934, name: 'mainnet-beta' }
];
export const CHAIN_NAME = 'sol_local';
export const CHAIN_ID = NEON_CHAIN_IDS.find(i => i.name === CHAIN_NAME)!.id;

export const SOLANA_URL = import.meta.env.VITE_SOLANA_URL!;
export const NEON_CORE_API_RPC_URL = import.meta.env.VITE_NEON_CORE_API_RPC_URL!;
export const COUNTER_CONTRACT_ADDRESS = import.meta.env.VITE_COUNTER_CONTRACT_ADDRESS;

export const tokenList: SPLToken[] = [
  {
    "chainId": 245022926,
    "address_spl": "F4DgNXqiT3zUQA7dhqN5VzEPkRcd8vtqFwpJSwEEvnz5",
    "address": "0x512E48836Cd42F3eB6f50CEd9ffD81E0a7F15103",
    "decimals": 6,
    "name": "USDC",
    "symbol": "USDC",
    "logoURI": "https://raw.githubusercontent.com/neonlabsorg/token-list/master/assets/usd-coin-usdc-logo.svg"
  },
  {
    "chainId": 245022926,
    "address_spl": "3vxj94fSd3jrhaGAwaEKGDPEwn5Yqs81Ay5j1BcdMqSZ",
    "address": "0x6eEf939FC6e2B3F440dCbB72Ea81Cd63B5a519A5",
    "decimals": 6,
    "name": "USDT",
    "symbol": "USDT",
    "logoURI": "https://raw.githubusercontent.com/neonlabsorg/token-list/master/assets/tether-usdt-logo.svg"
  }
];

export const BIG_ZERO = new Big(0);
