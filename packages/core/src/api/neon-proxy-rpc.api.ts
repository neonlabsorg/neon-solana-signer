import { PublicKey } from '@solana/web3.js';
import {
  GasToken,
  NeonAddress,
  NeonAddressResponse,
  NeonProgramStatus,
  ProxyApiState,
  RPCResponse,
  RPCUrl
} from '../models';
import { uuid } from '../utils';

export class NeonProxyRpcApi {
  readonly rpcUrl: RPCUrl;

  async evmParams(): Promise<NeonProgramStatus> {
    return this.neonRpc<NeonProgramStatus>('neon_getEvmParams', []).then(({ result }) => result);
  }

  // neon_getAccount
  getAccount(account: string, nonce: number): Promise<RPCResponse<NeonAddressResponse>> {
    return this.neonRpc('neon_getAccount', [account, nonce]);
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

  getTransactionCount(neonWallet: NeonAddress): Promise<string> {
    return this.neonRpc<string>('eth_getTransactionCount', [neonWallet, 'latest']).then(({ result }) => result);
  }

  async neonRpc<T>(method: string, params: unknown[] = []): Promise<RPCResponse<T>> {
    return NeonProxyRpcApi.rpc<T>(this.rpcUrl, method, params);
  }

  static rpc<T>(url: string, method: string, params: unknown[] = []): Promise<RPCResponse<T>> {
    const id = uuid();
    const body = { id, jsonrpc: '2.0', method, params };
    console.log(`curl -H 'Content-Type: application/json' -d '${JSON.stringify(body)}' -X POST ${url}`);
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
