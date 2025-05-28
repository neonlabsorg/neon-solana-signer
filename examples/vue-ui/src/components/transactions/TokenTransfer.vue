<template>
  <div class="tab-content">
    <form class="form">
      <div class="flex flex-row gap-[8px] items-end mb-[18px]">
        <FormInput
          label="From"
          :value="transfer.from!"
          :disabled="true"
          :rightLabel="directionBalance('from')"
        />
        <div>
          <button class="icon-button" type="button" @click="handleTransferDirection"></button>
        </div>
        <FormInput
          label="To"
          :value="transfer.to!"
          :disabled="true"
          :rightLabel="directionBalance('to')"
        />
      </div>
      <FormSelect
        label="Token"
        placeholder="Select token"
        v-model="token"
        :value="token"
        :options="tokenOptions"
        :disabled="submitDisable"
        @updateValue="handleSelect"
      />
      <FormInput
        label="Amount"
        v-model="amount"
        :value="amount"
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
import { ref, computed, watch, toRaw, onMounted } from 'vue';
import { useWallet } from 'solana-wallets-vue';
import FormInput from '@/components/FormInput.vue';
import FormSelect from '@/components/FormSelect.vue';
import {
  balanceView,
  BIG_ZERO,
  mintTokenBalanceEthers,
  neonBalanceEthers,
  solanaBalance,
  splTokenBalance,
  tokenList,
  getOrCreateAssociatedTokenAccount,
  createAndSendScheduledTransaction
} from '@/utils';
import type { TokenBalance, TransferDirection } from '@/models';
import { Big } from 'big.js';
import { useProxyStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { Connection, PublicKey } from '@solana/web3.js';
import type { JsonRpcProvider } from 'ethers';
import { claimTransactionData, mintNeonTransactionData } from '@neonevm/token-transfer-ethers';
import { createApproveInstruction, getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token';
import {
  authAccountAddress,
  toFullAmount
} from '@neonevm/token-transfer-core';
import { NeonProxyRpcApi, SolanaNeonAccount } from '@neonevm/solana-sign'
import type { TransactionData } from '@neonevm/solana-sign'

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

const neonWallet = computed(() => {
  return solanaUser.value?.neonWallet;
});

const transfer = ref<TransferDirection>({
  direction: 'solana',
  from: publicKey?.value?.toBase58() || '',
  to: neonWallet.value || ''
});

const splToken = computed(() => {
  return tokenList.find(i => i.symbol === token.value);
});

onMounted(() => {
  if (publicKey.value) {
    getTokenBalance();
    getWalletBalance();
  }
})

watch(publicKey, () => {
  if(publicKey.value) {
    getTokenBalance();
    getWalletBalance();
  }
})

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
  checkBalance();
};

const checkBalance = () => {
  if (token.value && splToken.value) {
    if (transfer.value.direction === 'solana') {
      if (tokenBalance.value.solana.eq(0)) log.value = `You need to have some ${splToken.value.symbol} on Solana`;
    } else {
      if (tokenBalance.value.neon.eq(0)) log.value = `You need to have some ${splToken.value.symbol} on Neon`;
    }
  }
}

const handleAmount = (event: Event) => {
  amount.value = (event.target as HTMLInputElement).value;
  log.value = '';
};

const handleSelect = async (value: string) => {
  token.value = value;
  log.value = '';
  await getTokenBalance();
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
    const rawProvider = toRaw(provider.value)
    const solana = await splTokenBalance(<Connection>connection.value, publicKey.value!, splToken.value);
    const neon = await mintTokenBalanceEthers(neonWallet.value, splToken.value, <JsonRpcProvider>rawProvider);
    tokenBalance.value = { solana, neon };
    checkBalance();
  }
};

const getWalletBalance = async () => {
  if (neonWallet.value) {
    const rawProvider = toRaw(provider.value);
    const solana = await solanaBalance(<Connection>connection.value, publicKey.value!);
    const neon = await neonBalanceEthers(<JsonRpcProvider>rawProvider, neonWallet.value);
    walletBalance.value = { solana, neon };
  }
};

const handleSubmit = async () => {
  const rawProxyApi = toRaw(proxyRpcApi.value)
  if (token.value && splToken.value && solanaUser.value && proxyRpcApi.value && signTransaction.value) {
    loading.value = true;
    submitDisable.value = true;
    try {
      console.log(`Transfer ${amount.value} ${token.value} from Solana to Neon EVM`);
      if (transfer.value.direction === 'solana') {
        const fromATA = getAssociatedTokenAddressSync(new PublicKey(splToken.value.address_spl), solanaUser.value.publicKey);
        const tokenAmount = toFullAmount(amount.value, splToken.value.decimals);
        const climeToData = claimTransactionData(fromATA, solanaUser.value.neonWallet, tokenAmount);
        const nonce = Number(await proxyRpcApi.value.getTransactionCount(solanaUser.value.neonWallet));

        //Approve for climeTo
        const [delegatePDA] = authAccountAddress(solanaUser.value.neonWallet, neonEvmProgram.value!, splToken.value);
        const approveInstruction = createApproveInstruction(fromATA, delegatePDA, solanaUser.value.publicKey, tokenAmount);

        const climeTransactionData: TransactionData = {
          from: solanaUser.value.neonWallet,
          to: splToken.value.address,
          data: climeToData
        };

        const transactionGas = await rawProxyApi?.estimateScheduledTransactionGas({
          solanaPayer: solanaUser.value.publicKey,
          transactions: [climeTransactionData]
        });

        const { transaction } = await rawProxyApi?.createScheduledTransaction({
          transactionGas,
          transactionData: climeTransactionData
        });

        log.value = await createAndSendScheduledTransaction({
          chainId: chainId.value,
          scheduledTransaction: transaction,
          neonEvmProgram: <PublicKey>neonEvmProgram.value,
          proxyRpcApi: <NeonProxyRpcApi>proxyRpcApi.value,
          solanaUser: <SolanaNeonAccount>solanaUser.value,
          nonce,
          connection: <Connection>connection.value,
          signMethod: signTransaction.value,
          approveInstruction
        })
      } else {
        const rawProvider = toRaw(provider.value);
        await getOrCreateAssociatedTokenAccount(<Connection>connection.value, signTransaction.value, solanaUser.value.publicKey, splToken.value);
        const balance = await mintTokenBalanceEthers(solanaUser.value.neonWallet, splToken.value, <JsonRpcProvider>rawProvider);
        console.log(`Token balance: ${balance} ${splToken.value.symbol}`);

        const associatedToken = getAssociatedTokenAddressSync(new PublicKey(splToken.value.address_spl), solanaUser.value.publicKey);
        const account = await getAccount(<Connection>connection.value, associatedToken);
        if (account) {
          console.log(`Token balance: ${balanceView(account.amount, splToken.value.decimals)}  ${splToken.value.symbol}`);
        }
        const data = mintNeonTransactionData(associatedToken, splToken.value, amount.value);

        const nonce = Number(await proxyRpcApi.value.getTransactionCount(solanaUser.value.neonWallet));

        const transactionData: TransactionData = {
          from: solanaUser.value.neonWallet,
          to: splToken.value.address,
          data: data
        };

        const transactionGas = await rawProxyApi?.estimateScheduledTransactionGas({
          solanaPayer: solanaUser.value.publicKey,
          transactions: [transactionData]
        });

        const { transaction } = await rawProxyApi?.createScheduledTransaction({
          transactionGas,
          transactionData
        });

        console.log(transaction.data);

        log.value = await createAndSendScheduledTransaction({
          chainId: chainId.value,
          scheduledTransaction: transaction,
          neonEvmProgram: <PublicKey>neonEvmProgram.value,
          proxyRpcApi: <NeonProxyRpcApi>proxyRpcApi.value,
          solanaUser: <SolanaNeonAccount>solanaUser.value,
          nonce,
          connection: <Connection>connection.value,
          signMethod: signTransaction.value,
        });
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
