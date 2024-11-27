import { beforeAll, describe, expect, it } from '@jest/globals';
import { NEON_TRANSFER_CONTRACT_DEVNET, NEON_TRANSFER_CONTRACT_MAINNET } from '@neonevm/token-transfer-core';
import { contractAddressByData, neonTokenContractHash } from '@neonevm/solana-contracts';
import { JsonRpcProvider, keccak256 } from 'ethers';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

config({ path: '.env' });

let neonTokenContractCode: string;

beforeAll(async () => {
  const contractPath = join(process.cwd(), 'src/data/contracts', 'NeonToken.bin');
  neonTokenContractCode = readFileSync(contractPath, 'utf8');
});

describe('Check addresses for deployed contracts', () => {
  it(`Check neon transfer contract for devnet Neon EVM`, async () => {
    const provider = new JsonRpcProvider(`https://devnet.neonevm.org`);
    const { chainId } = await provider.getNetwork();
    const contractAddress = contractAddressByData(Number(chainId), neonTokenContractCode);
    expect(contractAddress).toBe(NEON_TRANSFER_CONTRACT_DEVNET);
  });

  it(`Check neon transfer contract for mainnet Neon EVM`, async () => {
    const provider = new JsonRpcProvider(`https://neon-proxy-mainnet.solana.p2p.org`);
    const { chainId } = await provider.getNetwork();
    const contractAddress = contractAddressByData(Number(chainId), neonTokenContractCode);
    expect(contractAddress.toLowerCase()).toBe(NEON_TRANSFER_CONTRACT_MAINNET.toLowerCase());
  });

  it(`Check that contract data contain same code hashes`, async () => {
    expect(neonTokenContractHash).toBe(keccak256(`0x${neonTokenContractCode}`));
  });
});
