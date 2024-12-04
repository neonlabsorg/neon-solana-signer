import { PublicKey, TransactionSignature } from '@solana/web3.js';
import { HexString, NeonAddress } from './api';

export interface CreateScheduledTransactionInstructionData {
  neonEvmProgram: PublicKey;
  signerAddress: PublicKey;
  balanceAddress: PublicKey;
  treeAccountAddress: PublicKey;
  associatedTokenAddress: PublicKey;
  neonTransaction: HexString;
}

export interface CreateScheduledTransactionData {
  chainId: number;
  signerAddress: PublicKey;
  tokenMintAddress: PublicKey;
  neonWallet: NeonAddress;
  neonWalletNonce: number;
  neonEvmProgram: PublicKey;
  neonTransaction: HexString;
}

export interface SkipScheduledTransactionData {
  neonEvmProgram: PublicKey;
  signerAddress: PublicKey;
  holderAccount: PublicKey;
  treeAccountAddress: PublicKey;
  transactionIndex: number;
}

export interface DestroyScheduledTransactionData {
  neonEvmProgram: PublicKey;
  signerAddress: PublicKey;
  balanceAddress: PublicKey;
  treeAccountAddress: PublicKey;
}

export interface FinishScheduledTransactionData {
  neonEvmProgram: PublicKey;
  signerAddress: PublicKey;
  balanceAddress: PublicKey;
  holderAddress: PublicKey;
  treeAccountAddress: PublicKey;
}

export const enum AccountSeedTag {
  SeedVersion = 0x03
}

export const enum InstructionTag {
  HolderCreate = 0x24,
  HolderDelete = 0x25,
  HolderWrite = 0x26,
  CreateMainTreasury = 0x29,
  AccountBalanceCreate = 0x30,
  Deposit = 0x31,
  TransactionExecuteFromInstruction = 0x3D,
  TransactionExecuteFromAccount = 0x33,
  TransactionStepFromInstruction = 0x34,
  TransactionStepFromAccount = 0x35,
  TransactionStepFromAccountNoChainid = 0x36,
  Cancel = 0x37,
  TransactionExecuteFromInstructionWithSolanaCall = 0x3E,
  TransactionExecuteFromAccountWithSolanaCall = 0x39,
}

export const enum OperatorBalanceTag {
  Create = 0x3A,
  Delete = 0x3B,
  Withdraw = 0x3C,
}

export const enum ScheduledTransactionTag {
  StartFromAccount = 0x46,
  StartFromInstruction = 0x47,
  Skip = 0x48,
  Finish = 0x49,
  Create = 0x4A,
  CreateMultiple = 0x4B,
  Destroy = 0x4C,
}

export interface SolanaTransactionSignature {
  signature: TransactionSignature;
  blockhash?: string;
  lastValidBlockHeight?: number;
}
