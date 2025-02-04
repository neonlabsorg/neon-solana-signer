# Library for Scheduled Neon EVM Transaction

This library provides a set of functions for creating and sending Scheduled transactions on the Neon EVM network.

> Note: This package is under development.

### Install dependencies

```shell
yarn install
yarn build
```

### Run tests

```shell
yarn test
```

## How to usage this code

### Install the package

```shell
yarn install @neonevm/solana-sign
```

First, it is necessary to initialize all variables and providers for Solana and Neon EVM RPCs.

```typescript
const result = await getProxyState(`<neon_proxy_rpc_url>`);
const token = getGasToken(result.tokensList, NeonChainId.testnetSol);
const connection = new Connection(`<solana_rpc_url>`, 'confirmed');
const provider = new JsonRpcProvider(`<neon_proxy_rpc_url>`);
const neonProxyRpcApi = result.proxyApi;
const neonEvmProgram = result.evmProgramAddress;
const chainId = Number(token.gasToken.tokenChainId);
const chainTokenMint = new PublicKey(token.gasToken.tokenMint);
```

Next, connect a Solana wallet (in this example, a `Keypair` is used, but any other method for signing and sending transactions on the Solana network can also be used).

The `SolanaNeonAccount` class includes the Solana wallet, calculates the Neon wallet, and manages the balance account required for creating a Scheduled transaction and executing transactions on the Neon EVM.

```typescript
const solanaPrivateKey = bs58.decode(`<you_private_key_base58>`);
const keypair = Keypair.fromSecretKey(solanaPrivateKey);
const solanaUser = SolanaNeonAccount.fromKeypair(keypair, neonEvmProgram, chainTokenMint, chainId);
await solanaAirdrop(connection, solanaUser.publicKey, 1e9);
```

We create a Scheduled transaction and send it, embedding the contract address and the method call data. Additionally, we retrieve the nonce for the Neon wallet and include this information in the Scheduled transaction.

```typescript
const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
const maxFeePerGas = 0x77359400;

const scheduledTransaction = new ScheduledTransaction({
  nonce: toBeHex(nonce),
  payer: solanaUser.neonWallet,
  target: `<contract_address>`,
  callData: `<call_contract_data>`,
  maxFeePerGas: toBeHex(maxFeePerGas),
  chainId: toBeHex(NeonChainId.testnetSol)
});
```

We create a transaction for Solana, including all the previously defined data. 

```typescript
const transaction = await createScheduledNeonEvmTransaction({
  chainId,
  signerAddress: solanaUser.publicKey,
  tokenMintAddress: solanaUser.tokenMint,
  neonEvmProgram,
  neonWallet: solanaUser.neonWallet,
  neonWalletNonce: nonce,
  neonTransaction: scheduledTransaction.serialize()
});
```

It is necessary to ensure that the balance account is initialized on Solana before the Scheduled transaction is executed. If it is not, an instruction to create the balance account must be added.

```typescript
const account = await connection.getAccountInfo(solanaUser.balanceAddress);

if (account === null) {
  transaction.instructions.unshift(createBalanceAccountInstruction(neonEvmProgram, solanaUser.publicKey, solanaUser.neonWallet, solanaUser.chainId));
}
```

Sign and send the transaction to the Solana network.

```typescript 
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
transaction.recentBlockhash = blockhash;
transaction.sign({ publicKey: solanaUser.publicKey, secretKey: solanaUser.keypair });
const signature = await connection.sendRawTransaction(transaction.serialize());
console.log('Transaction signature', signature);
```

Wait for the Scheduled transaction to execute on the Neon EVM and display the results.

```typescript
const transactions = await neonProxyRpcApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 7e3);
console.log(transactions);

console.log(`Scheduled transactions result`, transactions);
for (const { transactionHash, status } of transactions) {
  const { result } = await neonProxyRpcApi.getTransactionReceipt(transactionHash);
  console.log(result);
}
```

### Creating Multiple Scheduled Transactions

**Multiple Scheduled Transactions** is an advanced use case for creating a **ScheduledTransaction**.

For example, you may need to execute three transactions that call contract methods with different parameters and are executed sequentially, or where one depends on the completion of the other two. Alternatively, a transaction may involve a large volume of data that exceeds the limits of a single transaction permissible within the Solana network.

To create a `MultipleTransactions`, you need to instantiate the `MultipleTransactions` class with a common `nonce`, `maxFeePerGas`, and `maxPriorityFeePerGas`. At the same time, `maxFeePerGas` must match the value that will be passed to each **ScheduledTransaction**. After that, you can add individual transactions to the `MultipleTransactions` instance.

```typescript
const multiple = new MultipleTransactions(nonce, maxFeePerGas);
const transaction = new ScheduledTransaction({
  nonce: nonce,
  payer: solanaUser.neonWallet,
  index: 0,
  target: baseContract.address,
  callData: baseContract.transactionData(solanaUser.publicKey),
  maxFeePerGas: maxFeePerGas,
  chainId: NeonChainId.testnetSol
});
multiple.addTransaction(transaction, NO_CHILD_INDEX, 0);
```

The `addTransaction` method accepts three parameters:

- `transaction`: The Scheduled transaction to be added.
- `childIndex`: The index of child transactions that must be executed before this transaction starts. If the transaction has no dependent child transactions, the constant `NO_CHILD_INDEX` is passed.
- `successLimit`: The number of successful transactions that must be completed before this transaction starts execution.

After adding all necessary transactions, you need to create a multiple transaction for Solana and send it for execution.

```typescript
const createScheduledTransaction = await createScheduledNeonEvmMultipleTransaction({
  chainId,
  neonEvmProgram,
  neonTransaction: multiple.data,
  signerAddress: solanaUser.publicKey,
  tokenMintAddress: solanaUser.tokenMint,
  neonWallet: solanaUser.neonWallet,
  neonWalletNonce: nonce
});
await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer!], true, { skipPreflight }, 'scheduled');
```

At this stage, you need to pass the Scheduled transaction to a specific method in the Neon Proxy RPC. If everything is done correctly, the Neon Proxy RPC will return the hash of the transaction.
```typescript
const {result} = await neonProxyRpcApi.sendRawScheduledTransaction(`0x${transaction.serialize()}`);
console.log(result === transaction.hash());
```

Next, you need to wait for the transaction to be executed.

```typescript
const transactions = await neonProxyRpcApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 7e3);
console.log(transactions);

console.log(`Scheduled transactions result`, transactions);
for (const { transactionHash, status } of transactions) {
  const { result } = await neonProxyRpcApi.getTransactionReceipt(transactionHash);
  console.log(result);
}
```

By following these steps, you can create and execute a batch of Multiple Scheduled Transactions on Solana using Neon Proxy RPC.
