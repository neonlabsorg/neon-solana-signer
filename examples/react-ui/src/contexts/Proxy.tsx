import { createContext, FC, useContext, useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey } from '@solana/web3.js'
import { NeonProxyRpcApi, SolanaNeonAccount } from '@neonevm/solana-sign'
import { JsonRpcProvider } from 'ethers'
import { NEON_CORE_API_RPC_URL } from '../utils'
import { Props } from '../models'

export interface ProxyContextData {
  chainId: number;
  tokenMint: PublicKey;
  neonEvmProgram: PublicKey;
  solanaUser: SolanaNeonAccount;
  proxyRpcApi: NeonProxyRpcApi;
  provider: JsonRpcProvider;
  connection: Connection;
}

export const ProxyContext = createContext<ProxyContextData>({} as ProxyContextData)
export const ProxyContextProvider: FC<Props> = ({ children }) => {
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const [neonEvmProgram, setEvmProgramAddress] = useState<PublicKey>()
  const [proxyRpcApi, setProxyRpcApi] = useState<NeonProxyRpcApi>()
  const [tokenMint, setTokenMint] = useState<PublicKey>()
  const [provider, setProvider] = useState<JsonRpcProvider>()
  const [solanaUser, setSolanaUser] = useState<SolanaNeonAccount>()
  const [chainId, setChainId] = useState<number>()

  useEffect(() => {
    (async () => {
      const proxyApi = new NeonProxyRpcApi(NEON_CORE_API_RPC_URL)
      const { chainId, provider, solanaUser, tokenMintAddress, programAddress } = await proxyApi.init(publicKey!)
      setProvider(provider)
      setSolanaUser(solanaUser)
      setEvmProgramAddress(programAddress)
      setProxyRpcApi(proxyApi)
      setChainId(Number(chainId))
      setTokenMint(tokenMintAddress)
    })()
  }, [publicKey])

  return (
    <ProxyContext.Provider value={{
      chainId: chainId!,
      tokenMint: tokenMint!,
      neonEvmProgram: neonEvmProgram!,
      solanaUser: solanaUser!,
      proxyRpcApi: proxyRpcApi!,
      provider: provider!,
      connection
    }}>
      {children}
    </ProxyContext.Provider>
  )
}

export const useProxyContext = () => useContext(ProxyContext)
