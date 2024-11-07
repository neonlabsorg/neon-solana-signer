import { decodeRlp, encodeRlp, toBeHex } from 'ethers';
import { HexString } from '../models';
import { bufferConcat, hexToBuffer, NeonChainId, numberToBuffer } from '../utils';
import { RlpStructuredData } from 'ethers/src.ts/utils/rlp';

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

  encode(): string {
    const result: string[] = [];
    for (const key of ScheduledTransaction.keys) {
      // @ts-ignore
      result.push(this.data[key]);
    }

    return encodeRlp(result);
  }

  serialize(): HexString {
    const type = numberToBuffer(this.type);
    const subType = numberToBuffer(this.neonSubType);
    const encode = hexToBuffer(this.encode());
    return bufferConcat([type, subType, encode]).toString('hex');
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
