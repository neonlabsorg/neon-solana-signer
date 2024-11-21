import { FaucetDropper } from '@neonevm/solana-sign';
import { JsonRpcProvider, Wallet } from 'ethers';
import { join } from 'path';
import { config } from 'dotenv';
import { deploySystemContract, initDeployer } from '../contracts';

config({ path: '.env' });

// @ts-ignore
const env: { [key: string]: any } = process.env;
const NEON_API_RPC_URL = `${env.NEON_CORE_API_RPC_URL!}/neon`;
const NEON_FAUCET_URL = env.NEON_FAUCET_URL!;
const NEON_WALLET = env.NEON_WALLET!;

const provider = new JsonRpcProvider(NEON_API_RPC_URL);
const faucet = new FaucetDropper(NEON_FAUCET_URL);
const wallet = new Wallet(NEON_WALLET, provider);

(async () => {
  await initDeployer(provider, true);
  const contractPath = join(process.cwd(), 'src/data/contracts', 'NeonToken.bin');
  await deploySystemContract(provider, wallet, contractPath);
})();
