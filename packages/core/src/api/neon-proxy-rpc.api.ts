import { PublicKey } from '@solana/web3.js';
import { GasToken, NeonProgramStatus, ProxyApiState, RPCResponse, RPCUrl } from '../models';
import { uuid } from '../utils';

export class NeonProxyRpcApi {
  readonly rpcUrl: RPCUrl;

  async evmParams(): Promise<NeonProgramStatus> {
    return this.neonRpc<NeonProgramStatus>('neon_getEvmParams', []).then(({ result }) => result);
  }

  // neon_getAccount
  getAccount(): Promise<RPCResponse<any>> {
    return this.neonRpc('neon_getAccount', []);
  }

  // neon_getTransactionReceipt
  getTransactionReceipt(): Promise<RPCResponse<any>> {
    return this.neonRpc('neon_getTransactionReceipt', []);
  }

  // neon_gasPrice
  gasPrice(): Promise<RPCResponse<any>> {
    return this.neonRpc('neon_gasPrice', []);
  }

  async nativeTokenList(): Promise<GasToken[]> {
    return this.neonRpc<GasToken[]>('neon_getNativeTokenList', []).then(({ result }) => result);
  }

  async neonRpc<T>(method: string, params: unknown[] = []): Promise<RPCResponse<T>> {
    return NeonProxyRpcApi.rpc<T>(this.rpcUrl, method, params);
  }

  static async rpc<T>(url: string, method: string, params: unknown[] = []): Promise<RPCResponse<T>> {
    const id = uuid();
    const body = { id, jsonrpc: '2.0', method, params };
    console.log('POST', url, JSON.stringify(body));
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(body)
    });
    return await response.json();
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
