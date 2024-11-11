import {
  AccountMeta,
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import { createAccountWithSeedInstruction, createHolderAccountInstruction } from '@neonevm/token-transfer-core';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import {
  CreateScheduledTransactionData,
  CreateScheduledTransactionInstructionData,
  NeonAddress,
  ScheduledInstruction
} from '../models';
import { bufferConcat, hexToBuffer, numberToBuffer, stringToBuffer, toBytesLittleEndian } from '../utils';
import {
  neonAuthorityPoolAddressSync,
  neonBalanceProgramAddressSync,
  neonTreeAccountAddressSync,
  neonWalletProgramAddress
} from './account';

export const enum EvmInstruction {
  AccountCreateBalance = 0x30, // 48
  DepositToBalance = 0x31, // 49
  TransactionExecuteFromInstruction = 0x3D, //  61
}

export function createScheduledTransactionInstruction(instructionData: CreateScheduledTransactionInstructionData): TransactionInstruction {
  const {
    neonEvmProgram: programId,
    signerAddress,
    balanceAddress,
    treeAccountAddress,
    associatedTokenAddress,
    treasuryPool,
    neonTransaction
  } = instructionData;

  const keys: Array<AccountMeta> = [
    { pubkey: signerAddress, isSigner: true, isWritable: true },
    { pubkey: balanceAddress, isSigner: false, isWritable: true },
    { pubkey: treasuryPool.publicKey, isSigner: false, isWritable: true },
    { pubkey: treeAccountAddress, isSigner: false, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
  ];
  const type = numberToBuffer(ScheduledInstruction.CREATE);
  const count = treasuryPool.buffer;
  const transaction = hexToBuffer(neonTransaction);
  return new TransactionInstruction({ keys, programId, data: bufferConcat([type, count, transaction]) } as any);
}

export function createScheduledTransactionMultipleInstruction(instructionData: CreateScheduledTransactionInstructionData): TransactionInstruction {
  const {
    neonEvmProgram: programId,
    signerAddress,
    balanceAddress,
    treeAccountAddress,
    associatedTokenAddress,
    treasuryPool,
    neonTransaction
  } = instructionData;
  const keys: Array<AccountMeta> = [
    { pubkey: signerAddress, isSigner: true, isWritable: true },
    { pubkey: balanceAddress, isSigner: false, isWritable: true },
    { pubkey: treasuryPool.publicKey, isSigner: false, isWritable: true },
    { pubkey: treeAccountAddress, isSigner: false, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
  ];
  const type = numberToBuffer(ScheduledInstruction.CREATE_MULTIPLE);
  const count = treasuryPool.buffer;
  const transaction = hexToBuffer(neonTransaction);
  return new TransactionInstruction({ keys, programId, data: bufferConcat([type, count, transaction]) } as any);
}

export async function createScheduledNeonEvmTransaction(transactionData: CreateScheduledTransactionData): Promise<Transaction> {
  const {
    chainId,
    signerAddress,
    tokenMintAddress,
    neonEvmProgram,
    neonWallet,
    neonWalletNonce,
    neonTransaction,
    treasuryPool
  } = transactionData;
  const transaction = new Transaction();
  const [balanceAddress] = neonBalanceProgramAddressSync(neonWallet, neonEvmProgram, chainId);
  const [treeAccountAddress] = neonTreeAccountAddressSync(neonWallet, neonEvmProgram, neonWalletNonce);
  const [authorityPoolAddress] = neonAuthorityPoolAddressSync(neonEvmProgram);
  const associatedTokenAddress = await getAssociatedTokenAddress(tokenMintAddress, authorityPoolAddress, true);

  transaction.add(createScheduledTransactionInstruction({
    neonEvmProgram,
    signerAddress,
    balanceAddress,
    treeAccountAddress,
    associatedTokenAddress,
    treasuryPool,
    neonTransaction
  }));

  return transaction;
}

export async function createHolderAccountTransaction(neonEvmProgram: PublicKey, solanaWallet: PublicKey, holderAccount: PublicKey, holderSeed: string): Promise<Transaction> {
  const transaction = new Transaction();
  const createAccountWithSeedParams = {
    neonEvmProgram,
    solanaWallet,
    holderAccountPK: holderAccount,
    seed: holderSeed
  };
  transaction.add(createAccountWithSeedInstruction(createAccountWithSeedParams));
  transaction.add(createHolderAccountInstruction(createAccountWithSeedParams));

  return transaction;
}

export function createBalanceAccountInstruction(neonEvmProgram: PublicKey, solanaWallet: PublicKey, neonAddress: NeonAddress, chainId: number): TransactionInstruction {
  const [balanceAddress] = neonBalanceProgramAddressSync(neonAddress, neonEvmProgram, chainId);
  const [neonWalletAddress] = neonWalletProgramAddress(neonAddress, neonEvmProgram);
  const keys: AccountMeta[] = [
    { pubkey: solanaWallet, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: balanceAddress, isSigner: false, isWritable: true },
    { pubkey: neonWalletAddress, isSigner: false, isWritable: true }
  ];
  const a = numberToBuffer(EvmInstruction.AccountCreateBalance);
  const b = hexToBuffer(neonAddress);
  const c = toBytesLittleEndian(chainId, 8);
  const data = bufferConcat([a, b, c]);
  return new TransactionInstruction({ programId: neonEvmProgram, keys, data } as any);
}

export function createBalanceAccountTransaction(neonEvmProgram: PublicKey, solanaWallet: PublicKey, neonAddress: NeonAddress, chainId: number): Transaction {
  const transaction = new Transaction();
  transaction.add(createBalanceAccountInstruction(neonEvmProgram, solanaWallet, neonAddress, chainId));
  return transaction;
}

export function createWriteToHolderAccountInstruction(neonEvmProgram: PublicKey, operator: PublicKey, holderAddress: PublicKey, transactionHash: string, transactionPart: Buffer, offset: number): TransactionInstruction {
  const data = bufferConcat([stringToBuffer(transactionHash), numberToBuffer(offset), transactionPart]);
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
  const type = numberToBuffer(ScheduledInstruction.START_FROM_ACCOUNT);
  const indexBuffer = numberToBuffer(index);
  const data = bufferConcat([type, indexBuffer]);
  const keys: AccountMeta[] = [
    { pubkey: holderAddress, isSigner: false, isWritable: true },
    { pubkey: treeAddress, isSigner: false, isWritable: true },
    { pubkey: operator, isSigner: true, isWritable: true },
    { pubkey: balanceAddress, isSigner: false, isWritable: true }
  ];
  for (const account of additionAccounts) {
    keys.push({ pubkey: account, isSigner: false, isWritable: true });
  }
  return new TransactionInstruction({ programId: neonEvmProgram, keys, data } as any);
}

export function createScheduledTransactionStartFromAccountTransaction(neonEvmProgram: PublicKey, operator: PublicKey, balanceAddress: PublicKey, holderAddress: PublicKey, treeAddress: PublicKey, index: number, additionAccounts: PublicKey[] = []): Transaction {
  const transaction = new Transaction();
  transaction.add(ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }));
  transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000000 }));
  transaction.add(createScheduledTransactionStartFromAccountInstruction(neonEvmProgram, operator, balanceAddress, holderAddress, treeAddress, index, additionAccounts));
  return transaction;
}
