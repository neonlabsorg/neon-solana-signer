import { AccountMeta, PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import {
  CreateScheduledTransactionInstructionData,
  DestroyScheduledTransactionData,
  FinishScheduledTransactionData,
  InstructionTag,
  NeonAddress,
  ScheduledTransactionTag,
  SkipScheduledTransactionData
} from '../models';
import {
  bufferConcat,
  hexToBuffer,
  NEON_TREASURY_POOL_COUNT,
  numberToBuffer,
  stringToBuffer,
  toBytes64LE
} from '../utils';
import { neonBalanceProgramAddressSync, neonWalletProgramAddress, TreasuryPoolAddress } from './account';

/**
 * Create a new scheduled transaction instruction
 * @param data {CreateScheduledTransactionInstructionData} The data for the instruction
 * @param data.neonEvmProgram {PublicKey} The program ID of the Neon EVM program
 * @param data.signerAddress {PublicKey} The signer address solana wallet public key
 * @param data.balanceAddress {PublicKey} The balance address public key - contain information about neon wallet
 * @param data.treeAccountAddress {PublicKey} The tree account address public key - contain information about scheduled transactions
 * @param data.associatedTokenAddress {PublicKey} The associated token address public key - token address that will used for fee payment
 * @param data.neonTransaction {HexString} The scheduled transaction hex string
 * @returns {TransactionInstruction}
 */
export function createScheduledTransactionInstruction(data: CreateScheduledTransactionInstructionData): TransactionInstruction {
  const {
    neonEvmProgram: programId,
    signerAddress,
    balanceAddress,
    treeAccountAddress,
    associatedTokenAddress,
    neonTransaction
  } = data;
  const treasuryPool = TreasuryPoolAddress.find(programId, NEON_TREASURY_POOL_COUNT);

  const keys: Array<AccountMeta> = [
    { pubkey: signerAddress, isSigner: true, isWritable: true },
    { pubkey: balanceAddress, isSigner: false, isWritable: true },
    { pubkey: treasuryPool.publicKey, isSigner: false, isWritable: true },
    { pubkey: treeAccountAddress, isSigner: false, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
  ];
  const type = numberToBuffer(ScheduledTransactionTag.Create);
  const count = treasuryPool.buffer;
  const transaction = hexToBuffer(neonTransaction);
  return new TransactionInstruction({ keys, programId, data: bufferConcat([type, count, transaction]) } as any);
}

/**
 * Create a solana transaction instruction for multiple transactions
 * @param data {CreateScheduledTransactionInstructionData} The data for the instruction
 * @param data.neonEvmProgram {PublicKey} The program ID of the Neon EVM program
 * @param data.signerAddress {PublicKey} The signer address solana wallet public key
 * @param data.balanceAddress {PublicKey} The balance address public key - contain information about neon wallet
 * @param data.treeAccountAddress {PublicKey} The tree account address public key - contain information about scheduled transactions
 * @param data.associatedTokenAddress {PublicKey} The associated token address public key - token address that will used for fee payment
 * @param data.neonTransaction {HexString} The multiple format scheduled transactions hex string
 * @returns {TransactionInstruction}
 */
export function createScheduledTransactionMultipleInstruction(data: CreateScheduledTransactionInstructionData): TransactionInstruction {
  const {
    neonEvmProgram: programId,
    signerAddress,
    balanceAddress,
    treeAccountAddress,
    associatedTokenAddress,
    neonTransaction
  } = data;
  const treasuryPool = TreasuryPoolAddress.find(programId, NEON_TREASURY_POOL_COUNT);

  const keys: Array<AccountMeta> = [
    { pubkey: signerAddress, isSigner: true, isWritable: true },
    { pubkey: balanceAddress, isSigner: false, isWritable: true },
    { pubkey: treasuryPool.publicKey, isSigner: false, isWritable: true },
    { pubkey: treeAccountAddress, isSigner: false, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
  ];
  const type = numberToBuffer(ScheduledTransactionTag.CreateMultiple);
  const count = treasuryPool.buffer;
  const transaction = hexToBuffer(neonTransaction);
  return new TransactionInstruction({ keys, programId, data: bufferConcat([type, count, transaction]) } as any);
}

export function finishScheduledTransactionInstruction(data: FinishScheduledTransactionData): TransactionInstruction {
  const { neonEvmProgram: programId, holderAddress, treeAccountAddress, signerAddress, balanceAddress } = data;
  const type = numberToBuffer(ScheduledTransactionTag.Finish);
  const keys: Array<AccountMeta> = [
    { pubkey: holderAddress, isSigner: false, isWritable: true },
    { pubkey: treeAccountAddress, isSigner: false, isWritable: true },
    { pubkey: signerAddress, isSigner: true, isWritable: true },
    { pubkey: balanceAddress, isSigner: false, isWritable: true }
  ];
  return new TransactionInstruction({ keys, programId, data: type });
}

export function skipScheduledTransactionInstruction(data: SkipScheduledTransactionData): TransactionInstruction {
  const { neonEvmProgram: programId, signerAddress, holderAccount, treeAccountAddress, transactionIndex } = data;
  const type = numberToBuffer(ScheduledTransactionTag.Skip);
  const index = numberToBuffer(transactionIndex);
  const keys: Array<AccountMeta> = [
    { pubkey: holderAccount, isSigner: false, isWritable: true },
    { pubkey: treeAccountAddress, isSigner: false, isWritable: true },
    { pubkey: signerAddress, isSigner: true, isWritable: true }
  ];
  return new TransactionInstruction({ keys, programId, data: bufferConcat([type, index]) });
}

export function destroyScheduledTransactionInstruction(data: DestroyScheduledTransactionData): TransactionInstruction {
  const { neonEvmProgram: programId, signerAddress, balanceAddress, treeAccountAddress } = data;
  const treasuryPool = TreasuryPoolAddress.find(programId, NEON_TREASURY_POOL_COUNT);
  const type = numberToBuffer(ScheduledTransactionTag.Destroy);
  const count = treasuryPool.buffer;
  const keys: Array<AccountMeta> = [
    { pubkey: balanceAddress, isSigner: false, isWritable: true },
    { pubkey: treasuryPool.publicKey, isSigner: false, isWritable: true },
    { pubkey: treeAccountAddress, isSigner: false, isWritable: true },
    { pubkey: signerAddress, isSigner: true, isWritable: true }
  ];
  return new TransactionInstruction({ keys, programId, data: bufferConcat([type, count]) });
}

/**
 * Create balance account instruction
 * @param neonEvmProgram {PublicKey} The program ID of the Neon EVM program
 * @param solanaWallet {PublicKey} The solana wallet public key
 * @param neonAddress {NeonAddress} The neon wallet address
 * @param chainId {number} The chain ID
 */
export function createBalanceAccountInstruction(neonEvmProgram: PublicKey, solanaWallet: PublicKey, neonAddress: NeonAddress, chainId: number): TransactionInstruction {
  const [balanceAddress] = neonBalanceProgramAddressSync(neonAddress, neonEvmProgram, chainId);
  const [neonWalletAddress] = neonWalletProgramAddress(neonAddress, neonEvmProgram);
  const keys: AccountMeta[] = [
    { pubkey: solanaWallet, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: balanceAddress, isSigner: false, isWritable: true },
    { pubkey: neonWalletAddress, isSigner: false, isWritable: true }
  ];
  const a = numberToBuffer(InstructionTag.AccountBalanceCreate);
  const b = hexToBuffer(neonAddress);
  const c = toBytes64LE(chainId, 8);
  const data = bufferConcat([a, b, c]);
  return new TransactionInstruction({ programId: neonEvmProgram, keys, data });
}

/**
 * Generate a transaction instruction that creates a new account at an address generated with from, a seed, and programId
 */
export function createAccountWithSeedInstruction(neonEvmProgram: PublicKey, operator: PublicKey, holderAccount: PublicKey, seed: string, space: number, lamports = 0): TransactionInstruction {
  return SystemProgram.createAccountWithSeed({
    fromPubkey: operator,
    newAccountPubkey: holderAccount,
    basePubkey: operator,
    seed, // should be the same as for derived account
    lamports,
    space,
    programId: neonEvmProgram
  });
}

export function createHolderAccountInstruction(neonEvmProgram: PublicKey, operator: PublicKey, holderAddress: PublicKey, seed: string): TransactionInstruction {
  const instruction = numberToBuffer(InstructionTag.HolderCreate);
  const seedLength = toBytes64LE(seed.length, 8);
  const seedBuffer = stringToBuffer(seed);
  const data = bufferConcat([instruction, seedLength, seedBuffer]);

  const keys: AccountMeta[] = [
    { pubkey: holderAddress, isSigner: false, isWritable: true },
    { pubkey: operator, isSigner: true, isWritable: false }
  ];
  return new TransactionInstruction({ programId: neonEvmProgram, keys, data });
}

export function deleteHolderAccountInstruction(neonEvmProgram: PublicKey, solanaWallet: PublicKey, holderAddress: PublicKey): TransactionInstruction {
  const data = numberToBuffer(InstructionTag.HolderDelete);
  const keys: AccountMeta[] = [
    { pubkey: holderAddress, isSigner: false, isWritable: true },
    { pubkey: solanaWallet, isSigner: true, isWritable: false }
  ];
  return new TransactionInstruction({ programId: neonEvmProgram, keys, data });
}

export function createWriteToHolderAccountInstruction(neonEvmProgram: PublicKey, operator: PublicKey, holderAddress: PublicKey, transactionHash: string, transactionPart: Buffer, offset: number): TransactionInstruction {
  const type = numberToBuffer(InstructionTag.HolderWrite);
  const data = bufferConcat([type, hexToBuffer(transactionHash), toBytes64LE(offset, 8), transactionPart]);
  return new TransactionInstruction({
    keys: [
      { pubkey: holderAddress, isSigner: false, isWritable: true },
      { pubkey: operator, isSigner: true, isWritable: false }
    ],
    programId: neonEvmProgram,
    data
  });
}

export function createScheduledTransactionStartFromAccountInstruction(neonEvmProgram: PublicKey, operator: PublicKey, balanceAddress: PublicKey, holderAddress: PublicKey, treeAddress: PublicKey, index: number, additionAccounts: PublicKey[] = []): TransactionInstruction {
  const type = numberToBuffer(ScheduledTransactionTag.StartFromAccount);
  const indexBuffer = numberToBuffer(index);
  const data = bufferConcat([type, indexBuffer]);
  const keys: AccountMeta[] = [
    { pubkey: holderAddress, isSigner: false, isWritable: true },
    { pubkey: treeAddress, isSigner: false, isWritable: true },
    { pubkey: operator, isSigner: true, isWritable: true },
    { pubkey: balanceAddress, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
  ];
  for (const account of additionAccounts) {
    keys.push({ pubkey: account, isSigner: false, isWritable: true });
  }
  return new TransactionInstruction({ programId: neonEvmProgram, keys, data });
}

export function createScheduledTransactionStartFromInstructionInstruction(neonEvmProgram: PublicKey, signerAddress: PublicKey, balanceAddress: PublicKey, holderAddress: PublicKey, treeAddress: PublicKey, index: number, neonTransaction: Buffer, additionAccounts: PublicKey[] = []): TransactionInstruction {
  const type = numberToBuffer(ScheduledTransactionTag.StartFromInstruction);
  const indexBuffer = numberToBuffer(index);
  const data = bufferConcat([type, indexBuffer, neonTransaction]);
  const keys: AccountMeta[] = [
    { pubkey: holderAddress, isSigner: false, isWritable: true },
    { pubkey: treeAddress, isSigner: false, isWritable: true },
    { pubkey: signerAddress, isSigner: true, isWritable: true },
    { pubkey: balanceAddress, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
  ];
  for (const account of additionAccounts) {
    keys.push({ pubkey: account, isSigner: false, isWritable: true });
  }
  return new TransactionInstruction({ programId: neonEvmProgram, keys, data });
}
