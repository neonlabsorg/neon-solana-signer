import {
  AccountMeta,
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import {
  CreateScheduledTransactionData,
  CreateScheduledTransactionInstructionData,
  HexString,
  NeonAddress,
  ScheduledInstruction
} from '../models';
import {
  bufferConcat,
  hexToBuffer,
  NEON_TREASURY_POOL_COUNT,
  numberToBuffer,
  stringToBuffer,
  toBytesLittleEndian
} from '../utils';
import {
  neonAuthorityPoolAddressSync,
  neonBalanceProgramAddressSync,
  neonTreeAccountAddressSync,
  neonWalletProgramAddress,
  SolanaNeonAccount,
  TreasuryPoolAddress
} from './account';

export const enum EvmInstruction {
  CreateAccountV02 = 0x18, // 24
  CollectTreasure = 0x1e, // 30
  TransactionStepFromData = 0x20, //  32
  TransactionStepFromAccount = 0x21, //  33
  TransactionStepFromAccountNoChainId = 0x22, //  34
  CancelWithHash = 0x23, //  35
  HolderCreate = 0x24, //  36
  HolderDelete = 0x25, //  37
  HolderWrite = 0x26, //  38
  DepositV03 = 0x27, //  39
  CreateAccountV03 = 0x28, //  40
  AccountCreateBalance = 0x30, // 48
  DepositToBalance = 0x31, // 49
  TransactionExecuteFromInstruction = 0x3D, //  61
  TransactionExecuteFromInstructionMainnet = 0x32, //  50
  TransactionStepFromInstruction = 0x34, //  50
}

export function createScheduledTransactionInstruction(instructionData: CreateScheduledTransactionInstructionData): TransactionInstruction {
  const {
    neonEvmProgram: programId,
    signerAddress,
    balanceAddress,
    treeAccountAddress,
    associatedTokenAddress,
    neonTransaction
  } = instructionData;
  const treasuryPool = TreasuryPoolAddress.find(programId, NEON_TREASURY_POOL_COUNT);

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
    neonTransaction
  } = instructionData;
  const treasuryPool = TreasuryPoolAddress.find(programId, NEON_TREASURY_POOL_COUNT);

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
    neonTransaction
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
    neonTransaction
  }));

  return transaction;
}

export async function createHolderAccountTransaction(neonEvmProgram: PublicKey, solanaWallet: PublicKey, holderAccount: PublicKey, holderSeed: string): Promise<Transaction> {
  const transaction = new Transaction();
  transaction.add(createAccountWithSeedInstruction(neonEvmProgram, solanaWallet, holderAccount, holderSeed, 128 * 1024, 1e9));
  transaction.add(createHolderAccountInstruction(neonEvmProgram, solanaWallet, holderAccount, holderSeed));

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
  return new TransactionInstruction({ programId: neonEvmProgram, keys, data });
}

export function createBalanceAccountTransaction(neonEvmProgram: PublicKey, solanaWallet: PublicKey, neonAddress: NeonAddress, chainId: number): Transaction {
  const transaction = new Transaction();
  transaction.add(createBalanceAccountInstruction(neonEvmProgram, solanaWallet, neonAddress, chainId));
  return transaction;
}

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
  const instruction = numberToBuffer(EvmInstruction.HolderCreate);
  const seedLength = toBytesLittleEndian(seed.length, 8);
  const seedBuffer = stringToBuffer(seed);
  const data = bufferConcat([instruction, seedLength, seedBuffer]);

  const keys: AccountMeta[] = [
    { pubkey: holderAddress, isSigner: false, isWritable: true },
    { pubkey: operator, isSigner: true, isWritable: false }
  ];
  return new TransactionInstruction({ programId: neonEvmProgram, keys, data });
}

export function deleteHolderAccountInstruction(neonEvmProgram: PublicKey, solanaWallet: PublicKey, holderAddress: PublicKey): TransactionInstruction {
  const data = numberToBuffer(EvmInstruction.HolderDelete);
  const keys: AccountMeta[] = [
    { pubkey: holderAddress, isSigner: false, isWritable: true },
    { pubkey: solanaWallet, isSigner: true, isWritable: false }
  ];
  return new TransactionInstruction({ programId: neonEvmProgram, keys, data });
}

export function createWriteToHolderAccountInstruction(neonEvmProgram: PublicKey, operator: PublicKey, holderAddress: PublicKey, transactionHash: string, transactionPart: Buffer, offset: number): TransactionInstruction {
  const type = numberToBuffer(EvmInstruction.HolderWrite);
  const data = bufferConcat([type, hexToBuffer(transactionHash), toBytesLittleEndian(offset, 8), transactionPart]);
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
  return new TransactionInstruction({ programId: neonEvmProgram, keys, data });
}

export function createScheduledTransactionStartFromAccountTransaction(neonEvmProgram: PublicKey, operator: PublicKey, balanceAddress: PublicKey, holderAddress: PublicKey, treeAddress: PublicKey, index: number, additionAccounts: PublicKey[] = []): Transaction {
  const transaction = new Transaction();
  transaction.add(ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }));
  transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000000 }));
  transaction.add(createScheduledTransactionStartFromAccountInstruction(neonEvmProgram, operator, balanceAddress, holderAddress, treeAddress, index, additionAccounts));
  return transaction;
}

export function createPartialCallOrContinueFromRawEthereumInstruction(
  index: number,
  stepCount: number,
  neonEvmProgram: PublicKey,
  operator: PublicKey,
  balanceAddress: PublicKey,
  holderAddress: PublicKey,
  treasuryPoolAddress: TreasuryPoolAddress,
  additionalAccounts: PublicKey[],
  instruction: HexString,
  type: number = EvmInstruction.TransactionStepFromInstruction, // TransactionStepFromInstruction
  systemProgram: PublicKey = SystemProgram.programId
): TransactionInstruction {
  const data = bufferConcat([
    numberToBuffer(type),
    treasuryPoolAddress.buffer,
    toBytesLittleEndian(stepCount, 4),
    toBytesLittleEndian(index, 4),
    hexToBuffer(instruction)
  ]);

  const keys: AccountMeta[] = [
    { pubkey: holderAddress, isSigner: false, isWritable: true },
    { pubkey: operator, isSigner: true, isWritable: true },
    { pubkey: treasuryPoolAddress.publicKey, isSigner: false, isWritable: true },
    { pubkey: balanceAddress, isSigner: false, isWritable: true },
    { pubkey: systemProgram, isSigner: false, isWritable: true }
  ];

  for (const acc of additionalAccounts) {
    keys.push({ pubkey: acc, isSigner: false, isWritable: true });
  }

  return new TransactionInstruction({ programId: neonEvmProgram, keys, data });
}

export function createPartialCallOrContinueFromRawEthereumTransaction(
  index: number,
  stepCount: number,
  neonEvmProgram: PublicKey,
  solanaUser: SolanaNeonAccount,
  holderAddress: PublicKey,
  treasuryPoolAddress: TreasuryPoolAddress,
  transactionPart: HexString,
  additionAccounts: PublicKey[] = []
): Transaction {
  const transaction = new Transaction();
  transaction.add(ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }));
  transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000000 }));
  transaction.add(createPartialCallOrContinueFromRawEthereumInstruction(index, stepCount, neonEvmProgram, solanaUser.publicKey, solanaUser.balanceAddress, holderAddress, treasuryPoolAddress, additionAccounts, transactionPart));
  return transaction;
}
