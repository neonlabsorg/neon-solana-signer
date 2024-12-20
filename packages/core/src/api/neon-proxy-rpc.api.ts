import { PublicKey } from '@solana/web3.js';
import {
  GasToken,
  HexString,
  NeonAddress,
  NeonAddressResponse,
  NeonGasPrice,
  NeonProgramStatus,
  ProxyApiState,
  RPCResponse,
  RPCUrl
} from '../models';
import { log, uuid } from '../utils';

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

  async sendRawScheduledTransactions(transactions: HexString[]): Promise<RPCResponse<HexString>[]> {
    const result: RPCResponse<HexString>[] = [];
    for (const transaction of transactions) {
      result.push(await this.sendRawScheduledTransaction(transaction));
    }
    return result;
  }

  getPendingTransactions(solanaWallet: PublicKey): Promise<RPCResponse<any>> {
    return this.neonRpc<string>('neon_getPendingTransactions', [solanaWallet.toBase58()]);
  }

  getTransactionCount(neonWallet: NeonAddress): Promise<string> {
    return this.neonRpc<string>('eth_getTransactionCount', [neonWallet, 'latest']).then(({ result }) => result);
  }

  getTransactionByHash(transaction: HexString): Promise<RPCResponse<any>> {
    return this.neonRpc<string>('eth_getTransactionByHash', [transaction]);
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
    return fetch(url, {
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
