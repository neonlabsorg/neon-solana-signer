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
    neonTransaction,
    isMultiple
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
  const type = numberToBuffer(isMultiple ? ScheduledTransactionTag.CreateMultiple : ScheduledTransactionTag.Create);
  const count = treasuryPool.buffer;
  const transaction = hexToBuffer(neonTransaction);
  return new TransactionInstruction({ keys, programId, data: bufferConcat([type, count, transaction]) } as any);
}

/**
 * Creates a **transaction instruction** to finalize a scheduled transaction.
 *
 * It specifies the **holder address, tree account, signer, and balance account** required to complete the transaction.
 *
 * @param {FinishScheduledTransactionData} data - The necessary data for finalizing the scheduled transaction.
 * @param {PublicKey} data.neonEvmProgram - The public key of the Neon EVM program.
 * @param {PublicKey} data.holderAddress - The public key of the holder account storing the scheduled transaction.
 * @param {PublicKey} data.treeAccountAddress - The public key of the tree account managing the transaction.
 * @param {PublicKey} data.signerAddress - The public key of the signer executing the transaction - solana wallet.
 * @param {PublicKey} data.balanceAddress - The public key of the balance account involved in the transaction - contain information about neon wallet.
 * @returns {TransactionInstruction} A Solana `TransactionInstruction` to finalize the scheduled transaction.
 *
 * @example
 * ```typescript
 * const instruction = finishScheduledTransactionInstruction({
 *   neonEvmProgram,
 *   holderAddress,
 *   treeAccountAddress,
 *   signerAddress,
 *   balanceAddress
 * });
 * transaction.add(instruction);
 * ```
 */
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

/**
 * Creates a **transaction instruction** to skip a scheduled transaction.
 *
 * This function constructs a **Solana transaction instruction** that marks a scheduled transaction as **skipped**.
 * It specifies the **holder account, tree account, signer, and transaction index** required to perform the operation.
 *
 * @param {SkipScheduledTransactionData} data - The necessary data for skipping the scheduled transaction.
 * @param {PublicKey} data.neonEvmProgram - The public key of the Neon EVM program.
 * @param {PublicKey} data.signerAddress - The public key of the signer executing the skip operation - solana wallet.
 * @param {PublicKey} data.holderAccount - The public key of the holder account storing the scheduled transaction.
 * @param {PublicKey} data.treeAccountAddress - The public key of the tree account managing the transaction.
 * @param {number} data.transactionIndex - The index of the transaction to be skipped.
 * @returns {TransactionInstruction} A Solana `TransactionInstruction` to skip the scheduled transaction.
 *
 * @example
 * ```typescript
 * const instruction = skipScheduledTransactionInstruction({
 *   neonEvmProgram,
 *   signerAddress,
 *   holderAccount,
 *   treeAccountAddress,
 *   transactionIndex: 2
 * });
 * transaction.add(instruction);
 * ```
 */
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

/**
 * Creates a **transaction instruction** to destroy a scheduled transaction.
 *
 * It specifies the **signer, balance account, treasury pool, and tree account** required to perform the operation.
 *
 * @param {DestroyScheduledTransactionData} data - The necessary data for destroying the scheduled transaction.
 * @param {PublicKey} data.neonEvmProgram - The public key of the Neon EVM program.
 * @param {PublicKey} data.signerAddress - The public key of the signer executing the destroy operation - solana wallet.
 * @param {PublicKey} data.balanceAddress - The public key of the balance account involved in the transaction.
 * @param {PublicKey} data.treeAccountAddress - The public key of the tree account managing the transaction.
 * @returns {TransactionInstruction} A Solana `TransactionInstruction` to destroy the scheduled transaction.
 *
 * @example
 * ```typescript
 * const instruction = destroyScheduledTransactionInstruction({
 *   neonEvmProgram,
 *   signerAddress,
 *   balanceAddress,
 *   treeAccountAddress
 * });
 * transaction.add(instruction);
 * ```
 */
export function destroyScheduledTransactionInstruction(data: DestroyScheduledTransactionData): TransactionInstruction {
  const { neonEvmProgram: programId, signerAddress, balanceAddress, treeAccountAddress } = data;
  const treasuryPool = TreasuryPoolAddress.find(programId, NEON_TREASURY_POOL_COUNT);
  const type = numberToBuffer(ScheduledTransactionTag.Destroy);
  const count = treasuryPool.buffer;
  const keys: Array<AccountMeta> = [
    { pubkey: signerAddress, isSigner: true, isWritable: true },
    { pubkey: balanceAddress, isSigner: false, isWritable: true },
    { pubkey: treasuryPool.publicKey, isSigner: false, isWritable: true },
    { pubkey: treeAccountAddress, isSigner: false, isWritable: true }
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

/**
 * Creates a **transaction instruction** to initialize a new holder account.
 *
 * This function constructs a **Solana transaction instruction** that **creates a holder account**
 * using a specific seed. The holder account is used to store intermediate transaction data
 *
 * @param {PublicKey} neonEvmProgram - The public key of the Neon EVM program.
 * @param {PublicKey} operator - The public key of the operator responsible for creating the holder account - instance of the SolanaNeonAccount.
 * @param {PublicKey} holderAddress - The public key of the holder account to be created.
 * @param {string} seed - The seed used to derive the holder account address.
 * @returns {TransactionInstruction} A Solana `TransactionInstruction` to create the holder account.
 *
 * @example
 * ```typescript
 * const instruction = createHolderAccountInstruction(
 *   neonEvmProgram,
 *   operator,
 *   holderAddress,
 *   "unique-seed-value"
 * );
 * transaction.add(instruction);
 * ```
 */
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

/**
 * Creates a **transaction instruction** to delete a holder account.
 *
 * The transaction requires the **Solana wallet** (operator) to sign the instruction to authorize the deletion.
 *
 * @param {PublicKey} neonEvmProgram - The public key of the Neon EVM program.
 * @param {PublicKey} solanaWallet - The public key of the Solana wallet authorizing the deletion.
 * @param {PublicKey} holderAddress - The public key of the holder account to be deleted.
 * @returns {TransactionInstruction} A Solana `TransactionInstruction` to delete the holder account.
 *
 * @example
 * ```typescript
 * const instruction = deleteHolderAccountInstruction(
 *   neonEvmProgram,
 *   solanaWallet,
 *   holderAddress
 * );
 * transaction.add(instruction);
 * ```
 */
export function deleteHolderAccountInstruction(neonEvmProgram: PublicKey, solanaWallet: PublicKey, holderAddress: PublicKey): TransactionInstruction {
  const data = numberToBuffer(InstructionTag.HolderDelete);
  const keys: AccountMeta[] = [
    { pubkey: holderAddress, isSigner: false, isWritable: true },
    { pubkey: solanaWallet, isSigner: true, isWritable: false }
  ];
  return new TransactionInstruction({ programId: neonEvmProgram, keys, data });
}

/**
 * Creates a **transaction instruction** to write data to a holder account.
 *
 * This function constructs a **Solana transaction instruction** that writes a part of a **transaction payload**
 * into a holder account.
 *
 * @param {PublicKey} neonEvmProgram - The public key of the Neon EVM program.
 * @param {PublicKey} operator - The public key of the operator executing the write operation - instance of the SolanaNeonAccount.
 * @param {PublicKey} holderAddress - The public key of the holder account where data will be written.
 * @param {string} transactionHash - The unique transaction hash associated with this write operation.
 * @param {Buffer} transactionPart - A chunk of transaction data to be stored in the holder account.
 * @param {number} offset - The byte offset at which the transaction part should be written.
 * @returns {TransactionInstruction} A Solana `TransactionInstruction` to write data to the holder account.
 *
 * @example
 * ```typescript
 * const instruction = createWriteToHolderAccountInstruction(
 *   neonEvmProgram,
 *   operator,
 *   holderAddress,
 *   "0xabcdef1234567890",
 *   Buffer.from("transaction data"),
 *   0
 * );
 * transaction.add(instruction);
 * ```
 */
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

/**
 * Creates a **transaction instruction** to start a scheduled transaction from an account.
 *
 * This function constructs a **Solana transaction instruction** that initiates a scheduled transaction
 * using a **tree structure**. It requires the **holder account**, **tree account**, **operator**,
 * and **balance account** to be provided. Additional accounts can be included as needed.
 *
 * @param {PublicKey} neonEvmProgram - The public key of the Neon EVM program.
 * @param {PublicKey} operator - The public key of the operator executing the transaction - instance of the SolanaNeonAccount.
 * @param {PublicKey} balanceAddress - The public key of the balance account involved in the transaction.
 * @param {PublicKey} holderAddress - The public key of the holder account storing transaction data.
 * @param {PublicKey} treeAddress - The public key of the tree account managing the transaction.
 * @param {number} index - The nonce of the scheduled transaction.
 * @param {PublicKey[]} [additionAccounts=[]] - An optional list of additional accounts required for execution.
 * @returns {TransactionInstruction} A Solana `TransactionInstruction` to start the scheduled transaction.
 *
 * @example
 * ```typescript
 * const instruction = createScheduledTransactionStartFromAccountInstruction(
 *   neonEvmProgram,
 *   operator,
 *   balanceAddress,
 *   holderAddress,
 *   treeAddress,
 *   1,  // Transaction nonce
 *   [additionalAccount1, additionalAccount2] // Optional additional accounts
 * );
 * transaction.add(instruction);
 * ```
 */
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
