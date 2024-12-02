import { HexString } from '@neonevm/solana-sign';
import { neonWrapperContract } from '@neonevm/token-transfer-ethers';
import { neonWrapperAbi } from '@neonevm/token-transfer-core';
import { PublicKey } from '@solana/web3.js';
import { Interface } from 'ethers';
import { readFileSync } from 'fs';
import { join } from 'path';
import { contractAddressByHash } from './deploySytemContract';
import { neonTokenContractHash, wNeonTokenContractHash } from '../data';

export class BaseContract {
  address: HexString;

  transactionData(publicKey: PublicKey) {
    return neonWrapperContract().encodeFunctionData('withdraw', [publicKey.toBuffer()]);
  }

  constructor(chainId: number) {
    this.address = contractAddressByHash(chainId, neonTokenContractHash);
    new Interface(neonWrapperAbi);
  }
}

export class DeployContract {
  address: HexString;

  get data(): HexString {
    const contractPath = join(process.cwd(), '../contracts/src/data/contracts', 'WNEON.bin');
    return `0x${readFileSync(contractPath, 'utf8')}`;
  }

  constructor(chainId: number) {
    this.address = contractAddressByHash(chainId, wNeonTokenContractHash);
  }
}
