import { PublicKey } from '@solana/web3.js';
import { delay, post } from '../utils';
import {
  EmulateTransactionData,
  HolderAccount,
  NeonAddress,
  NeonApiResponse,
  NeonBalance,
  ScheduledTransactionStatus,
  TransactionTreeResponse,
  TransferTreeData
} from '../models';

/**
 * A client API for interacting with **Neon EVM infrastructure**.
 *
 * This class provides a set of methods to **emulate transactions**, **query balances**,
 * **fetch storage values**, **retrieve holder accounts**, and **execute transaction trees** on **Neon EVM**.
 *
 * @class
 * @example
 * ```typescript
 * const neonClient = new NeonClientApi("https://neon-api.example.com");
 * const balance = await neonClient.getBalance("0xNeonAddress", 245022926);
 * console.log(balance);
 * ```
 */
export class NeonClientApi {
  private url: string;

  /**
   * **Emulates the execution** of a given Ethereum-like transaction on Neon EVM.
   *
   * This function is used to simulate the execution of a transaction **without broadcasting** it.
   *
   * @param {EmulateTransactionData} transaction - The **transaction data** to emulate.
   * @param {number} [maxStepsToExecute=500000] - The **maximum number of execution steps**.
   * @param {any} [provideAccountInfo=null] - Optional **account information** to include.
   * @returns {Promise<any>} A **promise** resolving to the **emulation result**.
   */
  async emulate(transaction: EmulateTransactionData, maxStepsToExecute = 500000, provideAccountInfo: any = null): Promise<any> {
    const body = {
      step_limit: maxStepsToExecute,
      tx: transaction,
      accounts: [],
      provide_account_info: provideAccountInfo
    };
    return post(`${this.url}/emulate`, body);
  }


  /**
   * **Retrieves the storage value** at a given index for a specified Neon contract.
   *
   * @param {NeonAddress} contract - The **Neon contract address**.
   * @param {number} index - The **storage index** to query.
   * @returns {Promise<any>} A **promise** resolving to the **storage value**.
   *
   * @example
   * ```typescript
   * const storageValue = await neonClient.getStorageAt("0xContractAddress", 1);
   * console.log(storageValue);
   * ```
   */
  async getStorageAt(contract: NeonAddress, index: number): Promise<any> {
    const body = { contract, index };
    return post(`${this.url}/storage`, body);
  }

  /**
   * **Fetches holder account information** based on the given Solana public key.
   *
   * @param {PublicKey} publicKey - The **Solana public key** of the holder account.
   * @returns {Promise<NeonApiResponse<HolderAccount>>} A **promise** resolving to the **holder account details**.
   *
   * @example
   * ```typescript
   * const holder = await neonClient.getHolder(new PublicKey("SolanaPublicKey"));
   * console.log(holder);
   * ```
   */
  async getHolder(publicKey: PublicKey): Promise<NeonApiResponse<HolderAccount>> {
    const body = { pubkey: publicKey.toBase58() };
    return post(`${this.url}/holder`, body);
  }

  /**
   * **Retrieves the balance** of a given Neon EVM account.
   *
   * @param {NeonAddress} address - The **Neon wallet address**.
   * @param {number} chainId - The **Chain ID** of the Neon network.
   * @returns {Promise<NeonApiResponse<NeonBalance>>} A **promise** resolving to the **account balance**.
   *
   * @example
   * ```typescript
   * const balance = await neonClient.getBalance("0xNeonAddress", 245022926);
   * console.log(balance);
   * ```
   */
  async getBalance(address: NeonAddress, chainId: number): Promise<NeonApiResponse<NeonBalance>> {
    const body = { account: [{ address, chain_id: chainId }] };
    return post(`${this.url}/balance`, body);
  }

  /**
   * **Retrieves the transaction tree** associated with a specific transaction origin.
   *
   * @param {TransferTreeData} origin - The **origin transaction data**.
   * @param {number} nonce - The **nonce value** of the transaction.
   * @returns {Promise<NeonApiResponse<TransactionTreeResponse>>} A **promise** resolving to the **transaction tree details**.
   *
   * @example
   * ```typescript
   * const tree = await neonClient.transactionTree(originData, 1);
   * console.log(tree);
   * ```
   */
  async transactionTree(origin: TransferTreeData, nonce: number): Promise<NeonApiResponse<TransactionTreeResponse>> {
    const body = { origin, nonce };
    return post(`${this.url}/transaction_tree`, body);
  }

  /**
   * **Waits for the execution of a scheduled transaction tree**.
   *
   * This function **polls** the transaction tree and **accumulates its execution results** over time.
   *
   * @param {TransferTreeData} origin - The **origin transaction data**.
   * @param {number} nonce - The **nonce value** of the transaction.
   * @param {number} timeout - The **maximum waiting time** in milliseconds.
   * @returns {Promise<ScheduledTransactionStatus[]>} A **promise** resolving to an array of **executed transaction statuses**.
   */
  async waitTransactionTreeExecution(origin: TransferTreeData, nonce: number, timeout: number): Promise<ScheduledTransactionStatus[]> {
    const start = Date.now();
    const result: ScheduledTransactionStatus[] = [];
    while (timeout > Date.now() - start) {
      const { value, status } = await this.transactionTree(origin, nonce);
      const { transactions } = value;
      if (transactions.length > 0) {
        for (const tx of transactions) {
          const index = result.findIndex(i => i.transaction_hash === tx.transaction_hash);
          if (index === -1) {
            result.push(tx);
          } else {
            result[index] = tx;
          }
        }
      } else {
        return result;
      }
      await delay(100);
    }
    return result;
  }

  /**
   * Creates an instance of **NeonClientApi**.
   *
   * @param {string} url - The **base API URL** for the Neon EVM service.
   */
  constructor(url: string) {
    this.url = url;
  }
}
