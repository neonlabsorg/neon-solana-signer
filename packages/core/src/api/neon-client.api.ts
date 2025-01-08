import { PublicKey } from '@solana/web3.js';
import { delay, post } from '../utils';
import {
  EmulateTransactionData,
  HolderAccount,
  NeonAddress,
  NeonApiResponse,
  NeonBalance,
  ScheduledTransactionStatus,
  TransactionTreeResponse,
  TransferTreeData
} from '../models';
import { NeonProxyRpcApi } from './neon-proxy-rpc.api';

export class NeonClientApi {
  private url: string;

  async emulate(transaction: EmulateTransactionData, maxStepsToExecute = 500000, provideAccountInfo: any = null): Promise<any> {
    const body = {
      step_limit: maxStepsToExecute,
      tx: transaction,
      accounts: [],
      provide_account_info: provideAccountInfo
    };
    return post(`${this.url}/emulate`, body);
  }

  async getStorageAt(contract: NeonAddress, index: number): Promise<any> {
    const body = { contract, index };
    return post(`${this.url}/storage`, body);
  }

  async getHolder(publicKey: PublicKey): Promise<NeonApiResponse<HolderAccount>> {
    const body = { pubkey: publicKey.toBase58() };
    return post(`${this.url}/holder`, body);
  }

  async getBalance(address: NeonAddress, chainId: number): Promise<NeonApiResponse<NeonBalance>> {
    const body = { account: [{ address, chain_id: chainId }] };
    return post(`${this.url}/balance`, body);
  }

  async transactionTree(origin: TransferTreeData, nonce: number): Promise<NeonApiResponse<TransactionTreeResponse>> {
    const body = { origin, nonce };
    return post(`${this.url}/transaction_tree`, body);
  }

  async waitTransactionTreeExecution(origin: TransferTreeData, nonce: number, timeout: number): Promise<ScheduledTransactionStatus[]> {
    const start = Date.now();
    const result: ScheduledTransactionStatus[] = [];
    while (timeout > Date.now() - start) {
      const { value, status } = await this.transactionTree(origin, nonce);
      const { transactions } = value;
      if (transactions.length > 0) {
        for (const tx of transactions) {
          const index = result.findIndex(i => i.transaction_hash === tx.transaction_hash);
          if (index === -1) {
            result.push(tx);
          } else {
            result[index] = tx;
          }
        }
      } else {
        return result;
      }
      await delay(100);
    }
    return result;
  }

  constructor(url: string) {
    this.url = url;
  }
}
