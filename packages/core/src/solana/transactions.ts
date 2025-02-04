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
import { getAssociatedTokenAddress } from '@solana/spl-token';

/**
 * Creates a **Solana transaction** to initialize a balance account for a given **Neon EVM wallet**.
 *
 * This function generates a transaction that contains an **instruction** to create a **balance account**,
 * ensuring that the specified **Neon address** has a corresponding balance tracking account on **Solana**.
 *
 * @param {PublicKey} neonEvmProgram - The public key of the **Neon EVM program**.
 * @param {PublicKey} solanaWallet - The public key of the **Solana wallet** initiating the transaction.
 * @param {NeonAddress} neonAddress - The **Neon EVM wallet address** associated with this balance account.
 * @param {number} chainId - The **chain ID** representing the network where the transaction is executed.
 * @returns {Transaction} A **Solana `Transaction` object**, ready to be signed and sent.
 *
 * @example
 * ```typescript
 * const transaction = createBalanceAccountTransaction(
 *   neonEvmProgram,
 *   solanaWallet,
 *   "0xNeonWalletAddress",
 *   245022926
 * );
 * transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
 * const signature = await connection.sendTransaction(transaction, [signer]);
 * ```
 */
export function createBalanceAccountTransaction(neonEvmProgram: PublicKey, solanaWallet: PublicKey, neonAddress: NeonAddress, chainId: number): Transaction {
  const transaction = new Transaction();
  transaction.add(createBalanceAccountInstruction(neonEvmProgram, solanaWallet, neonAddress, chainId));
  return transaction;
}

/**
 * Creates a **Solana transaction** to initialize a **holder account**.
 *
 * This function constructs a transaction containing:
 * - An instruction to **create an account with a deterministic seed**.
 * - An instruction to **initialize the holder account** within the **Neon EVM program**.
 *
 * The **holder account** is used for **storing temporary transaction data** and **processing Neon EVM transactions**.
 *
 * @param {PublicKey} neonEvmProgram - The public key of the **Neon EVM program**.
 * @param {PublicKey} solanaWallet - The public key of the **Solana wallet** initiating the transaction.
 * @param {PublicKey} holderAccount - The **public key of the holder account** to be created.
 * @param {string} holderSeed - The **unique seed** used to derive the holder account address.
 * @returns {Promise<Transaction>} A **Solana `Transaction` object**, ready to be signed and sent.
 *
 * @example
 * ```typescript
 * const transaction = await createHolderAccountTransaction(
 *   neonEvmProgram,
 *   solanaWallet,
 *   holderAccount,
 *   "unique-holder-seed"
 * );
 * transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
 * const signature = await connection.sendTransaction(transaction, [signer]);
 * ```
 */
export async function createHolderAccountTransaction(neonEvmProgram: PublicKey, solanaWallet: PublicKey, holderAccount: PublicKey, holderSeed: string): Promise<Transaction> {
  const transaction = new Transaction();
  transaction.add(createAccountWithSeedInstruction(neonEvmProgram, solanaWallet, holderAccount, holderSeed, 128 * 1024, 1e9));
  transaction.add(createHolderAccountInstruction(neonEvmProgram, solanaWallet, holderAccount, holderSeed));

  return transaction;
}

/**
 * Creates a **Solana transaction** to schedule a **Neon EVM transaction**, enabling the execution of a **Neon Transaction tree**.
 *
 * This functionality allows for the **automatic splitting of large Ethereum-like transactions** into **smaller, independent Neon transactions**.
 * In this model, an individual Neon transaction **may fail without affecting the entire transaction flow**, as the results of executed Neon transactions can be **aggregated and handled**.
 *
 * @param {CreateScheduledTransactionData} transactionData - The structured data required to create a scheduled Neon EVM transaction.
 * @param {number} transactionData.chainId - The **chain ID** representing the target blockchain network.
 * @param {PublicKey} transactionData.signerAddress - The **public key** of the **signing account** responsible for initiating the transaction.
 * @param {PublicKey} transactionData.tokenMintAddress - The **public key** of the **token mint account** associated with the transaction.
 * @param {PublicKey} transactionData.neonEvmProgram - The **Neon EVM program ID** used for transaction execution.
 * @param {NeonAddress} transactionData.neonWallet - The **Neon wallet address** associated with the transaction.
 * @param {number} transactionData.neonWalletNonce - A **nonce value** of the root **Neon transaction** in the tree of scheduled Neon transactions.
 * @param {string} transactionData.neonTransaction - The **raw Neon EVM transaction data**.
 * @param {boolean} transactionData.isMultiple - A **flag indicating whether multiple transactions are scheduled together**.
 * @returns {Promise<Transaction>} A **Solana `Transaction` object**, ready to be signed and sent.
 */
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

/**
 * Creates a **Solana transaction** to schedule multiple **Neon EVM transactions** as part of a **Neon transaction tree execution**.
 *
 * This function wraps `createScheduledNeonEvmTransaction` but explicitly sets `isMultiple: true`,
 * allowing the execution of **multiple dependent transactions** within the same scheduled process.
 *
 * @param {CreateScheduledTransactionData} transactionData - The structured data required to create a scheduled Neon EVM transaction.
 * @param {number} transactionData.chainId - The **chain ID** representing the target blockchain network.
 * @param {PublicKey} transactionData.signerAddress - The **public key** of the **signing account** responsible for initiating the transaction.
 * @param {PublicKey} transactionData.tokenMintAddress - The **public key** of the **token mint account** associated with the transaction.
 * @param {PublicKey} transactionData.neonEvmProgram - The **Neon EVM program ID** used for transaction execution.
 * @param {NeonAddress} transactionData.neonWallet - The **Neon wallet address** associated with the transaction.
 * @param {number} transactionData.neonWalletNonce - A **nonce value** of the root **Neon transaction** in the tree of scheduled Neon transactions.
 * @param {string} transactionData.neonTransaction - The **raw Neon EVM transaction data**.
 * @returns {Promise<Transaction>} A **Solana `Transaction` object**, ready to be signed and sent.
 */
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

/**
 * Creates a **Solana transaction** to **destroy a scheduled Neon EVM TreeAccount**.
 *
 * This function removes a previously scheduled **Neon EVM transaction** by destroying its **TreeAccount**,
 * ensuring proper cleanup and returning unspent fees to the appropriate accounts.
 *
 * ### **Conditions for Destroying a TreeAccount:**
 * - The **TreeAccount** must not have any **active** transactions being processed.
 * - The **TreeAccount** can be destroyed if:
 *   - There are **no unprocessed Neon transactions** in the account.
 *   - The **last transaction slot** is **at least 9000 slots old** (~1 hour).
 *
 * ### **Fund Distribution Upon Destruction:**
 * - **Rent-exempt SOL** is returned to the **TreasuryAccount**.
 * - The remaining **gas tokens** are transferred to the **payer's balance account**.
 *
 * @param {DestroyScheduledTransactionData} transactionData - The structured data required to destroy a scheduled transaction.
 * @param {PublicKey} transactionData.signerAddress - The **public key** of the **Neon Operator** responsible for destruction.
 * @param {PublicKey} transactionData.neonEvmProgram - The **Neon EVM program ID** where the scheduled transaction exists.
 * @param {PublicKey} transactionData.balanceAddress - The **public key** of the **payer's balance account**.
 * @param {PublicKey} transactionData.treeAccountAddress - The **public key** of the **TreeAccount** being destroyed.
 * @returns {Transaction} A **Solana `Transaction` object**, ready to be signed and sent.
 */
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

/**
 * Writes a **scheduled Neon EVM transaction** into a **Solana holder account** by splitting it into chunks.
 *
 * Since Solana transactions have a **size limit**, this function **splits a scheduled Neon transaction**
 * into smaller **chunks** and sequentially writes them into the **holder account**.
 *
 * @param {Connection} connection - The **Solana connection instance** to interact with the blockchain.
 * @param {PublicKey} neonEvmProgram - The **Neon EVM program** managing the scheduled transaction.
 * @param {SolanaNeonAccount} solanaUser - The **Solana account** signing and funding the transaction associated with the Neon wallet.
 * @param {PublicKey} holderAddress - The **public key of the holder account** where transaction data is stored.
 * @param {ScheduledTransaction} scheduledTransaction - The **Neon transaction** to be written into the holder account.
 * @returns {Promise<any>} A promise resolving once the transaction is fully written.
 *
 * ### **How It Works**
 * 1. **Hashes the scheduled Neon transaction** using `keccak256`.
 * 2. **Splits the transaction data** into **chunks of 920 bytes**.
 * 3. **Writes each chunk sequentially** into the **holder account**.
 * 4. **Sends multiple transactions** in parallel to ensure fast execution.
 * 5. **Logs each transaction signature** for debugging purposes.
 *
 * ### **Example**
 * ```typescript
 * await writeTransactionToHoldAccount(
 *   connection,
 *   neonEvmProgram,
 *   solanaUser,
 *   holderAddress,
 *   scheduledTransaction
 * );
 * ```
 */
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

/**
 * Executes a **scheduled Neon EVM transaction** from a **Solana holder account**.
 *
 * This function **retrieves and executes** a previously scheduled Neon transaction by creating
 * and sending an **on-chain transaction** from a **Solana holder account**.
 *
 * @param {Connection} connection - The **Solana connection instance** to interact with the blockchain.
 * @param {PublicKey} neonEvmProgram - The **Neon EVM program ID** managing the scheduled transaction.
 * @param {SolanaNeonAccount} solanaUser - The **Solana account** that will execute the transaction.
 * @param {PublicKey} holderAddress - The **public key of the holder account** storing the scheduled transaction.
 * @param {PublicKey} treeAddress - The **public key of the transaction tree account** linked to the execution.
 * @param {number} nonce - A **nonce value** of the root **Neon transaction** in the tree of scheduled Neon transactions.
 * @returns {Promise<void>} A promise resolving once the transaction is executed.
 */
export async function executeScheduledTransactionFromAccount(connection: Connection, neonEvmProgram: PublicKey, solanaUser: SolanaNeonAccount, holderAddress: PublicKey, treeAddress: PublicKey, nonce: number) {
  const transaction = createScheduledTransactionStartFromAccountTransaction(neonEvmProgram, solanaUser.publicKey, solanaUser.balanceAddress, holderAddress, treeAddress, nonce);
  transaction.feePayer = solanaUser.publicKey;
  await sendSolanaTransaction(connection, transaction, [solanaUser.signer!], false, { preflightCommitment: 'confirmed' }, `rest`);
}

/**
 * Executes a scheduled **Neon EVM transaction** step-by-step from a **Solana holder account**.
 *
 * This function **iteratively processes** a large Ethereum-like transaction by breaking it into smaller
 * execution steps (EVM steps) and executing them sequentially on Solana.
 * It ensures that **each step is confirmed before proceeding** to the next one.
 *
 * @param {Connection} connection - The **Solana connection instance** to interact with the blockchain.
 * @param {PublicKey} neonEvmProgram - The **Neon EVM program ID** managing the execution of the transaction.
 * @param {SolanaNeonAccount} solanaUser - The **Solana account** that will execute the transaction.
 * @param {PublicKey} holderAddress - The **public key of the holder account** storing the scheduled transaction.
 * @param {TreasuryPoolAddress} treasuryPoolAddress - The **address of the treasury pool** used for transaction fees.
 * @param {PublicKey} storageAccount - The **public key of the storage account** linked to transaction execution.
 * @param {PublicKey[]} [additionalAccounts=[]] - An optional array of **additional accounts** required for execution.
 * @returns {Promise<any>} A promise resolving with the **receipt of the executed transaction**.
 *
 * ### **How It Works**
 * 1. **Creates a transaction step-by-step**, executing the Ethereum-like transaction in smaller **EVM steps**.
 * 2. **Sends each step to the Solana blockchain** until the transaction is fully executed.
 * 3. **Waits for confirmation** of each step before proceeding to the next step.
 * 4. **Logs and returns the final transaction receipt** after full execution.
 */
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

/**
 * Creates a **Solana transaction** to start the execution of a **scheduled Neon EVM transaction**
 * from a **Solana holder account**.
 *
 * This function prepares and returns a **Solana transaction** that initiates a scheduled Neon transaction,
 * enabling step-by-step execution.
 *
 * @param {PublicKey} neonEvmProgram - The **Neon EVM program ID** managing the execution of the transaction.
 * @param {PublicKey} operator - The **Solana account (operator) responsible for executing the transaction**.
 * @param {PublicKey} balanceAddress - The **public key of the balance account** associated with the transaction.
 * @param {PublicKey} holderAddress - The **public key of the holder account** storing the scheduled transaction.
 * @param {PublicKey} treeAddress - The **public key of the transaction tree account** used in execution.
 * @param {number} index - The **transaction index** in the scheduled transaction queue.
 * @param {PublicKey[]} [additionAccounts=[]] - An optional array of **additional accounts** required for execution.
 * @returns {Transaction} A **Solana `Transaction` object**, ready to be signed and sent.
 *
 * ### **How It Works**
 * 1. **Requests a compute heap frame** of `256 KB` to allocate enough memory for processing.
 * 2. **Sets the compute unit price** to ensure priority execution.
 * 3. **Adds an instruction** to initiate the scheduled Neon transaction from the Solana holder account.
 * 4. **Returns the constructed transaction** ready for submission.
 *
 * ### **Example**
 * ```typescript
 * const transaction = createScheduledTransactionStartFromAccountTransaction(
 *   neonEvmProgram,
 *   operator,
 *   balanceAddress,
 *   holderAddress,
 *   treeAddress,
 *   0 // First transaction index
 * );
 * ```
 */
export function createScheduledTransactionStartFromAccountTransaction(neonEvmProgram: PublicKey, operator: PublicKey, balanceAddress: PublicKey, holderAddress: PublicKey, treeAddress: PublicKey, index: number, additionAccounts: PublicKey[] = []): Transaction {
  const transaction = new Transaction();
  transaction.add(ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }));
  transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000000 }));
  transaction.add(createScheduledTransactionStartFromAccountInstruction(neonEvmProgram, operator, balanceAddress, holderAddress, treeAddress, index, additionAccounts));
  return transaction;
}

/**
 * Creates a **Solana transaction instruction** to execute a **partial call or continue execution**
 * of a **Neon EVM transaction**.
 *
 * This function is responsible for **processing large Ethereum-like transactions** on **Neon EVM**
 * by breaking them down into **smaller execution steps (EVM steps)** and **handling partial execution**.
 *
 * @param {number} index - The **current step index** in the transaction execution.
 * @param {number} stepCount - The **total number of execution steps** to be processed.
 * @param {PublicKey} neonEvmProgram - The **Neon EVM program ID** managing the execution of the transaction.
 * @param {PublicKey} operator - The **Solana account (operator) initiating the transaction**.
 * @param {PublicKey} balanceAddress - The **public key of the balance program address for the Neon wallet** used for gas and execution fees.
 * @param {PublicKey} holderAddress - The **public key of the holder account** storing the transaction.
 * @param {TreasuryPoolAddress} treasuryPoolAddress - The **address of the treasury pool** used for transaction fees.
 * @param {PublicKey[]} additionalAccounts - An array of **additional accounts** required for execution.
 * @param {HexString} instruction - The **raw transaction data** for the specific execution step.
 * @param {number} [type=InstructionTag.TransactionStepFromInstruction] - The **instruction type** (defaults to 0x34).
 * @param {PublicKey} [systemProgram=SystemProgram.programId] - The **public key of the Solana system program**.
 * @returns {TransactionInstruction} A **Solana `TransactionInstruction` object**, ready to be included in a transaction.
 *
 * ### **Example**
 * ```typescript
 * const instruction = createPartialCallOrContinueFromRawEthereumInstruction(
 *   0, // First step
 *   100, // Total steps
 *   neonEvmProgram,
 *   solanaUser.publicKey,
 *   balanceAddress,
 *   holderAddress,
 *   treasuryPoolAddress,
 *   [],
 *   "0xTransactionPart"
 * );
 * ```
 */
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

/**
 * Creates a **Solana transaction** to execute a **partial call or continue execution** of a **Neon EVM transaction**.
 *
 * This function is responsible for **processing large Ethereum-like transactions** on **Neon EVM**
 * by breaking them down into **smaller execution steps (EVM steps)** and **handling partial execution**.
 *
 * @param {number} index - The **current step index** in the transaction execution.
 * @param {number} stepCount - The **total number of execution steps** to be processed.
 * @param {PublicKey} neonEvmProgram - The **Neon EVM program ID** managing the execution of the transaction.
 * @param {SolanaNeonAccount} solanaUser - The **Solana account** executing the transaction.
 * @param {PublicKey} holderAddress - The **public key of the holder account** storing the transaction.
 * @param {TreasuryPoolAddress} treasuryPoolAddress - The **address of the treasury pool** used for transaction fees.
 * @param {HexString} transactionPart - The **raw transaction data** for the specific execution step.
 * @param {PublicKey[]} [additionAccounts=[]] - An optional array of **additional accounts** required for execution.
 * @returns {Transaction} A **Solana `Transaction` object**, ready to be signed and sent.
 *
 * ### **How It Works**
 * 1. **Requests a compute heap frame** of `256 KB` to allocate enough memory for processing.
 * 2. **Sets the compute unit price** to ensure priority execution.
 * 3. **Adds an instruction** to execute the partial call or continue processing from the last step.
 * 4. **Returns the constructed transaction** ready for submission.
 */
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
