import { HexString } from '@neonevm/solana-sign';
import { neonWrapperContract } from '@neonevm/token-transfer-ethers';
import { neonWrapperAbi } from '@neonevm/token-transfer-core';
import { PublicKey } from '@solana/web3.js';
import { Interface } from 'ethers';
import { contractAddressByHash } from './deploySytemContract';
import { neonTokenContractHash } from '../data';

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
