<template>
  <div class="form-content">
    <h1 class="title-1">
      <i class="logo"></i>
      <div class="flex flex-row items-center justify-between w-full">
        <span class="text-[24px]">Solana native</span>
      </div>
      <a
        href="https://github.com/neonlabsorg/neon-solana-signer/tree/main/examples/react-ui"
        target="_blank" rel="noreferrer">
        <i class="github"></i>
      </a>
    </h1>
    <div class="mb-[20px]">
      <div class="connect-button">
        <wallet-multi-button dark></wallet-multi-button>
      </div>
      <TabsComponent className='mt-10' :tabs="tabsData" :defaultTab="0" />
    </div>
  </div>
</template>

<script setup lang="ts">
import TabsComponent from './components/TabsComponent.vue';
import TokenTransfer from './components/transactions/TokenTransfer.vue';
import SimpleTransaction from './components/transactions/SimpleTransaction.vue';
import { WalletMultiButton } from "solana-wallets-vue";
import { useWallet } from 'solana-wallets-vue';
import { watch } from 'vue';
import { useProxyStore } from '@/stores'

const proxyStore = useProxyStore()
const { publicKey } = useWallet();

const tabsData = [
  {
    label: 'Simple transaction',
    content: SimpleTransaction
  },
  {
    label: 'Token transfer',
    content: TokenTransfer
  }
];

watch(publicKey, () => {
  if(publicKey.value) {
    proxyStore.initProxyData(publicKey.value);
  }
})
</script>
