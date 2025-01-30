import { AccountInfo, Connection, Keypair, PublicKey, Signer } from '@solana/web3.js';
import { dataSlice, keccak256 } from 'ethers';
import { hexToBuffer, numberToBuffer, stringToBuffer, toBytes64LE, toBytesInt32, toSigner, toU256BE } from '../utils';
import { AccountSeedTag, NeonAddress, TreeAccountData, TreeAccountTransactionData } from '../models';
import { BalanceAccountLayout } from './layout';
import { createBalanceAccountTransaction } from './transactions';

/**
 * Derives a synchronous Treasury Pool address for the given Neon EVM program and pool index.
 *
 * This function computes a **program-derived address (PDA)** for a specific **treasury pool**
 * using a predefined seed (`"treasury_pool"`) and the provided pool index.
 * The resulting address is used to manage Neon EVM's treasury pools within Solana.
 *
 * @param {PublicKey} neonEvmProgram - The public key of the Neon EVM program.
 * @param {number} treasuryPoolIndex - The index of the treasury pool.
 * @returns {[PublicKey, number]} A tuple containing:
 *   - `PublicKey`: The derived treasury pool address.
 *   - `number`: The bump seed used in PDA derivation.
 *
 * @example
 * ```typescript
 * const [poolAddress, bump] = treasuryPoolAddressSync(neonEvmProgram, 3);
 * console.log("Treasury Pool Address:", poolAddress.toBase58());
 * ```
 */
export function treasuryPoolAddressSync(neonEvmProgram: PublicKey, treasuryPoolIndex: number): [PublicKey, number] {
  const a = stringToBuffer('treasury_pool');
  const b = Buffer.from(toBytesInt32(treasuryPoolIndex));
  return PublicKey.findProgramAddressSync([a, b], neonEvmProgram);
}

/**
 * Derives a synchronous Neon balance program address for a given Neon wallet and chain ID.
 *
 * This function computes a **program-derived address (PDA)** for a specific **Neon balance account**,
 * The derivation is based on the **Neon wallet address**, **Neon EVM program**, and **chain ID**,
 * ensuring a unique balance account per chain.
 *
 * @param {NeonAddress} neonWallet - The Ethereum-style Neon wallet address in hexadecimal format.
 * @param {PublicKey} neonEvmProgram - The public key of the Neon EVM program.
 * @param {number} chainId - The chain ID associated with the Neon network.
 * @returns {[PublicKey, number]} A tuple containing:
 *   - `PublicKey`: The derived balance program address.
 *   - `number`: The bump seed used in PDA derivation.
 *
 * @example
 * ```typescript
 * const [balanceAddress, bump] = neonBalanceProgramAddressSync("0x1234567890abcdef1234567890abcdef12345678", neonEvmProgram, 245022926);
 * console.log("Neon Balance Address:", balanceAddress.toBase58());
 * ```
 */
export function neonBalanceProgramAddressSync(neonWallet: NeonAddress, neonEvmProgram: PublicKey, chainId: number): [PublicKey, number] {
  const neonWalletBuffer = hexToBuffer(neonWallet);
  const chainIdBytes = toU256BE(BigInt(chainId)); //chain_id as u256be
  const seed: any[] = [numberToBuffer(AccountSeedTag.SeedVersion), neonWalletBuffer, chainIdBytes];
  return PublicKey.findProgramAddressSync(seed, neonEvmProgram);
}

/**
 * Derives a synchronous Neon authority pool address for the given Neon EVM program.
 *
 * This function computes a **program-derived address (PDA)** for the **authority pool**,
 * which is responsible for managing deposits within the Neon EVM on Solana. The derivation
 * is based on a predefined seed (`"Deposit"`) to ensure a unique and consistent authority pool address.
 *
 * @param {PublicKey} neonEvmProgram - The public key of the Neon EVM program.
 * @returns {[PublicKey, number]} A tuple containing:
 *   - `PublicKey`: The derived authority pool address.
 *   - `number`: The bump seed used in PDA derivation.
 *
 * @example
 * ```typescript
 * const [authorityPoolAddress, bump] = neonAuthorityPoolAddressSync(neonEvmProgram);
 * console.log("Neon Authority Pool Address:", authorityPoolAddress.toBase58());
 * ```
 */
export function neonAuthorityPoolAddressSync(neonEvmProgram: PublicKey): [PublicKey, number] {
  const seed: any[] = [stringToBuffer('Deposit')];
  return PublicKey.findProgramAddressSync(seed, neonEvmProgram);
}

/**
 * Derives a synchronous Neon tree account address for the given Neon wallet, EVM program, chain ID, and nonce.
 *
 * This function computes a **program-derived address (PDA)** for a **tree account** within the Neon EVM.
 * The address derivation is based on multiple seed components:
 * - **Seed version**: Ensures compatibility with account derivation logic.
 * - **Tag (`"TREE"`)**: Identifies this PDA as a tree account.
 * - **Neon wallet address**: The Ethereum-style address corresponding to the Solana wallet.
 * - **Chain ID**: Differentiates accounts across different Neon chains.
 * - **Nonce**:  The last scheduled nonce for Solana user
 *
 * @param {NeonAddress} neonWallet - The Ethereum-style Neon wallet address in hexadecimal format.
 * @param {PublicKey} neonEvmProgram - The public key of the Neon EVM program.
 * @param {number} chainId - The chain ID associated with the Neon network.
 * @param {number} nonce - A unique identifier is required to validate the address of the TreeAccount.
 * @returns {[PublicKey, number]} A tuple containing:
 *   - `PublicKey`: The derived tree account address.
 *   - `number`: The bump seed used in PDA derivation.
 *
 * @example
 * ```typescript
 * const [treeAccount, bump] = neonTreeAccountAddressSync(
 *   "0x1234567890abcdef1234567890abcdef12345678",
 *   neonEvmProgram,
 *   245022926,
 *   1
 * );
 * console.log("Neon Tree Account Address:", treeAccount.toBase58());
 * ```
 */
export function neonTreeAccountAddressSync(neonWallet: NeonAddress, neonEvmProgram: PublicKey, chainId: number, nonce: number): [PublicKey, number] {
  const version = numberToBuffer(AccountSeedTag.SeedVersion);
  const tag = stringToBuffer('TREE');
  const address = hexToBuffer(neonWallet);
  const _chainId = toBytes64LE(chainId, 8);
  const _nonce = toBytes64LE(nonce, 8);
  const seed: any[] = [version, tag, address, _chainId, _nonce];
  return PublicKey.findProgramAddressSync(seed, neonEvmProgram);
}

/**
 * Derives a synchronous Neon wallet program address for a given Neon wallet.
 *
 * This function computes a **program-derived address (PDA)** for a **Neon wallet** within the Neon EVM.
 * The PDA is generated based on:
 * - **Seed version**: Ensures compatibility with account derivation logic.
 * - **Neon wallet address**: The Ethereum-style wallet address used within Neon EVM.
 *
 * @param {NeonAddress} neonWallet - The Ethereum-style Neon wallet address in hexadecimal format.
 * @param {PublicKey} neonEvmProgram - The public key of the Neon EVM program.
 * @returns {[PublicKey, number]} A tuple containing:
 *   - `PublicKey`: The derived Neon wallet program address.
 *   - `number`: The bump seed used in PDA derivation.
 *
 * @example
 * ```typescript
 * const [walletPDA, bump] = neonWalletProgramAddress(
 *   "0x1234567890abcdef1234567890abcdef12345678",
 *   neonEvmProgram
 * );
 * console.log("Neon Wallet PDA:", walletPDA.toBase58());
 * ```
 */
export function neonWalletProgramAddress(neonWallet: NeonAddress, neonEvmProgram: PublicKey): [PublicKey, number] {
  const seeds: any[] = [numberToBuffer(AccountSeedTag.SeedVersion), hexToBuffer(neonWallet)];
  return PublicKey.findProgramAddressSync(seeds, neonEvmProgram);
}

/**
 * Retrieves the nonce value from a Neon wallet balance account.
 *
 * This function fetches the **Neon wallet balance account** from the Solana blockchain
 * and extracts its **nonce** value. The nonce is used in transaction processing to
 * ensure uniqueness.
 *
 * @param {Connection} connection - The Solana connection object used for querying account data.
 * @param {NeonAddress} neonWallet - The Ethereum-style Neon wallet address in hexadecimal format.
 * @param {PublicKey} neonEvmProgram - The public key of the Neon EVM program.
 * @param {number} chainId - The chain ID associated with the Neon network.
 * @returns {Promise<bigint>} A promise resolving to the nonce value, or `0n` if the balance account does not exist.
 *
 * @example
 * ```typescript
 * const nonce = await balanceAccountNonce(connection, "0x1234567890abcdef1234567890abcdef12345678", neonEvmProgram, 245022926);
 * console.log("Balance Account Nonce:", nonce);
 * ```
 */
export async function balanceAccountNonce(connection: Connection, neonWallet: NeonAddress, neonEvmProgram: PublicKey, chainId: number): Promise<bigint> {
  const [neonWalletBalanceAddress] = neonBalanceProgramAddressSync(neonWallet, neonEvmProgram, chainId);
  const neonWalletBalanceAccount = await connection.getAccountInfo(neonWalletBalanceAddress);
  if (neonWalletBalanceAccount) {
    const balanceAccountLayout = BalanceAccountLayout.decode(neonWalletBalanceAccount.data as Uint8Array);
    return balanceAccountLayout.nonce;
  }
  return BigInt(0);
}

/**
 * Generates a program-derived holder address using a randomly generated seed.
 *
 * This function creates a **program-derived address (PDA)** for a **holder account** associated with a given Solana wallet.
 * A random numeric seed is generated and used to derive the address with `PublicKey.createWithSeed()`.
 *
 * @param {PublicKey} neonEvmProgram - The public key of the Neon EVM program.
 * @param {PublicKey} solanaWallet - The Solana wallet public key that owns the holder account.
 * @returns {Promise<[PublicKey, string]>} A promise resolving to a tuple containing:
 *   - `PublicKey`: The derived holder account address.
 *   - `string`: The random seed used to generate the address.
 *
 * @example
 * ```typescript
 * const [holderAddress, seed] = await holderAddressWithSeed(neonEvmProgram, solanaWallet);
 * console.log("Holder Address:", holderAddress.toBase58());
 * console.log("Seed Used:", seed);
 * ```
 */
export async function holderAddressWithSeed(neonEvmProgram: PublicKey, solanaWallet: PublicKey): Promise<[PublicKey, string]> {
  const seed = Math.floor(Math.random() * 1e12).toString();
  const holder = await PublicKey.createWithSeed(solanaWallet, seed, neonEvmProgram);
  return [holder, seed];
}

/**
 * Converts a Solana public key into a Neon EVM-compatible address.
 *
 * This function generates an Ethereum-style Neon wallet address from a given Solana `PublicKey`.
 * It applies the `keccak256` hash function to the Solana public key bytes and extracts
 * the last 20 bytes (12 to 32) to create a valid **Neon EVM address**.
 *
 * @param {PublicKey} publicKey - The Solana public key to be converted.
 * @returns {NeonAddress} A 20-byte Ethereum-style Neon wallet address.
 *
 * @example
 * ```typescript
 * const solanaPubKey = new PublicKey("8ab7...a1b3");
 * const neonAddress = solanaToNeonAddress(solanaPubKey);
 * console.log("Neon Address:", neonAddress); // 0x...
 * ```
 */
export function solanaToNeonAddress(publicKey: PublicKey): NeonAddress {
  return dataSlice(keccak256(publicKey.toBytes()), 12, 32);
}

/**
 * Represents a **Treasury Pool Address** within the Neon EVM ecosystem.
 *
 * This class is responsible for managing a specific **treasury pool** account.
 * It provides utilities for deriving, retrieving, and representing treasury pool addresses.
 */
export class TreasuryPoolAddress {
  /** The index of the treasury pool. */
  index: number;
  /** The derived public key representing the treasury pool address. */
  publicKey: PublicKey;

  /**
   * Retrieves the buffer representation of the treasury pool index.
   *
   * This buffer is typically used as a seed for PDA derivation.
   *
   * @returns {Buffer} A buffer representation of the treasury pool index.
   *
   * @example
   * ```typescript
   * const treasuryPool = new TreasuryPoolAddress(somePublicKey, 3);
   * console.log("Index Buffer:", treasuryPool.buffer);
   * ```
   */
  get buffer(): Buffer {
    return Buffer.from(toBytesInt32(this.index));
  }

  /**
   * Finds and returns a random **Treasury Pool Address** from the available pool count.
   *
   * This method selects a random **pool index** and derives the associated **public key**
   * using `treasuryPoolAddressSync()`.
   *
   * @param {PublicKey} neonEvmProgram - The public key of the Neon EVM program.
   * @param {number} count - The total number of treasury pools available.
   * @returns {TreasuryPoolAddress} A `TreasuryPoolAddress` instance representing the derived treasury pool.
   *
   * @example
   * ```typescript
   * const treasuryPool = TreasuryPoolAddress.find(neonEvmProgram, 10);
   * console.log("Treasury Pool Address:", treasuryPool.publicKey.toBase58());
   * console.log("Treasury Pool Index:", treasuryPool.index);
   * ```
   */
  static find(neonEvmProgram: PublicKey, count: number): TreasuryPoolAddress {
    const index = Math.floor(Math.random() * count) % count;
    const publicKey = treasuryPoolAddressSync(neonEvmProgram, index)[0];
    return new TreasuryPoolAddress(publicKey, index);
  }

  /**
   * Creates an instance of `TreasuryPoolAddress`.
   *
   * @param {PublicKey} publicKey - The derived public key representing the treasury pool.
   * @param {number} index - The index of the treasury pool.
   *
   * @example
   * ```typescript
   * const treasuryPool = new TreasuryPoolAddress(somePublicKey, 5);
   * ```
   */
  constructor(publicKey: PublicKey, index: number) {
    this.publicKey = publicKey;
    this.index = index;
  }
}

/**
 * Represents a Solana account associated with a Neon EVM wallet.
 *
 * This class provides utilities for managing a Solana account that interacts with the Neon EVM.
 * It includes methods for retrieving balance addresses, handling key pairs, signing transactions,
 * and creating balance accounts if they do not exist.
 */
export class SolanaNeonAccount {
  /** The Ethereum-style Neon wallet address derived from the Solana address. */
  neonWallet: NeonAddress;
  /** The public key of the Solana account. */
  publicKey: PublicKey;
  /** The public key of the Neon EVM program. */
  neonEvmProgram: PublicKey;
  /** The public key of the token mint associated with the account. */
  tokenMint: PublicKey;
  /** The Neon EVM chain ID. */
  chainId: number;
  /** The optional keypair for signing transactions (if available). */
  private _keypair?: Keypair;

  /**
   * Retrieves the balance program address for the Neon wallet.
   *
   * @returns {PublicKey} The derived public key of the balance account.
   */
  get balanceAddress(): PublicKey {
    return neonBalanceProgramAddressSync(this.neonWallet, this.neonEvmProgram, this.chainId)[0];
  }

  /**
   * Retrieves the associated keypair, if initialized.
   *
   * @throws {Error} If the keypair is not initialized.
   * @returns {Keypair} The keypair instance.
   */
  get keypair(): Keypair {
    if (!this._keypair) {
      throw new Error(`Keypair isn't initialized`);
    }
    return this._keypair;
  }

  /**
   * Retrieves the signer object from the keypair.
   *
   * @returns {Signer | null} A `Signer` object if the keypair exists, otherwise `null`.
   */
  get signer(): Signer | null {
    if (this._keypair) {
      return toSigner(this._keypair);
    }
    return null;
  }

  /**
   * Extracts the nonce from a given account's balance data.
   *
   * @param {AccountInfo<Buffer>} account - The Solana account information.
   * @returns {number} The extracted nonce, or `0` if the account is not provided.
   */
  nonce(account: AccountInfo<Buffer>): number {
    if (account) {
      // @ts-ignore
      const layout = BalanceAccountLayout.decode(account.data);
      return Number(layout.nonce);
    }
    return 0;
  }

  /**
   * Ensures the balance account exists, and if not, attempts to create it.
   *
   * If the account does not exist and a valid signer is available, a transaction is
   * created and signed to create the balance account.
   *
   * @param {Connection} connection - The Solana connection object.
   * @returns {Promise<AccountInfo<Buffer> | null>} The balance account information if successful, otherwise `null`.
   */
  async balanceAccountCreate(connection: Connection): Promise<AccountInfo<Buffer> | null> {
    let account = await connection.getAccountInfo(this.balanceAddress);
    if (account === null && this.signer) {
      const transaction = createBalanceAccountTransaction(this.neonEvmProgram, this.publicKey, this.neonWallet, this.chainId);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.feePayer = this.publicKey;
      transaction.recentBlockhash = blockhash;
      transaction.sign(this.signer);
      const signature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction({ signature, lastValidBlockHeight, blockhash }, 'finalized');
      account = await connection.getAccountInfo(this.balanceAddress);
      if (account) {
        console.log(BalanceAccountLayout.decode(account.data as any));
      }
    }
    return account;
  }

  /**
   * Creates a `SolanaNeonAccount` instance from a keypair.
   *
   * This method generates a new account using the given keypair and required parameters.
   *
   * @param {Keypair} keypair - The Solana keypair.
   * @param {PublicKey} neonEvmProgram - The public key of the Neon EVM program.
   * @param {PublicKey} mint - The token mint associated with the account.
   * @param {number} chainId - The chain ID for Neon EVM.
   * @returns {SolanaNeonAccount} A new instance of `SolanaNeonAccount`.
   *
   * @example
   * ```typescript
   * const gasToken = tokenList.find(i => parseInt(i.tokenChainId, 16) === chainId);
   * const mint = new PublicKey(gasToken.tokenMint);
   * const account = SolanaNeonAccount.fromKeypair(keypair, neonEvmProgram, mint, chainId);
   * console.log("Created Neon Account:", account);
   * ```
   */
  static fromKeypair(keypair: Keypair, neonEvmProgram: PublicKey, mint: PublicKey, chainId: number): SolanaNeonAccount {
    return new SolanaNeonAccount(keypair.publicKey, neonEvmProgram, mint, chainId, keypair);
  }

  /**
   * Creates a `SolanaNeonAccount` instance.
   *
   * @param {PublicKey} solanaAddress - The Solana public key associated with the account.
   * @param {PublicKey} neonEvmProgram - The public key of the Neon EVM program.
   * @param {PublicKey} mint - The token mint associated with the account.
   * @param {number} chainId - The chain ID for Neon EVM.
   * @param {Keypair} [keypair] - Optional keypair for signing transactions.
   */
  constructor(solanaAddress: PublicKey, neonEvmProgram: PublicKey, mint: PublicKey, chainId: number, keypair?: Keypair) {
    this.publicKey = solanaAddress;
    this.neonEvmProgram = neonEvmProgram;
    this.tokenMint = mint;
    this.chainId = chainId;
    this.neonWallet = solanaToNeonAddress(this.publicKey);
    if (keypair instanceof Keypair) {
      this._keypair = keypair;
    }
  }
}

/**
 * Represents a **Tree Account** for transactions in the Neon EVM ecosystem.
 *
 * This class encapsulates details of a transaction related to a **Tree Account**,
 * including its status, transaction hash, gas limit, execution results, and hierarchical structure.
 */
class TreeAccountTransaction {
  /** The execution status of the transaction (`success`, `failed`, `skipped`, `in processing`, `not started`). */
  status: string;
  /** The hash of the transaction execution result. */
  resultHash: string;
  /** The unique hash of scheduled Neon transaction. */
  transactionHash: string;
  /** The gas limit allocated for executing of all scheduled transactions. */
  gasLimit: string;
  /** The value transferred in the transaction. */
  value: string;
  /** The index of a child scheduled Neon transaction, the parentCount of which should be decreased by 1 on completing the current transaction **/
  childTransaction: number;
  /** The number of success parent Neon transactions, to start the execution **/
  successExecuteLimit: number;
  /**  The number of the not-processed parent Neon transactions **/
  parentCount: number;

  /**
   * Determines if the transaction was successfully executed.
   *
   * @returns {boolean} `true` if the transaction was successful, otherwise `false`.
   */
  get isSuccessful(): boolean {
    return this.status === 'Success';
  }

  /**
   * Determines if the transaction execution has failed.
   *
   * @returns {boolean} `true` if the transaction failed, otherwise `false`.
   */
  get isFailed(): boolean {
    return this.status === 'Failed';
  }

  /**
   * Creates a `TreeAccountTransaction` instance.
   *
   * @param {TreeAccountTransactionData} data - The transaction data object.
   *
   * @example
   * ```typescript
   * const transaction = new TreeAccountTransaction({
   *   status: "Success",
   *   result_hash: "0xabc...",
   *   transaction_hash: "0x123...",
   *   gas_limit: "50000",
   *   value: "0.1",
   *   child_transaction: 2,
   *   success_execute_limit: 5,
   *   parent_count: 1
   * });
   * ```
   */
  constructor(data: TreeAccountTransactionData) {
    this.status = data.status;
    this.resultHash = data.result_hash;
    this.transactionHash = data.transaction_hash;
    this.gasLimit = data.gas_limit;
    this.value = data.value;
    this.childTransaction = data.child_transaction;
    this.successExecuteLimit = data.success_execute_limit;
    this.parentCount = data.parent_count;
  }

  /**
   * Creates a new `TreeAccountTransaction` instance from a plain object.
   *
   * @param {TreeAccountTransactionData} data - The raw transaction data object.
   * @returns {TreeAccountTransaction} A new instance populated with the provided data.
   */
  static fromObject(data: TreeAccountTransactionData): TreeAccountTransaction {
    return new TreeAccountTransaction(data);
  }
}

/**
 * Represents a **Tree Account** within the Neon EVM ecosystem.
 *
 * A `TreeAccount` is a structured representation of a blockchain account that maintains
 * transaction history, gas fees, balance, and execution status. It also provides utility
 * methods to analyze transaction statuses.
 */
class TreeAccount {
  result: string;
  status: string;
  pubkey: string;
  payer: string;
  lastSlot: number;
  chainId: number;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  balance: number;
  lastIndex: number;
  transactions: TreeAccountTransaction[];

  get count(): number {
    return this.transactions.length;
  }

  get statuses(): Record<string, string> {
    return Object.fromEntries(this.transactions.map(tx => [tx.transactionHash, tx.status]));
  }

  get isAllSuccessful(): boolean {
    return this.transactions.every(tx => tx.isSuccessful);
  }

  constructor(data: TreeAccountData) {
    const value = data.value;
    this.result = data.result;
    this.status = value.status;
    this.pubkey = value.pubkey;
    this.payer = value.payer;
    this.lastSlot = value.last_slot;
    this.chainId = value.chain_id;
    this.maxFeePerGas = value.max_fee_per_gas;
    this.maxPriorityFeePerGas = value.max_priority_fee_per_gas;
    this.balance = parseInt(value.balance, 16);
    this.lastIndex = value.last_index;
    this.transactions = value.transactions.map(TreeAccountTransaction.fromObject);
  }

  static fromObject(data: TreeAccountData): TreeAccount {
    return new TreeAccount(data);
  }
}
