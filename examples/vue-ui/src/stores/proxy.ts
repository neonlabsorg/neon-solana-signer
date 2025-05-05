import { defineStore } from 'pinia'
import { Connection, PublicKey } from '@solana/web3.js';
import {
  NeonProxyRpcApi,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { JsonRpcProvider } from 'ethers';
import { NEON_CORE_API_RPC_URL, SOLANA_URL } from '@/utils';

type ProxyState = {
  _chainId: number;
  _tokenMint: PublicKey | null;
  _neonEvmProgram: PublicKey | null;
  _solanaUser: SolanaNeonAccount | null;
  _proxyRpcApi: NeonProxyRpcApi | null;
  _provider: JsonRpcProvider;
  _connection: Connection;
}

export default defineStore('proxy-store', {
  state: (): ProxyState => ({
    _chainId: 245022927,
    _tokenMint: null,
    _neonEvmProgram: null,
    _solanaUser: null,
    _proxyRpcApi: null,
    _provider: new JsonRpcProvider(NEON_CORE_API_RPC_URL),
    _connection: new Connection(SOLANA_URL, 'confirmed'),
  }),
  actions: {
    async initProxyData(wallet: PublicKey): Promise<undefined> {
      if (!this._provider) return;
      const proxyApi = new NeonProxyRpcApi(NEON_CORE_API_RPC_URL)
      const { chainId, solanaUser, tokenMintAddress, programAddress } = await proxyApi.init(wallet!)
      this._proxyRpcApi = proxyApi
      this._chainId = chainId
      this._tokenMint = tokenMintAddress
      this._solanaUser = solanaUser
      this._neonEvmProgram = programAddress
    }
  },
  getters: {
    chainId: (state) => state._chainId,
    tokenMint: (state) => state._tokenMint,
    neonEvmProgram: (state) => state._neonEvmProgram,
    solanaUser: (state) => state._solanaUser,
    proxyRpcApi: (state) => state._proxyRpcApi,
    provider: (state) => state._provider,
    connection: (state) => state._connection,
  },
});
