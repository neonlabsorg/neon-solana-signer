import {
  delay,
  FaucetDropper,
  getGasToken,
  getProxyState,
  log,
  NeonAddress,
  neonAirdrop,
  NeonChainId,
  solanaAirdrop
} from '@neonevm/solana-sign';
import { DeploySystemContract, SplTokenDeployer, splTokensMock, writeToFile } from '@neonevm/solana-contracts';
import { SPLToken } from '@neonevm/token-transfer-core';
import { Connection, Keypair } from '@solana/web3.js';
import { JsonRpcProvider, Wallet } from 'ethers';
import { join } from 'path';
import { config } from 'dotenv';
import bs58 from 'bs58';

config({ path: '.env' });

// @ts-ignore
const env: { [key: string]: any } = process.env;
const NEON_API_RPC_URL = `${env.NEON_CORE_API_RPC_URL!}/neon`;
const NEON_GASLES_API_RPC_URL = `${env.NEON_GASLES_API_RPC_URL!}/neon`;
// const NEON_API_RPC_URL = `${env.NEON_CORE_API_RPC_URL!}/sol`;
// const NEON_GASLES_API_RPC_URL = `${env.NEON_GASLES_API_RPC_URL!}/sol`;
const SOLANA_URL = env.SOLANA_URL!;
const NEON_FAUCET_URL = env.NEON_FAUCET_URL!;
const NEON_WALLET = env.NEON_WALLET!;
const SOLANA_WALLET = bs58.decode(env.SOLANA_WALLET!);

const provider = new JsonRpcProvider(NEON_API_RPC_URL);
const gasLessProvider = new JsonRpcProvider(NEON_GASLES_API_RPC_URL);
const connection = new Connection(SOLANA_URL);
const faucet = new FaucetDropper(NEON_FAUCET_URL);
const neonWallet = new Wallet(NEON_WALLET, gasLessProvider);
const solanaWallet = Keypair.fromSecretKey(SOLANA_WALLET);

const deployer = new SplTokenDeployer(gasLessProvider, connection, neonWallet, solanaWallet);

export async function deploySplToken(token: SPLToken, factoryAddress: NeonAddress): Promise<SPLToken | null> {
  const customToken = await deployer.deploy(factoryAddress, token, 1e9);
  log(`Resource setup complete. SPLToken: `, customToken);
  return customToken;
}

export async function deploySplTokens(factoryAddress: NeonAddress, chainId: number, tokens: SPLToken[] = []): Promise<SPLToken[]> {
  for (const token of splTokensMock) {
    token.chainId = chainId;
    const result = await deploySplToken(token, factoryAddress);
    if (result) {
      tokens.push(result);
    }
    await delay(1e3);
  }
  return tokens;
}

(async () => {
  const { chainId } = await gasLessProvider.getNetwork();
  const proxyState = await getProxyState(NEON_API_RPC_URL);
  const token = getGasToken(proxyState.tokensList, NeonChainId.testnetSol);
  const deploySystemContract = new DeploySystemContract(gasLessProvider, Number(chainId));
  const result: string[] = [];
  let tokens: SPLToken[] = [];
  let SPL_TOKEN_FACTORY: NeonAddress;

  {
    log(`Init deployer`);
    const { chainId } = await gasLessProvider.getNetwork();
    const deploy = new DeploySystemContract(gasLessProvider, Number(chainId));
    await neonAirdrop(provider, faucet, deploy.sender, 100, token.gasToken.tokenName);
    await delay(3e3);
    await deploy.initDeployer();
    await solanaAirdrop(connection, solanaWallet.publicKey, 1e9);
    await neonAirdrop(provider, faucet, neonWallet.address, 100, token.gasToken.tokenName);
    await delay(3e3);
  }

  {
    log(`Deploy NeonToken.bin contract`);
    const contractPath = join(process.cwd(), 'src/data/contracts', 'NeonToken.bin');
    const contractData = deploySystemContract.readContract(contractPath);
    const address = await deploySystemContract.deployContract(contractData, neonWallet);
    result.push(`NEON_TRANSFER_CONTRACT_TESTNET=${address}`);
  }

  {
    log(`Compile and deploy ERC20ForSplFactory contract`);
    const contractPath = join(process.cwd(), 'src/data/contracts', 'ERC20ForSplFactory.sol');
    const { bytecode } = deploySystemContract.compileContract(contractPath);
    SPL_TOKEN_FACTORY = await deploySystemContract.deployContract(bytecode, neonWallet);
    result.push(`SPL_TOKEN_FACTORY=${SPL_TOKEN_FACTORY}`);
  }

  {
    log(`Deploy WNEON.bin contract`);
    const wNEON: Partial<SPLToken> = {
      chainId: Number(chainId),
      address: '',
      decimals: 18,
      name: 'Wrapped Neon',
      symbol: 'wNEON',
      logoURI: 'https://raw.githubusercontent.com/neonlabsorg/token-list/master/assets/wrapped-neon-logo.svg'
    };
    const contractPath = join(process.cwd(), 'src/data/contracts', 'WNEON.bin');
    const contractData = deploySystemContract.readContract(contractPath);
    const address = await deploySystemContract.deployContract(contractData, neonWallet);
    wNEON.address = address;
    tokens.push(wNEON as SPLToken);
  }

  /*  {
      log(`Deploy wSOL token`);
      const wSOL: SPLToken = {
        chainId: Number(chainId),
        address_spl: 'So11111111111111111111111111111111111111112',
        address: '',
        decimals: 9,
        name: 'Wrapped SOL',
        symbol: 'wSOL',
        logoURI: 'https://raw.githubusercontent.com/neonlabsorg/token-list/master/assets/solana-wsol-logo.svg'
      };
      const token = await deployer.deployMintedToken(SPL_TOKEN_FACTORY, wSOL);
      tokens.push(token);
    }*/

  tokens = await deploySplTokens(SPL_TOKEN_FACTORY, Number(chainId), tokens);

  writeToFile('environments.txt', result.join('\n'));
  writeToFile('token-list.json', JSON.stringify(tokens, null, 2));
  writeToFile('token-list.ts', `export const tokenList = ${JSON.stringify(tokens, null, 2)}`);
})();
