# Library for Scheduled Neon EVM Transaction

This library provides a set of functions for creating and sending Scheduled transactions on the Neon EVM network.

### Install dependencies

```shell
yarn install
yarn build
```

### Run tests

```shell
yarn test
```

## How to use it in code

### Install the package

```shell
yarn add @neonevm/solana-sign
# or
npm install @neonevm/solana-sign
```

First, it is necessary to initialize all variables and providers for Solana and Neon EVM RPCs.

```typescript
const connection = new Connection(`<solana_rpc_url>`, 'confirmed');
const proxyApi = new NeonProxyRpcApi(`<neon_proxy_rpc_url>`);
```

Next, connect a Solana wallet (in this example, a `Keypair` is used, but any other method for signing and sending transactions on the Solana network can also be used).

Use the proxyApi.init() method to retrieve data about NeonEVM, ChainId, and the native token mint.

The `SolanaNeonAccount` class includes the Solana wallet, calculates the Neon wallet, and manages the balance account required for creating a Scheduled transaction and executing transactions on the Neon EVM.

```typescript
const solanaPrivateKey = bs58.decode(`<you_private_key_base58>`);
const keypair = Keypair.fromSecretKey(solanaPrivateKey);
const {chainId, solanaUser, provider, programAddress, tokenMintAddress} = await proxyApi.init(keypair);
await solanaAirdrop(connection, solanaUser.publicKey, 1e9);
```

We create a Scheduled transaction and send it, embedding the contract address and the method call data. Additionally, we retrieve the nonce for the Neon wallet and include this information in the Scheduled transaction.

```typescript
const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));

const transactionData = {
  from: solanaUser.neonWallet,
  to: `<contract_address>`,
  data: `<call_contract_data>`
};

const transactionGas = await proxyApi.estimateScheduledTransactionGas({
  solanaPayer: solanaUser.publicKey,
  transactions: [transactionData],
});

const { scheduledTransaction } = await proxyApi.createScheduledTransaction({
  transactionGas,
  transactionData,
  nonce
});
```

It is necessary to ensure that the balance account is initialized on Solana before the Scheduled transaction is executed. If it is not, an instruction to create the balance account must be added.

```typescript
const account = await connection.getAccountInfo(solanaUser.balanceAddress);

if (account === null) {
  const { neonEvmProgram, publicKey, neonWallet, chainId } = solanaUser;
  scheduledTransaction.instructions.unshift(createBalanceAccountInstruction(neonEvmProgram, publicKey, neonWallet, chainId));
}
```

Sign and send the transaction to the Solana network.

```typescript 
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
transaction.recentBlockhash = blockhash;
transaction.sign({ publicKey: solanaUser.publicKey, secretKey: solanaUser.keypair });
const signature = await connection.sendRawTransaction(scheduledTransaction.serialize());
console.log('Transaction signature', signature);
```

Wait for the Scheduled transaction to execute on the Neon EVM and display the results.

```typescript
const transactionStatus = await neonProxyRpcApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 1e5);
console.log(transactionStatus);

console.log(`Scheduled transactions result`, transactionStatus);
for (const { transactionHash, status } of transactionStatus) {
  const { result } = await neonProxyRpcApi.getTransactionReceipt(transactionHash);
  console.log(result);
}
```

### Creating Multiple Scheduled Transactions

**Multiple Scheduled Transactions** is an advanced use case for creating a **ScheduledTransaction**.

For example, you may need to execute three transactions that call contract methods with different parameters and are executed sequentially, or where one depends on the completion of the other two. Alternatively, a transaction may involve a large volume of data that exceeds the limits of a single transaction permissible within the Solana network.

```typescript
const transactionsData = [{
  from: solanaUser.neonWallet,
  to: `<contract_address>`,
  data: `<call_contract_data>`
}, {
  from: solanaUser.neonWallet,
  to: `<contract_address>`,
  data: `<call_contract_data>`
}];

const transactionGas = await proxyApi.estimateScheduledTransactionGas({
  solanaPayer: solanaUser.publicKey,
  transactions: transactionsData
});

const { scheduledTransaction, transactions } = await proxyApi.createMultipleTransaction({
  transactionsData,
  transactionGas
});
```

At this stage, you need to pass the Scheduled transaction to a specific method in the Neon Proxy RPC. If everything is done correctly, the Neon Proxy RPC will return the hash of the transaction.
```typescript
const result = await proxyApi.sendRawScheduledTransactions(transactions);
```

Next, you need to wait for the transaction to be executed.

```typescript
const transactionsStatus = await neonProxyRpcApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 1e5);
console.log(transactionsStatus);

console.log(`Scheduled transactions result`, transactionsStatus);
for (const { transactionHash, status } of transactionsStatus) {
  const { result } = await neonProxyRpcApi.getTransactionReceipt(transactionHash);
  console.log(result);
}
```

By following these steps, you can create and execute a batch of Multiple Scheduled Transactions on Solana using Neon Proxy RPC.
