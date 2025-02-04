import {
  AccountMeta,
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { keccak256 } from 'ethers';
import {
  bufferConcat,
  delay,
  EVM_STEPS,
  hexToBuffer,
  log,
  numberToBuffer,
  sendSolanaTransaction,
  toBytes64LE
} from '../utils';
import {
  CreateScheduledTransactionData,
  DestroyScheduledTransactionData,
  HexString,
  InstructionTag,
  NeonAddress,
  SolanaTransactionSignature
} from '../models';
import {
  neonAuthorityPoolAddressSync,
  neonBalanceProgramAddressSync,
  neonTreeAccountAddressSync,
  SolanaNeonAccount,
  TreasuryPoolAddress
} from './account';
import {
  createAccountWithSeedInstruction,
  createBalanceAccountInstruction,
  createHolderAccountInstruction,
  createScheduledTransactionInstruction,
  createScheduledTransactionStartFromAccountInstruction,
  createWriteToHolderAccountInstruction,
  destroyScheduledTransactionInstruction
} from './instructions';
import { ScheduledTransaction } from '../neon';

export function createBalanceAccountTransaction(neonEvmProgram: PublicKey, solanaWallet: PublicKey, neonAddress: NeonAddress, chainId: number): Transaction {
  const transaction = new Transaction();
  transaction.add(createBalanceAccountInstruction(neonEvmProgram, solanaWallet, neonAddress, chainId));
  return transaction;
}

export async function createHolderAccountTransaction(neonEvmProgram: PublicKey, solanaWallet: PublicKey, holderAccount: PublicKey, holderSeed: string): Promise<Transaction> {
  const transaction = new Transaction();
  transaction.add(createAccountWithSeedInstruction(neonEvmProgram, solanaWallet, holderAccount, holderSeed, 128 * 1024, 1e9));
  transaction.add(createHolderAccountInstruction(neonEvmProgram, solanaWallet, holderAccount, holderSeed));

  return transaction;
}

export function createScheduledNeonEvmTransaction(transactionData: CreateScheduledTransactionData): Transaction {
  const {
    chainId,
    signerAddress,
    tokenMintAddress,
    neonEvmProgram,
    neonWallet,
    neonWalletNonce,
    neonTransaction,
    isMultiple
  } = transactionData;
  const transaction = new Transaction();
  const [balanceAddress] = neonBalanceProgramAddressSync(neonWallet, neonEvmProgram, chainId);
  const [treeAccountAddress] = neonTreeAccountAddressSync(neonWallet, neonEvmProgram, chainId, neonWalletNonce);
  const [authorityPoolAddress] = neonAuthorityPoolAddressSync(neonEvmProgram);
  const associatedTokenAddress = getAssociatedTokenAddressSync(tokenMintAddress, authorityPoolAddress, true);

  transaction.add(createScheduledTransactionInstruction({
    neonEvmProgram,
    signerAddress,
    balanceAddress,
    treeAccountAddress,
    associatedTokenAddress,
    neonTransaction,
    isMultiple
  }));

  return transaction;
}

export function createScheduledNeonEvmMultipleTransaction(transactionData: CreateScheduledTransactionData): Transaction {
  const {
    chainId,
    signerAddress,
    tokenMintAddress,
    neonEvmProgram,
    neonWallet,
    neonWalletNonce,
    neonTransaction
  } = transactionData;
  return createScheduledNeonEvmTransaction({
    chainId,
    signerAddress,
    tokenMintAddress,
    neonEvmProgram,
    neonWallet,
    neonWalletNonce,
    neonTransaction,
    isMultiple: true
  });
}

export function destroyScheduledNeonEvmMultipleTransaction(transactionData: DestroyScheduledTransactionData): Transaction {
  const { signerAddress, neonEvmProgram, balanceAddress, treeAccountAddress } = transactionData;
  const transaction = new Transaction();
  transaction.add(destroyScheduledTransactionInstruction({
    neonEvmProgram,
    signerAddress,
    balanceAddress,
    treeAccountAddress
  }));

  return transaction;
}


export async function writeTransactionToHoldAccount(connection: Connection, neonEvmProgram: PublicKey, solanaUser: SolanaNeonAccount, holderAddress: PublicKey, scheduledTransaction: ScheduledTransaction): Promise<any> {
  const receipts: Promise<SolanaTransactionSignature>[] = [];
  const scheduledTransactionHash = `0x${scheduledTransaction.serialize}`;
  const transactionHash = keccak256(scheduledTransactionHash);
  let rest = hexToBuffer(scheduledTransactionHash);
  let offset = 0;

  while (rest.length) {
    const part = rest.slice(0, 920);
    rest = rest.slice(920);

    const transaction = new Transaction();
    transaction.feePayer = solanaUser.publicKey;
    transaction.add(createWriteToHolderAccountInstruction(neonEvmProgram, solanaUser.publicKey, holderAddress, transactionHash, part, offset));
    receipts.push(sendSolanaTransaction(connection, transaction, [solanaUser.signer!], false, { preflightCommitment: 'confirmed' }, `rest`));

    offset += part.length;
  }

  for (const receipt of receipts) {
    const { signature, blockhash, lastValidBlockHeight } = await receipt;
    log(signature, blockhash, lastValidBlockHeight);
  }
}

export async function executeScheduledTransactionFromAccount(connection: Connection, neonEvmProgram: PublicKey, solanaUser: SolanaNeonAccount, holderAddress: PublicKey, treeAddress: PublicKey, nonce: number) {
  const transaction = createScheduledTransactionStartFromAccountTransaction(neonEvmProgram, solanaUser.publicKey, solanaUser.balanceAddress, holderAddress, treeAddress, nonce);
  transaction.feePayer = solanaUser.publicKey;
  await sendSolanaTransaction(connection, transaction, [solanaUser.signer!], false, { preflightCommitment: 'confirmed' }, `rest`);
}

export async function executeTransactionStepsFromAccount(
  connection: Connection,
  neonEvmProgram: PublicKey,
  solanaUser: SolanaNeonAccount,
  holderAddress: PublicKey,
  treasuryPoolAddress: TreasuryPoolAddress,
  storageAccount: PublicKey,
  additionalAccounts: PublicKey[] = []
): Promise<any> {
  let index = 0;
  let receipt = null;

  while (!receipt) {
    const transaction = createPartialCallOrContinueFromRawEthereumTransaction(
      index,
      EVM_STEPS,
      neonEvmProgram,
      solanaUser,
      holderAddress,
      treasuryPoolAddress,
      ``,
      additionalAccounts
    );
    const { signature } = await sendSolanaTransaction(connection, transaction, [solanaUser.signer!], false, { preflightCommitment: 'confirmed' }, `execute ${index}`);
    await delay(2e3);
    receipt = await connection.getParsedTransaction(signature, { commitment: 'confirmed' });
    index += 1;
  }
  log(receipt);
  return receipt;
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
  type: number = InstructionTag.TransactionStepFromInstruction, // TransactionStepFromInstruction
  systemProgram: PublicKey = SystemProgram.programId
): TransactionInstruction {
  const data = bufferConcat([
    numberToBuffer(type),
    treasuryPoolAddress.buffer,
    toBytes64LE(stepCount, 4),
    toBytes64LE(index, 4),
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
