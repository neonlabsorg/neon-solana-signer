import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SolanaWalletProvider } from './components/Wallet/WalletProvider.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SolanaWalletProvider>
      <App />
    </SolanaWalletProvider>
  </StrictMode>,
)
