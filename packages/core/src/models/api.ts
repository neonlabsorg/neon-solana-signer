import { PublicKey } from '@solana/web3.js';
import { NeonProxyRpcApi } from '../api';
import { GasToken } from './token';

export type UUID = string;
export type HexString = `0x${string}` | string;
export type PublicKeyString = string;
export type NeonAddress = HexString;
export type SolanaAddress = string;
export type RPCUrl = string;

export interface RPCResponse<T> {
  id: number | string;
  jsonrpc: string;
  result: T;
}

export interface NeonProgramStatus {
  neonAccountSeedVersion: number;
  neonMaxEvmStepsInLastIteration: number;
  neonMinEvmStepsInIteration: number;
  neonGasLimitMultiplierWithoutChainId: number;
  neonHolderMessageSize: number;
  neonPaymentToTreasury: number;
  neonStorageEntriesInContractAccount: number;
  neonTreasuryPoolCount: number;
  neonTreasuryPoolSeed: string;
  neonEvmProgramId: string;
}

export interface NeonAddressResponse {
  status: 'ok' | 'error';
  address: NeonAddress;
  transactionCount: HexString;
  balance: HexString;
  chainId: HexString;
  solanaAddress: SolanaAddress;
  contractSolanaAddress: SolanaAddress;
}

export interface ProxyApiState {
  evmProgramAddress: PublicKey;
  proxyApi: NeonProxyRpcApi;
  proxyStatus: NeonProgramStatus;
  tokensList: GasToken[];
}

export interface NeonGasPrice {
  tokenName: string;
  isConstGasPrice: boolean;
  chainId: HexString;
  gasPrice: HexString;
  suggestedGasPrice: HexString;
  minAcceptableGasPrice: HexString;
  minExecutableGasPrice: HexString;
  chainTokenPriceUsd: HexString;
  tokenPriceUsd: HexString;
  operatorFee: HexString;
  priorityFee: HexString;
  solanaCUPriorityFee: HexString;
  solanaSimpleCUPriorityFee: HexString;
  minWoChainIDAcceptableGasPrice: HexString;
}

export interface NeonApiResponse<T> {
  status: 'Ok' | 'Error' | 'Empty' | string;
  value: T;
}

export interface TransactionTreeResponse {
  status: 'Ok';
  pubkey: string;
  payer: NeonAddress;
  last_slot: number;
  chain_id: number;
  max_fee_per_gas: HexString;
  max_priority_fee_per_gas: HexString;
  balance: HexString;
  last_index: number;
  transactions: ScheduledTransactionStatus[];
}

export interface ScheduledTransactionStatus {
  status: 'NotStarted' | 'InProgress' | 'Success' | string;
  result_hash: HexString;
  transaction_hash: HexString;
  gas_limit: HexString;
  value: HexString;
  child_transaction: number;
  success_execute_limit: number;
  parent_count: number;
}

export interface EmulateTransactionData {
  sender: NeonAddress;
  contract: NeonAddress;
  data: HexString;
  chainId: Number;
  value: HexString;
}

export interface HolderAccount {
  status: 'Holder' | string;
  len: number,
  owner: PublicKeyString;
  tx: HexString;
  tx_type: number;
  steps_executed: number;
}

export interface NeonBalance {
  status: 'Empty' | string;
  solana_address: PublicKeyString;
  contract_solana_address: PublicKeyString; // 'AFswRbPEaaeqPKehEVMajoJqfaJLxj8U5WJQEnscB3Bp',
  trx_count: number;
  balance: HexString;
  user_pubkey?: PublicKeyString;
}
