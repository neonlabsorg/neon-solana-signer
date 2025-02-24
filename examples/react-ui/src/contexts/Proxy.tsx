import { createContext, FC, useContext, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  getGasToken,
  getProxyState,
  NeonProxyRpcApi,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { JsonRpcProvider } from 'ethers';
import { NEON_CORE_API_RPC_URL } from '../utils';
import { Props } from '../models';

export interface ProxyContextData {
  chainId: number;
  tokenMint: PublicKey;
  neonEvmProgram: PublicKey;
  solanaUser: SolanaNeonAccount;
  proxyRpcApi: NeonProxyRpcApi;
  provider: JsonRpcProvider;
  connection: Connection;
}

export const ProxyContext = createContext<ProxyContextData>({} as ProxyContextData);
export const ProxyContextProvider: FC<Props> = ({ children }) => {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const [neonEvmProgram, setEvmProgramAddress] = useState<PublicKey>();
  const [proxyRpcApi, setProxyRpcApi] = useState<NeonProxyRpcApi>();
  const [tokenMint, setTokenMint] = useState<PublicKey>();
  const [chainId, setChainId] = useState<number>();

  const solanaUser = useMemo<SolanaNeonAccount | undefined>(() => {
    if (connected && publicKey && neonEvmProgram && tokenMint && chainId) {
      return new SolanaNeonAccount(publicKey, neonEvmProgram, tokenMint, chainId);
    }
  }, [connected, publicKey, neonEvmProgram, tokenMint, chainId]);

  const provider = useMemo<JsonRpcProvider>(() => {
    return new JsonRpcProvider(NEON_CORE_API_RPC_URL);
  }, []);

  useEffect(() => {
    (async () => {
      const { chainId: id } = await provider.getNetwork();
      const { evmProgramAddress, proxyApi, tokensList } = await getProxyState(NEON_CORE_API_RPC_URL);
      setEvmProgramAddress(evmProgramAddress);
      setProxyRpcApi(proxyApi);
      setChainId(Number(id));
      const token = getGasToken(tokensList, Number(id));
      setTokenMint(token.tokenMintAddress);
    })();
  }, [provider]);

  return (
    <ProxyContext.Provider value={{
      chainId: chainId!,
      tokenMint: tokenMint!,
      neonEvmProgram: neonEvmProgram!,
      solanaUser: solanaUser!,
      proxyRpcApi: proxyRpcApi!,
      provider,
      connection
    }}>
      {children}
    </ProxyContext.Provider>
  );
};

export const useProxyContext = () => useContext(ProxyContext);
