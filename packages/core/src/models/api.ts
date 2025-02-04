import { PublicKey } from '@solana/web3.js';
import { NeonProxyRpcApi } from '../api';
import { GasToken } from './token';
import { SolanaAccount } from '@neonevm/token-transfer-core';

export type UUID = string;
export type HexString = `0x${string}` | string;
export type PublicKeyString = string;
export type NeonAddress = HexString;
export type SolanaAddress = string;
export type SolanaSignature = string;
export type RPCUrl = string;

export interface RPCResponse<T> {
  id: number | string;
  jsonrpc: string;
  result: T;
  error?: any;
}

/**
 * Represents the status and configuration of the Neon EVM Program.
 * @property {number} neonAccountSeedVersion - The version of the Neon account seed. Used to track different versions of the account format.
 * @property {number} neonMaxEvmStepsInLastIteration - The maximum number of EVM steps allowed in the last iteration of a transaction.
 * @property {number} neonMinEvmStepsInIteration - The minimum number of EVM steps allowed in each iteration of a transaction.
 * @property {number} neonGasLimitMultiplierWithoutChainId - The gas limit multiplier applied when the chain ID is not specified.
 * @property {number} neonHolderMessageSize - The size of the holder message, used to store temporary data during a transaction.
 * @property {number} neonPaymentToTreasury - The amount of payment made to the treasury for a transaction.
 * @property {number} neonStorageEntriesInContractAccount - The number of storage entries allowed in a contract account.
 * @property {number} neonTreasuryPoolCount - The count of treasury pools used in the Neon program.
 * @property {string} neonTreasuryPoolSeed - The seed used for generating treasury pool addresses.
 * @property {string} neonEvmProgramId - The program ID of the Neon EVM program deployed on the blockchain.
 */
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
  transactions: ScheduledTransactionStatusResponse[];
}

export type TransactionStatus = 'NotStarted' | 'InProgress' | 'Success' | 'Empty' | string;

export interface ScheduledTransactionStatusResponse {
  status: TransactionStatus;
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
  contract_solana_address: PublicKeyString;
  trx_count: number;
  balance: HexString;
  user_pubkey?: PublicKeyString;
}

export interface TransferTreeData {
  address: NeonAddress;
  chain_id: number;
}

export interface ScheduledTransactionStatus {
  transactionHash: HexString;
  status: TransactionStatus;
  resultHash: HexString;
  gasLimit: HexString;
  value: HexString;
  childTransactionIndex: HexString;
  successExecutionLimit: HexString;
  parentCount: HexString;
}

export interface ScheduledTreeAccount {
  address: SolanaAddress;
  status: 'Ok' | string;
  activeStatus: TransactionStatus;
  payer: NeonAddress;
  chainId: HexString;
  nonce: HexString;
  lastSlot: HexString;
  maxFeePerGas: HexString;
  maxPriorityFeePerGas: HexString;
  balance: HexString;
  lastIndex: HexString;
  transactions: ScheduledTransactionStatus[];
}

export interface EstimateScheduledTransaction {
  from?: string;
  to: string;
  data: string;
}

export interface EstimatedScheduledGasPayData {
  scheduledSolanaPayer: string;
  transactions: EstimateScheduledTransaction[];
}

export interface EstimatedScheduledGasPayResponse {
  chainId: HexString;
  maxFeePerGas: HexString;
  maxPriorityFeePerGas: HexString;
  nonce: HexString;
  treasuryIndex: HexString;
  accountList: SolanaAccount[],
  gasList: HexString[]
}
