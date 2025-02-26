import { decodeRlp, encodeRlp, keccak256, RlpStructuredData, toBeHex } from 'ethers';
import { EstimateScheduledTransaction, HexString, ScheduledTransactionData, ScheduledTransactionGas } from '../models';
import { bufferConcat, hexToBuffer, NeonChainId, numberToBuffer, toBytes16LE, toBytes64BE } from '../utils';

/**
 * ScheduledTransaction is used to create a transaction that will be executed
 * @constructor {Partial<ScheduledTransactionData>} data - The data required to create a ScheduledTransaction.
 * @constructor {string} data.payer - The address of the account that will pay for the transaction.
 * @constructor {string} data.sender - The address of the account that will send the transaction.
 * @constructor {number} data.nonce - The nonce counter of the transaction.
 * @constructor {number} data.index - The index of the transaction.
 * @constructor {string} data.intent - The intent of the transaction.
 * @constructor {string} data.intentCallData - The call data of the intent.
 * @constructor {string} data.target - The target address of the transaction (contract address or destination account address).
 * @constructor {string} data.callData - The call data of the transaction.
 * @constructor {number} data.value - The value of the transaction.
 * @constructor {number} data.chainId - The chain ID of the transaction.
 * @constructor {number} data.gasLimit - The gas limit of the transaction.
 * @constructor {number} data.maxFeePerGas - The maximum fee per gas of the transaction.
 * @constructor {number} data.maxPriorityFeePerGas - The maximum fee to increase the priority of the transaction.
 * @constructor {string} data.hash - The hash of the transaction.
 * @return {ScheduledTransaction} - The ScheduledTransaction object.
 * @example
 * ```typescript
 * const transaction = new ScheduledTransaction({
 *  payer: "0xPayerAddress",
 *  sender: "0xSenderAddress",
 *  nonce: 1,
 *  target: "0xTargetAddress",
 *  callData: "0xCallData",
 *  chainId: 245022927,
 *  gasLimit: 50000,
 *  maxFeePerGas: 1250000001,
 *  maxPriorityFeePerGas: 1250000000
 *  });
 *  ```
 */

export const GAS_LIMIT_DEFAULT = 5e4;
export const MAX_FEE_PER_GAS_DEFAULT = 1250000001;
export const MAX_PRIORITY_FEE_PER_GAS_DEFAULT = 1250000000;

export class ScheduledTransaction {
  readonly type = 0x7F;
  readonly neonSubType = 0x01;
  data: ScheduledTransactionData;
  private readonly defaultData: Partial<ScheduledTransactionData> = {
    value: '0x',
    chainId: toBeHex(NeonChainId.devnetSol),
    gasLimit: toBeHex(GAS_LIMIT_DEFAULT),
    maxFeePerGas: toBeHex(MAX_FEE_PER_GAS_DEFAULT),
    maxPriorityFeePerGas: toBeHex(MAX_PRIORITY_FEE_PER_GAS_DEFAULT)
  };

  /**
   * Encode the ScheduledTransaction object into a RLP array string.
   */
  encode(): HexString {
    const result: string[] = [];
    for (const key of ScheduledTransaction.keys) {
      // @ts-ignore
      result.push(this.data[key]);
    }

    return encodeRlp(result);
  }

  /**
   * Get the hash of the serialized ScheduledTransaction object.
   * This hash is used to identify the transaction.
   */
  hash(): HexString {
    return keccak256(`0x${this.serialize()}`);
  }

  /**
   * Serialize the ScheduledTransaction object into a hex string.
   */
  serialize(): HexString {
    const type = numberToBuffer(this.type);
    const subType = numberToBuffer(this.neonSubType);
    const encode = hexToBuffer(this.encode());
    return bufferConcat([type, subType, encode]).toString('hex');
  }

  /**
   * Serialize and return the node as bytes with the following layout:
   * - gasLimit: 32 bytes
   * - value: 32 bytes
   * - childIndex: 2 bytes
   * - successLimit: 2 bytes
   * - trxHash: 32 bytes
   * @param {number} childIndex - The index of dependent transactions that must be executed
   * before this one. Use the constant `NO_CHILD_INDEX` if there are no dependencies.
   * @param {number} successLimit - The number of successful preceding transactions required before this one can
   * @return {Buffer} - The serialized node as a buffer.
   */
  serializedNode(childIndex: number, successLimit: number): Buffer {
    const gasLimit = toBytes64BE(BigInt(this.data.gasLimit), 32, 24);
    const value = toBytes64BE(BigInt(this.data.value == '0x' ? 0 : this.data.value), 32, 24);
    const index = toBytes16LE(childIndex, 2);
    const success = toBytes16LE(successLimit, 2);
    const hash = hexToBuffer(this.hash());
    return bufferConcat([gasLimit, value, index, success, hash]);
  }

  feeEstimateData(): EstimateScheduledTransaction {
    const { payer, sender, target, callData } = this.data;
    return {
      from: sender !== '0x' ? sender : payer,
      to: target,
      data: callData
    };
  }

  setGasPrice({ gasLimit, maxFeePerGas, maxPriorityFeePerGas }: ScheduledTransactionGas): void {
    const data = { ...this.data };
    if (gasLimit) {
      data.gasLimit = GAS_LIMIT_DEFAULT > gasLimit ? toBeHex(GAS_LIMIT_DEFAULT) : toBeHex(gasLimit);
    }
    if (maxFeePerGas) {
      data.maxFeePerGas = MAX_FEE_PER_GAS_DEFAULT > maxFeePerGas ?
        toBeHex(MAX_FEE_PER_GAS_DEFAULT) : toBeHex(maxFeePerGas);
    }
    if (maxPriorityFeePerGas) {
      data.maxPriorityFeePerGas = MAX_PRIORITY_FEE_PER_GAS_DEFAULT > maxPriorityFeePerGas ?
        toBeHex(MAX_PRIORITY_FEE_PER_GAS_DEFAULT) : toBeHex(maxPriorityFeePerGas);
    }
    this.data = data;
  }

  constructor(data: Partial<ScheduledTransactionData>) {
    this.data = {} as ScheduledTransactionData;
    for (const key of ScheduledTransaction.keys) {
      // @ts-ignore
      this.data[key] = data.hasOwnProperty(key) ? this.convertData(data[key]) :
        // @ts-ignore
        this.defaultData.hasOwnProperty(key) ? this.defaultData[key] : '0x';
    }
  }

  private static keys: string[] = [
    'payer', 'sender', 'nonce', 'index', 'intent', 'intentCallData', 'target',
    'callData', 'value', 'chainId', 'gasLimit', 'maxFeePerGas', 'maxPriorityFeePerGas'
  ];

  private convertData(data: number | string | bigint | Buffer): string {
    const result = '0x';
    if (typeof data === 'string' && data.length > 0 && data.startsWith('0x')) {
      return data;
    } else if (typeof data === 'number' && data > 0) {
      return toBeHex(data);
    } else if (Buffer.isBuffer(data)) {
      return `0x${data.toString('hex')}`;
    }
    return result;
  }


  /**
   * Decode a RLP array string into a ScheduledTransaction object.
   */
  static from(items: string[]): ScheduledTransaction {
    const model: Partial<ScheduledTransactionData> = {};
    for (const [i, key] of ScheduledTransaction.keys.entries()) {
      // @ts-ignore
      model[key] = items[i];
    }
    return new ScheduledTransaction(model);
  }

  /**
   * Decode a RLP string into a ScheduledTransaction object.
   */
  static decodeFrom(data: string): ScheduledTransaction {
    const items = decodeRlp(data);
    const model: Partial<ScheduledTransactionData> = {};
    for (const [i, key] of ScheduledTransaction.keys.entries()) {
      // @ts-ignore
      model[key] = items[i];
    }
    return new ScheduledTransaction(model);
  }

  /**
   * Decode a RLP string into a RlpStructuredData object.
   */
  static decodeRpl(data: string): RlpStructuredData {
    return decodeRlp(data);
  }
}

/**
 * MultipleTransactions is used to create a list of transactions that will be executed in a specific order.
 * @constructor {number} nonce - The nonce of the transaction.
 * @constructor {number} maxFeePerGas - The maximum transaction fee (must match the fee of ScheduleTransaction).
 * @constructor {number} maxPriorityFeePerGas - The maximum fee to increase the priority of the transaction.
 */
export class MultipleTransactions {
  nonce: Buffer;
  maxFeePerGas: Buffer;
  maxPriorityFeePerGas: Buffer;
  private _data: Buffer;

  /*
  * @return {HexString} Converts MultipleTransactions to a hex string.
  * */
  get data(): HexString {
    return `0x${this._data.toString('hex')}`;
  }

  hash(): HexString {
    return keccak256(this.data);
  }

  /**
   * Adds a ScheduledTransaction to the list of multiple transactions.
   * @param {ScheduledTransaction} transaction - The Scheduled transaction object.
   * @param {number} childIndex - The index of dependent transactions that must be executed before this one. Use the constant `NO_CHILD_INDEX` if there are no dependencies.
   * @param {number} successLimit - The number of successful preceding transactions required before this one can be executed.
   * @return void;
   **/
  addTransaction(transaction: ScheduledTransaction, childIndex: number, successLimit: number): void {
    this._data = Buffer.concat([this._data, transaction.serializedNode(childIndex, successLimit)]);
  }

  constructor(nonce: number, maxFeePerGas: number = MAX_FEE_PER_GAS_DEFAULT, maxPriorityFeePerGas: number = MAX_PRIORITY_FEE_PER_GAS_DEFAULT) {
    this.nonce = toBytes64BE(nonce, 8);
    this.maxFeePerGas = toBytes64BE(maxFeePerGas, 32, 24);
    this.maxPriorityFeePerGas = toBytes64BE(maxPriorityFeePerGas, 32, 24);
    this._data = Buffer.concat([this.nonce, this.maxFeePerGas, this.maxPriorityFeePerGas]);
  }
}
