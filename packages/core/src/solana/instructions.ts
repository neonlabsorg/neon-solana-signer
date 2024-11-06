import { AccountMeta, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { createAccountWithSeedInstruction, createHolderAccountInstruction } from '@neonevm/token-transfer-core';
import { getAssociatedTokenAddress, NATIVE_MINT } from '@solana/spl-token';
import {
  CreateScheduledTransactionData,
  CreateScheduledTransactionInstructionData,
  NeonAddress,
  ScheduledInstruction
} from '../models';
import { bufferConcat, hexToBuffer, numberToBuffer, toBytesLittleEndian } from '../utils';
import {
  neonAuthorityPoolAddressSync,
  neonBalanceProgramAddressSync,
  neonTreeAccountAddressSync,
  neonWalletProgramAddress,
  TreasuryPoolAddress
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
    connection,
    signerAddress,
    neonEvmProgram,
    neonWallet,
    neonWalletNonce,
    neonTransaction,
    treasuryPoolCount
  } = transactionData;
  const transaction = new Transaction();
  const treasuryPool = new TreasuryPoolAddress(new PublicKey('C8SPT4zTVxWdCQTsk8f7RHaNDaPkx766x8icyzSUgzQ3'), 2);
  const [balanceAddress] = neonBalanceProgramAddressSync(neonWallet, neonEvmProgram, chainId);
  const [treeAccountAddress] = neonTreeAccountAddressSync(neonWallet, neonEvmProgram, neonWalletNonce);
  const [authorityPoolAddress] = neonAuthorityPoolAddressSync(neonEvmProgram);
  const associatedTokenAddress = await getAssociatedTokenAddress(NATIVE_MINT, authorityPoolAddress, true);

  const balanceAccount = await connection.getAccountInfo(balanceAddress);
  if (!balanceAccount) {
    transaction.add(createBalanceAccountInstruction(neonEvmProgram, signerAddress, neonWallet, chainId));
  }
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
  const keys = [
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
