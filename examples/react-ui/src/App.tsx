import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { solanaAirdrop } from '@neonevm/solana-sign';
import SolanaNativeTransferApp from './Transfer.tsx';
import SolanaNativeSimpleTransaction from './SimpleTransaction.tsx';
import { useProxyContext } from './contexts/Proxy.tsx';
import { Tabs } from './components/Tabs/Tabs.tsx';
import './App.css';

function SolanaNativeApp() {
  const { connected, publicKey } = useWallet();
  const { connection } = useProxyContext();

  const tabsData = [
    {
      label: 'Simple transaction',
      content: <SolanaNativeSimpleTransaction />
    },
    {
      label: 'Token transfer',
      content: <SolanaNativeTransferApp />
    }
  ];

  useEffect(() => {
    (async () => {
      if (connected && publicKey) {

        try {
          console.log('Solana Airdrop');
          await solanaAirdrop(connection, publicKey, 1e9);
        } catch (e) {
          console.error('Can\'t airdrop SOL: ', e);
        }
      }
    })();
  }, [publicKey, connected, connection]);

  return (
    <div className="form-content">
      <h1 className="title-1">
        <i className="logo"></i>
        <div className="flex flex-row items-center justify-between w-full">
          <span className="text-[24px]">Solana native</span>
        </div>
        <a
          href="https://github.com/neonlabsorg/neon-solana-signer/tree/main/examples/react-ui"
          target="_blank" rel="noreferrer">
          <i className="github"></i>
        </a>
      </h1>
      <div className="mb-[20px]">
        <div>
          <WalletMultiButton />
        </div>
        <Tabs className='mt-10' tabs={tabsData} defaultTab={0} />
      </div>
    </div>
  );
}

export default SolanaNativeApp;
