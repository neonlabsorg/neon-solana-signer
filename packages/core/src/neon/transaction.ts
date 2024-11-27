import { decodeRlp, encodeRlp, keccak256, RlpStructuredData, toBeHex } from 'ethers';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { HexString, SolanaTransactionSignature } from '../models';
import { bufferConcat, delay, EVM_STEPS, hexToBuffer, NeonChainId, numberToBuffer } from '../utils';
import {
  createPartialCallOrContinueFromRawEthereumTransaction,
  createScheduledTransactionStartFromAccountTransaction,
  createWriteToHolderAccountInstruction,
  sendSolanaTransaction,
  SolanaNeonAccount,
  TreasuryPoolAddress
} from '../solana';

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

export async function writeTransactionToHoldAccount(connection: Connection, neonEvmProgram: PublicKey, solanaUser: SolanaNeonAccount, holderAddress: PublicKey, scheduledTransaction: ScheduledTransaction): Promise<any> {
  const receipts: Promise<SolanaTransactionSignature>[] = [];
  const scheduledTransactionHash = `0x${scheduledTransaction.serialize()}`;
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
    console.log(signature, blockhash, lastValidBlockHeight);
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
  let done = false;

  while (!done) {
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
    console.log(receipt);
    if (receipt) {
      done = true;
    }
    index += 1;
  }

  return receipt;
}
