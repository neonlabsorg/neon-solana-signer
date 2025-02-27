<template>
  <div class="tab-content">
    <form class="form mb-[20px]">
      <div class="form-label pb-4">
        <label>Current count: <span class="font-bold text-xl">{{ count }}</span></label>
      </div>
      <button
        type="button"
        class="form-button"
        @click="handleTransaction('increase')"
        :disabled="disabled || loadingAction"
      >
        {{ getButtonText('increase') }}
      </button>
      <button
        type="button"
        class="form-button"
        @click="handleTransaction('clear')"
        :disabled="disabled || loadingAction || count === 0"
      >
        {{ getButtonText('clear') }}
      </button>
    </form>
    <div v-if="responseLog" class="result-log">{{ responseLog }}</div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useWallet } from 'solana-wallets-vue';
import { ScheduledTransaction } from '@neonevm/solana-sign';
import { useProxyStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { CounterContract, createAndSendScheduledTransaction, estimateFee } from '@/utils';

const proxyStore = useProxyStore();

const loadingAction = ref<string | null>(null);
const responseLog = ref<string>('');
const count = ref<number>(0);

const { publicKey, signTransaction } = useWallet();
const { solanaUser, proxyRpcApi, chainId, neonEvmProgram, connection, provider } = storeToRefs(proxyStore);

const counterContract = computed(() => new CounterContract(provider));

const getCount = async () => {
  const counter = await counterContract.value.getCount();
  count.value = counter;
};

onMounted(() => {
  if (provider) {
    getCount();
  }
});

const handleTransaction = async (action: string) => {
  responseLog.value = '';
  if (publicKey.value && solanaUser && signTransaction) {
    loadingAction.value = action;
    const nonce = Number(await proxyRpcApi.getTransactionCount(solanaUser.neonWallet));

    const data = counterContract.value.transactionData(action);

    const { maxPriorityFeePerGas, gasLimit, maxFeePerGas } = await estimateFee(proxyRpcApi, solanaUser, data, counterContract.value.address);

    const scheduledTransaction = new ScheduledTransaction({
      nonce,
      payer: solanaUser.neonWallet,
      target: counterContract.value.address,
      callData: data,
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit,
      chainId,
    });

    try {
      const txLog = await createAndSendScheduledTransaction({
        chainId,
        scheduledTransaction,
        neonEvmProgram,
        proxyRpcApi,
        solanaUser,
        nonce,
        connection,
        signMethod: signTransaction,
      });
      responseLog.value = txLog;
      await getCount();
    } catch (e: unknown) {
      console.log(e);
      responseLog.value = JSON.stringify(e, null, '  ');
    }
  }
  loadingAction.value = null;
};

const getButtonText = (action: string) => {
  return loadingAction.value === action ? 'Wait...' : `Send ${action} transaction`;
};

const disabled = computed(() => !publicKey.value);
</script>
