<template>
  <div class="tab-content">
    <form class="form">
      <div class="flex flex-row gap-[8px] items-end mb-[18px]">
        <FormInput
          label="From"
          :value="transfer.from"
          :disabled="true"
          :rightLabel="directionBalance('from')"
        />
        <div>
          <button class="icon-button" type="button" @click="handleTransferDirection"></button>
        </div>
        <FormInput
          label="To"
          :value="transfer.to"
          :disabled="true"
          :rightLabel="directionBalance('to')"
        />
      </div>
      <FormSelect
        label="Token"
        v-model="token"
        :options="tokenOptions"
        :disabled="submitDisable"
      />
      <FormInput
        label="Amount"
        v-model="amount"
        @input="handleAmount"
        placeholder="0"
        :disabled="true"
        :rightLabel="amountView"
      />
      <button
        type="button"
        class="form-button mt-8"
        @click="handleSubmit"
        :disabled="transferDisabled"
      >
        {{ sendText }}
      </button>
    </form>
    <div v-if="log" class="result-log">{{ log }}</div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useWallet } from 'solana-wallets-vue';
import FormInput from '@/components/FormInput.vue';
import FormSelect from '@/components/FormSelect.vue';
import {
  balanceView,
  BIG_ZERO,
  mintTokenBalanceEthers,
  neonBalanceEthers,
  sendSolanaTransaction,
  solanaBalance,
  splTokenBalance,
  tokenList,
  getOrCreateAssociatedTokenAccount,
  estimateFee,
  createAndSendScheduledTransaction
} from '@/utils';
import { TokenBalance, TransferDirection } from '@/models';
import { Big } from 'big.js';
import { useProxyStore } from '@/stores'
import { storeToRefs } from 'pinia'

const proxyStore = useProxyStore();

const { publicKey, signTransaction } = useWallet();
const { solanaUser, proxyRpcApi, chainId, neonEvmProgram, provider, connection } = storeToRefs(proxyStore);

const token = ref<string>('');
const amount = ref<string>('0.1');
const log = ref<string>('');
const loading = ref<boolean>(false);
const submitDisable = ref<boolean>(false);
const tokenBalance = ref<TokenBalance>({
  neon: BIG_ZERO,
  solana: BIG_ZERO,
});
const walletBalance = ref<TokenBalance>({
  neon: BIG_ZERO,
  solana: BIG_ZERO,
});
const transfer = ref<TransferDirection>({
  direction: 'solana',
  from: publicKey?.value?.toBase58() || '',
  to: neonEvmProgram || ''
});

const splToken = computed(() => {
  return tokenList.find(i => i.symbol === token.value);
});

const neonWallet = computed(() => {
  return solanaUser?.neonWallet;
});

onMounted(() => {
  if (publicKey.value) {
    getTokenBalance();
    getWalletBalance();
  }
});

const transferDisabled = computed(() => {
  const balance = tokenBalance.value[transfer.value.direction];
  return !publicKey.value || !neonWallet.value || !token.value || submitDisable.value || balance.lt(new Big(amount.value));
});

const tokenOptions = tokenList.map(i => ({
  value: i.symbol,
  label: `${i.name} (${i.symbol})`
}));

const handleTransferDirection = () => {
  log.value = '';
  const isSolanaDirection = transfer.value.direction === 'solana';
  transfer.value = {
    direction: isSolanaDirection ? 'neon' : 'solana',
    from: isSolanaDirection ? neonWallet.value : (publicKey.value?.toBase58() || ''),
    to: isSolanaDirection ? (publicKey.value?.toBase58() || '') : neonWallet.value
  };
};

const handleAmount = (event: Event) => {
  amount.value = (event.target as HTMLInputElement).value;
  log.value = '';
};

const handleSelect = (event: Event) => {
  token.value = (event.target as HTMLSelectElement).value;
  log.value = '';
};

const directionBalance = (position: 'from' | 'to') => {
  const evmToken = `SOL NeonEVM`;
  const solana = `SOL Solana`;
  if (position === 'from') {
    const token = transfer.value.direction === 'solana' ? solana : evmToken;
    return `${new Big(walletBalance.value[transfer.value.direction].toString()).toFixed(3)} ${token}`;
  }
  const to = transfer.value.direction === 'solana' ? 'neon' : 'solana';
  const token = transfer.value.direction === 'solana' ? evmToken : solana;
  return `${new Big(walletBalance.value[to].toString()).toFixed(3)} ${token}`;
};

const amountView = computed(() => {
  const balance = new Big(tokenBalance.value[transfer.value.direction].toString());
  return `${balance.gt(0) ? balance.toFixed(3) : ''}${splToken.value?.symbol ? ` ${splToken.value.symbol}` : ''}`;
});

const getTokenBalance = async () => {
  if (splToken.value && neonWallet.value) {
    const solana = await splTokenBalance(connection, publicKey.value!, splToken.value);
    const neon = await mintTokenBalanceEthers(neonWallet.value, splToken.value, provider);
    tokenBalance.value = { solana, neon };
    if (solana.eq(0) && transfer.value.direction === 'solana') log.value = `You need to have some ${splToken.value.symbol} on Solana`;
    if (neon.eq(0) && transfer.value.direction === 'neon') log.value = `You need to have some ${splToken.value.symbol} on Neon`;
  }
};

const getWalletBalance = async () => {
  if (neonWallet.value) {
    const solana = await solanaBalance(connection, publicKey.value!);
    const neon = await neonBalanceEthers(provider, neonWallet.value);
    walletBalance.value = { solana, neon };
  }
};

const handleSubmit = async () => {
  if (token.value && splToken.value && solanaUser) {
    loading.value = true;
    submitDisable.value = true;
    try {
      console.log(`Transfer ${amount.value} ${token.value} from Solana to Neon EVM`);
      if (transfer.value.direction === 'solana') {
        // Transfer logic for Solana to Neon
      } else {
        // Transfer logic for Neon to Solana
      }
    } catch (e) {
      log.value = `Transfer failed: \n${e}`;
    }
    loading.value = false;
    submitDisable.value = false;
    await getTokenBalance();
    await getWalletBalance();
  }
};

const sendText = computed(() => loading.value ? 'Wait...' : 'Submit');
</script>
