import { PublicKey } from '@solana/web3.js';
import build from 'fetch-retry';
import { JsonRpcProvider } from 'ethers';
import {
  BlockByNumber,
  EstimatedScheduledGasPayData,
  EstimatedScheduledGasPayResponse,
  GasToken,
  HexString,
  MaxFeePerGas,
  NeonAddress,
  NeonAddressResponse,
  NeonGasPrice,
  NeonProgramStatus,
  NeonProxyRpcOptions,
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
import { delay, getGasToken, log, prepareHeaders, uuid } from '../utils';
import { MAX_PRIORITY_FEE_PER_GAS_DEFAULT } from '../neon';

const neonProxyRpcOptionsDefault: NeonProxyRpcOptions = {
  showRequestLog: true,
  space: undefined
};

export class NeonProxyRpcApi {
  readonly rpcUrl: RPCUrl;
  private readonly options?: NeonProxyRpcOptions;

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

  maxPriorityFeePerGas(): Promise<RPCResponse<HexString>> {
    return this.neonRpc(`eth_maxPriorityFeePerGas`, []);
  }

  getBlockByNumber(block: HexString, detail = false): Promise<RPCResponse<BlockByNumber>> {
    return this.neonRpc(`eth_getBlockByNumber`, [block, detail]);
  }

  async getMaxFeePerGas(): Promise<MaxFeePerGas> {
    const { result: maxPriorityFeePerGasHex } = await this.maxPriorityFeePerGas();
    const { result } = await this.getBlockByNumber(`latest`, false);
    const a = parseInt(maxPriorityFeePerGasHex, 16);
    const b = MAX_PRIORITY_FEE_PER_GAS_DEFAULT;
    const maxPriorityFeePerGas = a > b ? a : b;
    const maxFeePerGas = Math.floor(parseInt(result.baseFeePerGas, 16) * 1.5 + maxPriorityFeePerGas);
    return { maxPriorityFeePerGas, maxFeePerGas };
  }

  ethGetTransactionReceipt(transaction: HexString): Promise<any> {
    return this.neonRpc<string>('eth_getTransactionReceipt', [transaction]);
  }

  async neonRpc<T>(method: string, params: unknown[] = []): Promise<RPCResponse<T>> {
    return NeonProxyRpcApi.rpc<T>(this.rpcUrl, method, params, this.options);
  }

  static async rpc<T>(url: string, method: string, params: unknown[] = [], options?: NeonProxyRpcOptions): Promise<RPCResponse<T>> {
    const id = uuid();
    const [headers, headersString] = prepareHeaders({});
    const body = JSON.stringify({ id, jsonrpc: '2.0', method, params }, null, options?.space);
    const fetchData: RequestInit = {
      headers,
      body,
      method: 'POST',
      mode: 'cors'
    };
    if (options?.showRequestLog) {
      log(`curl ${url} -X POST ${headersString} -d '${body}' | jq .`);
    }
    const retry = build(fetch, { retries: 5, retryDelay: 1e3 });
    const response = await retry(url, fetchData);
    const result = await response.text();
    return JSON.parse(result);
  }

  constructor(url: RPCUrl, options: NeonProxyRpcOptions = {}) {
    this.rpcUrl = url;
    this.options = { ...neonProxyRpcOptionsDefault, ...options };
  }
}

export async function getProxyState(proxyUrl: string, options: NeonProxyRpcOptions = {}): Promise<ProxyApiState> {
  const provider = new JsonRpcProvider(proxyUrl);
  const proxyApi = new NeonProxyRpcApi(proxyUrl, options);
  const proxyStatus = await proxyApi.evmParams();
  const tokensList = await proxyApi.nativeTokenList();
  const { chainId } = await provider.getNetwork();
  const evmProgramAddress = new PublicKey(proxyStatus.neonEvmProgramId);
  const gasToken = getGasToken(tokensList, Number(chainId));
  return { proxyApi, provider, chainId: Number(chainId), proxyStatus, gasToken, tokensList, evmProgramAddress };
}
