import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { FC, useMemo } from 'react';
import { SOLANA_URL } from '../../utils';
import { Props } from '../../models';

import '@solana/wallet-adapter-react-ui/styles.css';
import { ProxyContextProvider } from '../../contexts/Proxy.tsx';

export const SolanaWalletProvider: FC<Props> = ({ children }) => {
  const endpoint = SOLANA_URL;
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <ProxyContextProvider>
            {children}
          </ProxyContextProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
