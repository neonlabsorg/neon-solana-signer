import { PublicKey } from '@solana/web3.js';
import { NeonProxyRpcApi } from '../api';
import { GasToken } from './token';

export type UUID = string;
export type HexString = `0x${string}` | string;
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
