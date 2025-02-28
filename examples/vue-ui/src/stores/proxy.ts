import { defineStore } from 'pinia'
import { Connection, PublicKey } from '@solana/web3.js';
import {
  getGasToken,
  getProxyState,
  NeonProxyRpcApi,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { JsonRpcProvider } from 'ethers';
import { toRaw } from 'vue';
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
      const { chainId: id } = await toRaw(this._provider)?.getNetwork();
      const { evmProgramAddress, proxyApi, tokensList } = await getProxyState(NEON_CORE_API_RPC_URL);
      this._neonEvmProgram = evmProgramAddress;
      this._proxyRpcApi = proxyApi;
      this._chainId = Number(id);
      const token = getGasToken(tokensList, this._chainId);
      this._tokenMint = token.tokenMintAddress;
      this._solanaUser = new SolanaNeonAccount(wallet, evmProgramAddress, token.tokenMintAddress, this._chainId);
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
