import { decodeRlp, encodeRlp, keccak256, RlpStructuredData, toBeHex } from 'ethers';
import { HexString } from '../models';
import { bufferConcat, hexToBuffer, NeonChainId, numberToBuffer, toBytes16LE, toBytes64BE } from '../utils';

export interface ScheduledTransactionData {
  payer: string;
  sender: string;
  nonce: string;
  index: string;
  intent: string; // = Buffer.from('');
  intentCallData: string; // = Buffer.from('');
  target: string; // = Buffer.from('');
  callData: string; // = Buffer.from('');
  value: string; // = 0;
  chainId: string;
  gasLimit: string; // = 9999999999;
  maxFeePerGas: string; // = 100;
  maxPriorityFeePerGas: string; // = 10;
  hash?: string;
}

export class ScheduledTransaction {
  readonly type = 0x7F;
  readonly neonSubType = 0x01;
  readonly data: ScheduledTransactionData;
  private readonly defaultData: Partial<ScheduledTransactionData> = {
    value: '0x', // = 0;
    chainId: toBeHex(NeonChainId.testnetSol),
    gasLimit: toBeHex(9999999999), // = 9999999999;
    maxFeePerGas: toBeHex(100), // = 100;
    maxPriorityFeePerGas: toBeHex(10) // = 10;
  };

  encode(): HexString {
    const result: string[] = [];
    for (const key of ScheduledTransaction.keys) {
      // @ts-ignore
      result.push(this.data[key]);
    }

    return encodeRlp(result);
  }

  hash(): HexString {
    return keccak256(`0x${this.serialize()}`);
  }

  serialize(): HexString {
    const type = numberToBuffer(this.type);
    const subType = numberToBuffer(this.neonSubType);
    const encode = hexToBuffer(this.encode());
    return bufferConcat([type, subType, encode]).toString('hex');
  }

  serializeWithHash(): HexString {
    const data: ScheduledTransactionData = { ...this.data };
    data.hash = this.hash();
    const transaction = new ScheduledTransaction(data);
    return transaction.serialize();
  }

  /**
   * Serialize and return the node as bytes with the following layout:
   * - gas_limit: 32 bytes
   * - value: 32 bytes
   * - childIndex: 2 bytes
   * - successLimit: 2 bytes
   * - trxHash: 32 bytes
   */
  serializedNode(childIndex: number, successLimit: number): Buffer {
    const gasLimit = toBytes64BE(BigInt(this.data.gasLimit), 32, 24);
    const value = toBytes64BE(BigInt(this.data.value == '0x' ? 0 : this.data.value), 32, 24);
    const index = toBytes16LE(childIndex, 2);
    const success = toBytes16LE(successLimit, 2);
    const hash = hexToBuffer(this.hash());
    return bufferConcat([gasLimit, value, index, success, hash]);
  }

  constructor(data: Partial<ScheduledTransactionData>) {
    this.data = {} as ScheduledTransactionData;
    for (const key of ScheduledTransaction.keys) {
      // @ts-ignore
      this.data[key] = data.hasOwnProperty(key) ? data[key] : this.defaultData.hasOwnProperty(key) ? this.defaultData[key] : '0x';
    }
  }

  private static keys: string[] = [
    'payer', 'sender', 'nonce', 'index', 'intent', 'intentCallData', 'target',
    'callData', 'value', 'chainId', 'gasLimit', 'maxFeePerGas', 'maxPriorityFeePerGas'
  ];

  static from(items: string[]): ScheduledTransaction {
    const model: Partial<ScheduledTransactionData> = {};
    for (const [i, key] of ScheduledTransaction.keys.entries()) {
      // @ts-ignore
      model[key] = items[i];
    }
    return new ScheduledTransaction(model);
  }

  static decodeFrom(data: string): ScheduledTransaction {
    const items = decodeRlp(data);
    const model: Partial<ScheduledTransactionData> = {};
    for (const [i, key] of ScheduledTransaction.keys.entries()) {
      // @ts-ignore
      model[key] = items[i];
    }
    return new ScheduledTransaction(model);
  }

  static decodeRpl(data: string): RlpStructuredData {
    return decodeRlp(data);
  }
}

export class MultipleTreeAccount {
  nonce: Buffer;
  maxFeePerGar: Buffer;
  maxPriorityFeePerGas: Buffer;
  private _data: Buffer;

  get data(): HexString {
    return `0x${this._data.toString('hex')}`;
  }

  addTransaction(transaction: ScheduledTransaction, childIndex: number, successLimit: number): void {
    this._data = Buffer.concat([this._data, transaction.serializedNode(childIndex, successLimit)]);
  }

  constructor(nonce: number, maxFeePerGar: number = 100, maxPriorityFeePerGas: number = 10) {
    this.nonce = toBytes64BE(nonce, 8);
    this.maxFeePerGar = toBytes64BE(maxFeePerGar, 32, 24);
    this.maxPriorityFeePerGas = toBytes64BE(maxPriorityFeePerGas, 32, 24);
    this._data = Buffer.concat([this.nonce, this.maxFeePerGar, this.maxPriorityFeePerGas]);
  }
}
