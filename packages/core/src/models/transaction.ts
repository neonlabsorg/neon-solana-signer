import { HexString, TransactionData, TransactionStatus } from './api';
import { Transaction, TransactionInstruction } from '@solana/web3.js';
import { MultipleTransaction, ScheduledTransaction } from '../neon';
import { SolanaNeonAccount } from '../solana';

export interface ScheduledTransactionGas {
  gasLimit?: number;
  maxFeePerGas?: number;
  maxPriorityFeePerGas?: number;
}

export interface ScheduledTransactionData {
  nonce: number | string;
  index: number | string;
  from: string;
  to: string;
  data: string;
  sender: string;
  value: number | string;
  chainId: number | string;
  gasLimit: number | string;
  maxFeePerGas: number | string;
  maxPriorityFeePerGas: number | string;
  intent: string;
  intentCallData: string;
  hash?: string;
}

export interface TransactionByHash {
  blockHash: string | null;
  blockNumber: string | null;
  transactionIndex: string | null;
  hash: string;
  type: string;
  from: string;
  scheduledPayer: string;
  scheduledSolanaPayer: string;
  nonce: string;
  scheduledIndex: string;
  gasPrice: string;
  maxPriorityFeePerGas: string;
  maxFeePerGas: string;
  gas: string;
  to: string;
  value: string;
  input: string;
  chainId: string;
  v: string | null;
  r: string | null;
  s: string | null;
  scheduledSolanaSignature: string;
}

export interface PendingTransaction {
  hash: HexString;
  status: TransactionStatus;
  executionPercentage: HexString;
  age: HexString;
}

export interface PendingTransactions {
  [nonce: string]: PendingTransaction[];
}

export interface TransactionGas {
  gasLimit: number[];
  maxFeePerGas: number;
  maxPriorityFeePerGas: number;
}

export interface CreateScheduledTransaction {
  transactionGas: TransactionGas;
  transactionData: TransactionData;
  solanaInstructions?: TransactionInstruction[];
  solanaUser?: SolanaNeonAccount;
  nonce?: number;
}

export interface CreateMultipleTransaction {
  transactionGas: TransactionGas;
  transactionsData: TransactionData[];
  solanaInstructions?: TransactionInstruction[];
  solanaUser?: SolanaNeonAccount;
  nonce?: number;
  method?: MultipleTransactionType | MultipleTransactionMethod;
}

export const enum MultipleTransactionType {
  Sequential = 0,
  Parallel = 1,
  DependLast = 2
}

export type MultipleTransactionMethod = (data: MultipleTransactionData) => MultipleTransactionResult;

export interface MultipleTransactionData {
  nonce: number;
  chainId: number;
  transactionsData: TransactionData[];
  transactionGas: TransactionGas;
}

export interface MultipleTransactionResult {
  multiple: MultipleTransaction;
  transactions: ScheduledTransaction[];
}

export interface ScheduledTransactionResult {
  scheduledTransaction: Transaction;
  transaction: ScheduledTransaction;
}

export interface ScheduledTransactionsResult {
  scheduledTransaction: Transaction;
  transactions: ScheduledTransaction[];
}
