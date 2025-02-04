export const NEON_CHAIN_IDS: any[] = [
  { id: 111, name: 'neon_local' },
  { id: 112, name: 'sol_local' },
  { id: 245022926, name: 'devnet' },
  { id: 245022940, name: 'testnet' },
  { id: 245022934, name: 'mainnet-beta' }
];
export const CHAIN_NAME = 'sol_local';
export const CHAIN_ID = NEON_CHAIN_IDS.find(i => i.name === CHAIN_NAME)!.id;

export const SOLANA_URL = process.env['REACT_APP_SOLANA_URL']!;
export const NEON_CORE_API_RPC_URL = process.env['REACT_APP_NEON_CORE_API_RPC_URL']!;
export const SOLANA_SIGNER = process.env['REACT_APP_SOLANA_SIGNER']!;
