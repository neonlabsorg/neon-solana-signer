import { PublicKey } from '@solana/web3.js';
import { NeonProxyRpcApi } from '../api';
import { GasToken } from './tokens';

export type RPCUrl = string;
export type UUID = string;

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

export interface ProxyApiState {
  proxyApi: NeonProxyRpcApi;
  proxyStatus: NeonProgramStatus;
  tokensList: GasToken[];
  evmProgramAddress: PublicKey;
}
