import { HexString, TransactionStatus } from './api';

export interface ScheduledTransactionData {
  payer: string;
  sender: string;
  nonce: number | string;
  index: number | string;
  intent: string;
  intentCallData: string;
  target: string;
  callData: string;
  value: number | string;
  chainId: number | string;
  gasLimit: number | string;
  maxFeePerGas: number | string;
  maxPriorityFeePerGas: number | string;
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
