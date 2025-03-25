import Big from 'big.js';
import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import {
  NeonProxyRpcApi,
  SolanaNeonAccount,
  ScheduledTransaction
} from '@neonevm/solana-sign';
import type { SignerWalletAdapterProps } from '@solana/wallet-adapter-base';

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
  signMethod: SignerWalletAdapterProps['signTransaction'];
  approveInstruction?: TransactionInstruction;
}
