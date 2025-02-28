import './assets/main.css'
import "solana-wallets-vue/styles.css";

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import SolanaWallets from "solana-wallets-vue";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { initWallet } from "solana-wallets-vue";

import App from './App.vue'

const walletOptions = {
  wallets: [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter({ network: WalletAdapterNetwork.Devnet }),
  ],
  autoConnect: true,
};

const app = createApp(App)

app.use(SolanaWallets, walletOptions);
app.use(createPinia())

initWallet(walletOptions);

app.mount('#app')
