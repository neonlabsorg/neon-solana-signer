<template>
  <div class="tab-content">
    <form class="form mb-[20px]">
      <div class="form-label pb-4">
        <label
          >Current count: <span class="font-bold text-xl">{{ count }}</span></label
        >
      </div>
      <button
        type="button"
        class="form-button"
        @click="handleTransaction('increase')"
        :disabled="disabled || !!loadingAction"
      >
        {{ getButtonText('increase') }}
      </button>
      <button
        type="button"
        class="form-button"
        @click="handleTransaction('clear')"
        :disabled="disabled || !!loadingAction || count === 0"
      >
        {{ getButtonText('clear') }}
      </button>
    </form>
    <div v-if="responseLog" class="result-log">{{ responseLog }}</div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, toRaw } from 'vue'
import { useWallet } from 'solana-wallets-vue'
import { NeonProxyRpcApi, SolanaNeonAccount } from '@neonevm/solana-sign'
import type { TransactionData } from '@neonevm/solana-sign'
import { useProxyStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { CounterContract, createAndSendScheduledTransaction } from '@/utils'
import { JsonRpcProvider } from 'ethers'
import { Connection, PublicKey } from '@solana/web3.js'

const proxyStore = useProxyStore()

const loadingAction = ref<string | null>(null)
const responseLog = ref<string>('')
const count = ref<number>(0)

const { publicKey, signTransaction } = useWallet()
const { solanaUser, proxyRpcApi, chainId, neonEvmProgram, connection, provider } =
  storeToRefs(proxyStore)

const counterContract = computed(() => {
  const rawProvider = toRaw(provider.value)
  if (rawProvider && rawProvider instanceof JsonRpcProvider) {
    return new CounterContract(rawProvider)
  } else {
    throw new Error('Invalid provider type')
  }
})

const getCount = async () => {
  count.value = await counterContract.value.getCount()
}

onMounted(() => {
  if (provider) {
    getCount()
  }
})

const handleTransaction = async (action: string) => {
  responseLog.value = ''
  if (publicKey.value && solanaUser.value && signTransaction.value) {
    loadingAction.value = action
    const nonce = Number(await proxyRpcApi.value?.getTransactionCount(solanaUser.value.neonWallet))

    const data = counterContract.value.transactionData(action)

    const rawProxyApi = toRaw(proxyRpcApi.value)

    const transactionData: TransactionData = {
      from: solanaUser.value.neonWallet,
      to: counterContract.value.address,
      data: data
    }

    const transactionGas = await rawProxyApi?.estimateScheduledTransactionGas({
      solanaPayer: solanaUser.value.publicKey,
      transactions: [transactionData]
    })

    const { transaction } = await rawProxyApi?.createScheduledTransaction({
      transactionGas,
      transactionData
    })

    try {
      responseLog.value = await createAndSendScheduledTransaction({
        chainId: chainId.value,
        scheduledTransaction: transaction,
        neonEvmProgram: <PublicKey>neonEvmProgram.value,
        proxyRpcApi: <NeonProxyRpcApi>proxyRpcApi.value,
        solanaUser: <SolanaNeonAccount>solanaUser.value,
        nonce,
        connection: <Connection>connection.value,
        signMethod: signTransaction.value,
      })
      await getCount()
    } catch (e: unknown) {
      console.log(e)
      responseLog.value = `Something went wrong. Error: ${JSON.stringify(e, null, '  ')}`
    }
  }
  loadingAction.value = null
}

const getButtonText = (action: string) => {
  return loadingAction.value === action ? 'Wait...' : `Send ${action} transaction`
}

const disabled = computed(() => !publicKey.value)
</script>
