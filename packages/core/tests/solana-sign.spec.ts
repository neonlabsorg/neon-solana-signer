import { beforeAll, describe, expect, it } from '@jest/globals';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { JsonRpcProvider, Wallet } from 'ethers';
import { GasToken, getGasToken, getProxyState, NeonEVMChainId, NeonProxyRpcApi } from '@neonevm/solana-sign';
import { config } from 'dotenv';
import bs58 from 'bs58';

config({ path: '.env' });

const NEON_EVM_DEVNET_URL = process.env.NEON_EVM_DEVNET_URL!;
const SOLANA_DEVNET_URL = process.env.SOLANA_DEVNET_URL!;
const SOLANA_WALLET = bs58.decode(process.env.SOLANA_WALLET!);
const NEON_WALLET = process.env.NEON_WALLET!;

let solanaWallet: Keypair;
let neonWallet: Wallet;
let connection: Connection;
let neonProxyRpcApi: NeonProxyRpcApi;
let provider: JsonRpcProvider;
let neonEvmProgram: PublicKey;
let gasToken: GasToken;


beforeAll(async () => {
  const result = await getProxyState(NEON_EVM_DEVNET_URL);
  const token = getGasToken(result.tokensList, NeonEVMChainId.devnet);
  connection = new Connection(SOLANA_DEVNET_URL, 'confirmed');
  provider = new JsonRpcProvider(NEON_EVM_DEVNET_URL!);
  neonProxyRpcApi = result.proxyApi;
  neonEvmProgram = result.evmProgramAddress;
  solanaWallet = Keypair.fromSecretKey(SOLANA_WALLET);
  neonWallet = new Wallet(NEON_WALLET, provider);
  gasToken = token.gasToken;
});

describe('Check Neon data', () => {
  it(`Should request`, async () => {
    const params = await neonProxyRpcApi.evmParams();
    console.log(params);
    const account = await neonProxyRpcApi.getAccount();
    console.log(JSON.stringify(account));
    expect(params).toBe(true);
  });
});
