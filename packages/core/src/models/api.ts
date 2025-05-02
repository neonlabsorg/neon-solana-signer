import { PublicKey } from '@solana/web3.js';
import { JsonRpcProvider } from 'ethers';
import { SolanaNeonAccount } from '../solana';
import { NeonProxyRpcApi } from '../api';
import { GasToken, GasTokenData } from './token';
import { SolanaAccount } from './account';

export type UUID = string;
export type HexString = `0x${string}` | string;
export type Bs58String = string;
export type PublicKeyString = string;
export type NeonAddress = HexString;
export type SolanaAddress = string;
export type SolanaSignature = string;
export type RPCUrl = string;

export interface NeonProxyRpcOptions {
  space?: string | number;
  showRequestLog?: boolean;
  retries?: number;
  retryDelay?: number;
}

export interface NeonProxyRpcInitData {
  chainId: number;
  programAddress: PublicKey;
  tokenMintAddress: PublicKey;
  params: NeonEvmParams;
  provider: JsonRpcProvider;
  solanaUser: SolanaNeonAccount;
}

export interface RPCResponse<T> {
  id: number | string;
  jsonrpc: string;
  result: T;
  error?: any;
}

export interface RPCRequest {
  id: number | string;
  method: string;
  jsonrpc: string;
  params: unknown[];
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
export interface NeonEvmParams {
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
export type NeonProgramStatus = NeonEvmParams;

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
  provider: JsonRpcProvider;
  chainId: number;
  proxyStatus: NeonProgramStatus;
  tokensList: GasToken[];
  gasToken: GasTokenData;
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

export type TransactionStatus = 'NotStarted' | 'InProgress' | 'Success' | 'Empty' | 'Failed' | 'Skipped' | string;

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

export interface TransactionData {
  from?: HexString;
  to: HexString;
  data: HexString;
  childTransaction?: HexString;
}

export interface SolanaAccountData {
  address: SolanaAddress;
  isSigner: boolean;
  isWritable: boolean;
}

export interface PreparatorySolanaInstruction {
  programId: SolanaAddress;
  accounts: SolanaAccountData[];
  data: Bs58String;
}

export interface PreparatorySolanaTransaction {
  instructions: PreparatorySolanaInstruction[];
}

export interface EstimatedScheduledGasPayData {
  solanaPayer: PublicKey;
  transactions: TransactionData[];
  preparatorySolanaTransactions?: PreparatorySolanaTransaction[];
}

export interface EstimatedScheduledGasPayResponse {
  chainId: HexString;
  maxFeePerGas: HexString;
  maxPriorityFeePerGas: HexString;
  nonce: HexString;
  treasuryIndex: HexString;
  accountList: SolanaAccount[];
  gasList: HexString[];
}

export interface BlockByNumber {
  logsBloom: HexString;
  transactionsRoot: HexString;
  receiptsRoot: HexString;
  stateRoot: HexString;
  sha3Uncles: HexString;
  difficulty: HexString;
  totalDifficulty: HexString;
  extraData: HexString;
  miner: HexString;
  nonce: HexString;
  mixHash: HexString;
  size: HexString;
  gasLimit: HexString;
  gasUsed: HexString;
  baseFeePerGas: HexString;
  hash: HexString;
  number: HexString;
  parentHash: HexString;
  timestamp: HexString;
  uncles: HexString[];
  transactions: any[];
}

export interface MaxFeePerGas {
  maxPriorityFeePerGas: number;
  maxFeePerGas: number;
}
