import { PublicKey } from '@solana/web3.js';
import build from 'fetch-retry';
import {
  EstimatedScheduledGasPayData,
  EstimatedScheduledGasPayResponse,
  GasToken,
  HexString,
  NeonAddress,
  NeonAddressResponse,
  NeonGasPrice,
  NeonProgramStatus,
  PendingTransactions,
  ProxyApiState,
  RPCResponse,
  RPCUrl,
  ScheduledTransactionStatus,
  ScheduledTreeAccount,
  SolanaAddress,
  SolanaSignature,
  TransactionByHash
} from '../models';
import { delay, log, uuid } from '../utils';

export class NeonProxyRpcApi {
  readonly rpcUrl: RPCUrl;

  async evmParams(): Promise<NeonProgramStatus> {
    return this.neonRpc<NeonProgramStatus>('neon_getEvmParams', []).then(({ result }) => result);
  }

  getAccount(account: NeonAddress, nonce: number): Promise<RPCResponse<NeonAddressResponse>> {
    return this.neonRpc('neon_getAccount', [account, nonce]);
  }

  getTransactionReceipt(transactionHash: string): Promise<RPCResponse<any>> {
    return this.neonRpc('neon_getTransactionReceipt', [transactionHash]);
  }

  gasPrice(): Promise<RPCResponse<NeonGasPrice>> {
    return this.neonRpc('neon_gasPrice', []);
  }

  async nativeTokenList(): Promise<GasToken[]> {
    return this.neonRpc<GasToken[]>('neon_getNativeTokenList', []).then(({ result }) => result);
  }

  sendRawScheduledTransaction(transaction: HexString): Promise<RPCResponse<HexString>> {
    return this.neonRpc<string>('neon_sendRawScheduledTransaction', [transaction]);
  }

  getNeonTransactionByAddress(pubkey: PublicKey): Promise<RPCResponse<HexString>> {
    return this.neonRpc<string>('neon_getTransactionByHash', [pubkey.toBase58()]);
  }

  estimateScheduledTransaction(transaction: HexString): Promise<RPCResponse<HexString>> {
    return this.neonRpc<string>('neon_estimateScheduledTransaction', [transaction]);
  }

  async sendRawScheduledTransactions(transactions: HexString[]): Promise<RPCResponse<HexString>[]> {
    const result: RPCResponse<HexString>[] = [];
    for (const transaction of transactions) {
      result.push(await this.sendRawScheduledTransaction(transaction));
    }
    return result;
  }

  getPendingTransactions(solanaWallet: PublicKey): Promise<RPCResponse<PendingTransactions>> {
    return this.neonRpc<PendingTransactions>('neon_getPendingTransactions', [solanaWallet.toBase58()]);
  }

  getTransactionCount(neonWallet: NeonAddress): Promise<string> {
    return this.neonRpc<string>('eth_getTransactionCount', [neonWallet, 'latest']).then(({ result }) => result);
  }

  getTransactionByHash(signature: SolanaSignature): Promise<RPCResponse<TransactionByHash>> {
    return this.neonRpc<TransactionByHash>('eth_getTransactionByHash', [signature]);
  }

  async waitTransactionByHash(signature: string, duration: number, delayTimeout = 300): Promise<TransactionByHash | null> {
    const start = Date.now();
    while (duration > Date.now() - start) {
      const { result } = await this.getTransactionByHash(signature);
      if (result?.hash) {
        return result;
      }
      await delay(delayTimeout);
    }
    return null;
  }

  async waitTransactionTreeExecution(address: NeonAddress | SolanaAddress, nonce: number, duration: number, delayTimeout = 300): Promise<ScheduledTransactionStatus[]> {
    const start = Date.now();
    const trx: ScheduledTransactionStatus[] = [];
    while (duration > Date.now() - start) {
      const { result } = await this.getScheduledTreeAccount(address, nonce);
      if (!result) {
        return trx;
      }
      const { transactions } = result;
      if (result?.activeStatus) {
        for (const tx of transactions) {
          const index = trx.findIndex(i => i.transactionHash === tx.transactionHash);
          if (index === -1) {
            trx.push(tx);
          } else {
            trx[index] = tx;
          }
        }
        if (['Success', 'Empty', 'Failed'].includes(result.activeStatus)) {
          return trx;
        }
      }
      await delay(delayTimeout);
    }
    return trx;
  }

  getScheduledTreeAccount(address: NeonAddress | SolanaAddress, nonce: number): Promise<RPCResponse<ScheduledTreeAccount | null>> {
    return this.neonRpc<ScheduledTreeAccount | null>('neon_getScheduledTreeAccount', [address, nonce, 'latest']);
  }

  estimateScheduledGas(data: EstimatedScheduledGasPayData): Promise<RPCResponse<EstimatedScheduledGasPayResponse>> {
    return this.neonRpc<EstimatedScheduledGasPayResponse>('neon_estimateScheduledGas', [data]);
  }

  ethGetTransactionReceipt(transaction: HexString): Promise<any> {
    return this.neonRpc<string>('eth_getTransactionReceipt', [transaction]);
  }

  async neonRpc<T>(method: string, params: unknown[] = []): Promise<RPCResponse<T>> {
    return NeonProxyRpcApi.rpc<T>(this.rpcUrl, method, params);
  }

  static rpc<T>(url: string, method: string, params: unknown[] = []): Promise<RPCResponse<T>> {
    const id = uuid();
    const body = { id, jsonrpc: '2.0', method, params };
    log(`curl ${url} -X POST -H 'Content-Type: application/json' -d '${JSON.stringify(body)}' | jq .`);
    const retry = build(fetch, { retries: 5, retryDelay: 1e3 });
    return retry(url, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(body)
    }).then(r => r.json());
  }

  constructor(url: RPCUrl) {
    this.rpcUrl = url;
  }
}

export async function getProxyState(proxyUrl: string): Promise<ProxyApiState> {
  const proxyApi = new NeonProxyRpcApi(proxyUrl);
  const proxyStatus = await proxyApi.evmParams();
  const tokensList = await proxyApi.nativeTokenList();
  const evmProgramAddress = new PublicKey(proxyStatus.neonEvmProgramId);
  return { proxyApi, proxyStatus, tokensList, evmProgramAddress };
}
