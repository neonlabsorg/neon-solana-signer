import { Contract, JsonRpcProvider } from 'ethers';
import { Connection } from '@solana/web3.js';
import {
  buildDeployerTransaction,
  compileSolidityContract,
  erc20ForSplAbi,
  erc20ForSplFactoryAbi,
  getContractAddressByData,
  getContractDeployerAddress,
  recoverTransaction,
  writeToFile
} from '@neonevm/solana-contracts';
import { HexString, hexToBuffer } from '@neonevm/solana-sign';
import { SPLToken } from '@neonevm/token-transfer-core';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { fetchDigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi-public-keys';
import bs58 from 'bs58';
import { basename, join } from 'path';
import { readFileSync } from 'fs';

const networks = [{
  name: `LocalNet`,
  proxyUrl: `http://195.201.36.140:9090/solana/neon`,
  solanaUrl: `http://195.201.36.140:8899`
}, {
  name: `DevNet`,
  proxyUrl: `https://devnet.neonevm.org`,
  solanaUrl: `https://api.devnet.solana.com`
}, {
  name: `MainNet`,
  proxyUrl: `https://neon-proxy-mainnet.solana.p2p.org`,
  solanaUrl: `https://endp.neonpass.live/yLnJ5aDbssvdo5vBshOn`
}];

// @ts-ignore
const contractPath = join(process.cwd(), 'src/data/contracts', 'ERC20ForSplFactory.bin');
// const { bytecode } = compileContract(contractPath);
const bytecode = readContract(contractPath);

function readContract(filePath: string): HexString {
  return readFileSync(filePath, 'utf8');
}

function compileContract(filePath: string): { abi: string, bytecode: HexString } {
  const name = basename(filePath);
  const content = readFileSync(filePath, { encoding: 'utf-8' });
  const contract = compileSolidityContract(name, content);
  const bytecode = contract.evm.bytecode.object;
  const abi = contract.abi;
  return { abi, bytecode };
}

async function contractAddress(provider: JsonRpcProvider, chainId: number, contractData: string): Promise<string> {
  const deployerTransaction = buildDeployerTransaction(chainId, false);
  const sender = recoverTransaction(deployerTransaction);
  const deployer = getContractDeployerAddress(sender, 0);
  const contractAddress = getContractAddressByData(deployer, contractData);
  const contractCode = await provider.getCode(contractAddress);
  if (contractCode === '0x') {
    throw new Error(`Contract doesn't deployed, please deploy contract`);
  }
  return contractAddress;
}

async function tokenList(provider: JsonRpcProvider, connection: Connection, erc20ForSplFactory: HexString, chainId: number): Promise<SPLToken[]> {
  const tokens: SPLToken[] = [];
  const contract = new Contract(erc20ForSplFactory, erc20ForSplFactoryAbi, provider);
  const umi = createUmi(connection.rpcEndpoint);
  const tokensLength = await contract.allErc20ForSplLength();
  for (let i = 0; i < Number(tokensLength); i++) {
    const address = await contract.allErc20ForSpl(i);
    console.log(`Extract data for token: ${address}`);
    const tokenContract = new Contract(address, erc20ForSplAbi, provider);
    const tokenMint = await tokenContract.tokenMint();
    const address_spl = bs58.encode(hexToBuffer(tokenMint));
    const asset = await fetchDigitalAsset(umi, publicKey(address_spl));
    const { decimals } = asset.mint;
    const { uri: logoURI, name, symbol } = asset.metadata;
    const splToken: SPLToken = { address, address_spl, chainId, decimals, logoURI, name, symbol };
    console.log(`${splToken.name}`, splToken);
    tokens.push(splToken);
  }
  return tokens;
}

async function init(): Promise<void> {
  for (const network of networks) {
    const provider = new JsonRpcProvider(network.proxyUrl);
    const connection = new Connection(network.solanaUrl);
    const { chainId: chainIdB } = await provider.getNetwork();
    const chainId = Number(chainIdB);
    console.log(`Extract tokens from ${network.name}: ${chainId}`);
    const erc20ForSplFactory = await contractAddress(provider, chainId, bytecode);
    const tokens = await tokenList(provider, connection, erc20ForSplFactory, chainId);
    writeToFile(`${chainId}.json`, JSON.stringify(tokens, null, 2));
    console.log(`Extracted tokens for ${network.name}: ${chainId}: ${tokens.length}st`);
    console.log(`--------------------------------------------------------------------`);
  }
}

init();
