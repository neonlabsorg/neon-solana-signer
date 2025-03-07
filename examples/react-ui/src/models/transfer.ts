import Big from 'big.js';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  NeonProxyRpcApi,
  SolanaNeonAccount,
  ScheduledTransaction
} from '@neonevm/solana-sign';

export interface TransferDirection {
  direction: 'solana' | 'neon';
  from: string | undefined;
  to: string | undefined;
}

export interface TokenBalance {
  neon: Big;
  solana: Big;
}

export type CreateScheduledTransactionParams = {
  solanaUser: SolanaNeonAccount;
  connection: Connection;
  scheduledTransaction: ScheduledTransaction;
  neonEvmProgram: PublicKey;
  nonce: number;
  chainId: number;
  proxyRpcApi: NeonProxyRpcApi;
  signMethod: any;
}
