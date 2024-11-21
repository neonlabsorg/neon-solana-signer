import { SPLToken } from '@neonevm/token-transfer-core';
import { JsonRpcProvider, Wallet } from 'ethers';
import { Connection, Keypair } from '@solana/web3.js';
import { delay, FaucetDropper, neonAirdrop, solanaAirdrop } from '@neonevm/solana-sign';
import { config } from 'dotenv';
import bs58 from 'bs58';
import { deployFactory } from '../contracts';
import { ResourceForSpl, writeToFile } from '../utils';
import { splTokensMock } from '../data';

config({ path: '.env' });

// @ts-ignore
const env: { [key: string]: any } = process.env;

const NEON_API_RPC_URL = `${env.NEON_CORE_API_RPC_URL!}/neon`;
const SOLANA_URL = env.SOLANA_URL!;
const NEON_FAUCET_URL = env.NEON_FAUCET_URL!;
const SOLANA_WALLET = bs58.decode(env.SOLANA_WALLET!);
const NEON_WALLET = env.NEON_WALLET!;
const FACTORY_ADDRESS = env.FACTORY_ADDRESS!;

const provider = new JsonRpcProvider(NEON_API_RPC_URL);
const connection = new Connection(SOLANA_URL);
const faucet = new FaucetDropper(NEON_FAUCET_URL);
const solanaWallet = Keypair.fromSecretKey(SOLANA_WALLET);
const neonWallet = new Wallet(NEON_WALLET, provider);

const deployer = new ResourceForSpl(solanaWallet, neonWallet, provider, connection);

export async function tokenDeploy(token: SPLToken): Promise<SPLToken> {
  await solanaAirdrop(connection, solanaWallet.publicKey, 1e9);
  await neonAirdrop(provider, faucet, neonWallet.address, 500);

  const factoryAddress = FACTORY_ADDRESS || await deployFactory(neonWallet);
  console.log(`Factory address: ${factoryAddress}`);

  const customToken = await deployer.deployToken(factoryAddress, token, 1e9);
  console.log(`Resource setup complete. SPLToken: `, customToken);
  return customToken;
}

export async function setup(): Promise<void> {
  const tokens: SPLToken[] = [];
  for (const token of splTokensMock) {
    const result = await tokenDeploy(token);
    tokens.push(result);
    await delay(5e3);
  }

  writeToFile('token-list.json', JSON.stringify(tokens, null, '  '));
}

(async () => {
  await setup();
})();
