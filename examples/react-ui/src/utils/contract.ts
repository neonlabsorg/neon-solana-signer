import { HexString } from '@neonevm/solana-sign';
import { PublicKey } from '@solana/web3.js';
import { neonWrapperContract } from '@neonevm/token-transfer-ethers';
import { NEON_TRANSFER_CONTRACT_DEVNET, neonWrapperAbi } from '@neonevm/token-transfer-core';
import { Interface } from 'ethers';

export class BaseContract {
  address: HexString;

  transactionData(publicKey: PublicKey) {
    return neonWrapperContract().encodeFunctionData('withdraw', [publicKey.toBuffer()]);
  }

  constructor() {
    this.address = NEON_TRANSFER_CONTRACT_DEVNET;
    new Interface(neonWrapperAbi);
  }
}
