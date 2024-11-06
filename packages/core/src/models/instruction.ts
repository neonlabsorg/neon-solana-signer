import { Connection, PublicKey } from '@solana/web3.js';
import { HexString, NeonAddress } from './api';
import { TreasuryPoolAddress } from '../solana';

export interface CreateScheduledTransactionInstructionData {
  neonEvmProgram: PublicKey;
  signerAddress: PublicKey;
  balanceAddress: PublicKey;
  treeAccountAddress: PublicKey;
  associatedTokenAddress: PublicKey;
  neonTransaction: HexString;
  treasuryPool: TreasuryPoolAddress;
}

export interface CreateScheduledTransactionData {
  chainId: number;
  connection: Connection;
  signerAddress: PublicKey;
  neonWallet: NeonAddress;
  neonWalletNonce: number;
  neonEvmProgram: PublicKey;
  treasuryPoolCount: number;
  neonTransaction: HexString;
}

export const enum AccountAddress {
  SeedVersion = 0x03
}

export const enum ScheduledInstruction {
  START_FROM_ACCOUNT = 0x46,
  START_FROM_INSTRUCTION = 0x47,
  SKIP = 0x48,
  FINISH = 0x49,
  CREATE = 0x4A,
  CREATE_MULTIPLE = 0x4B,
  DESTROY = 0x4C,
}
