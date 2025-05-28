# Library for Scheduled Neon EVM Transaction

- The demo is available on [GitHub](https://github.com/neonlabsorg/neon-solana-signature-demo).
- Demo on [Devnet](https://neon-solana-signature-demo.pages.dev/).

---

## How to install and run tests

```sh
yarn install
cd packages/core
yarn test
```

## RPC URL Configuration

To interact with the Neon EVM Proxy RPC and Solana RPC correctly, you **must use `/sol` endpoints** for the `neon_proxy_rpc_url`.

Using `https://devnet.neonevm.org` (without `/sol`) will not work as expected.

### Recommended URLs

#### Devnet

* `neon_proxy_rpc_url`: `https://devnet.neonevm.org/sol`
* `solana_rpc_url`: `https://api.devnet.solana.com`

#### Mainnet

* `neon_proxy_rpc_url`:

    * `https://neon-proxy-mainnet.solana.p2p.org/sol`
    * `https://neon-mainnet.everstake.one/sol`
* `solana_rpc_url`: `https://api.mainnet-beta.solana.com`

Ensure your code uses these full `/sol` paths when initializing `NeonProxyRpcApi`:

```ts
const proxyApi = new NeonProxyRpcApi('https://devnet.neonevm.org/sol');
```

---

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
const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));

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
scheduledTransaction.recentBlockhash = blockhash;
scheduledTransaction.sign({ publicKey: solanaUser.publicKey, secretKey: solanaUser.keypair });
const signature = await connection.sendRawTransaction(scheduledTransaction.serialize());
console.log('Transaction signature', signature);
```

Wait for the Scheduled transaction to execute on the Neon EVM and display the results.

```typescript
const transactionStatus = await proxyApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 1e5);
console.log(transactionStatus);

console.log(`Scheduled transactions result`, transactionStatus);
for (const { transactionHash, status } of transactionStatus) {
  const { result } = await proxyApi.getTransactionReceipt(transactionHash);
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

The `TransactionData` interface defines the structure of a single transaction to be scheduled and executed on the Neon EVM. It is used when constructing scheduled transactions or multiple scheduled transactions.

```typescript
export interface TransactionData {
  from?: HexString;
  to: HexString;
  data: HexString;
  childTransaction?: HexString;
}
```

`childTransaction` is an identifier that links this transaction as a child to another transaction in a dependent execution structure.
This field is useful when multiple transactions are part of a complex flow and are not just sequential, but may need to be executed in parallel or in a specific dependency order.

For example, in scenarios involving three different scheduled tree accounts, where one transaction must only be executed after or in parallel with a specific peer transaction, the `childTransaction` field helps the proxy service estimate and arrange the execution properly.

At this stage, you need to pass the Scheduled transaction to a specific method in the Neon Proxy RPC. If everything is done correctly, the Neon Proxy RPC will return the hash of the transaction.
```typescript
const result = await proxyApi.sendRawScheduledTransactions(transactions);
```

Next, you need to wait for the transaction to be executed.

```typescript
const transactionsStatus = await proxyApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 1e5);
console.log(transactionsStatus);

console.log(`Scheduled transactions result`, transactionsStatus);
for (const { transactionHash, status } of transactionsStatus) {
  const { result } = await proxyApi.getTransactionReceipt(transactionHash);
  console.log(result);
}
```

### Solana approving

The Solana approving process is a crucial step in the transaction lifecycle. It ensures that the transaction is valid and authorized by the necessary parties before it is executed on the Neon EVM.

This creates additional requirements for executing `ScheduledTransactions`, without Solana approving `estimateScheduledTransactionGas` won't work, and the transaction itself may be rejected by Neon EVM.

#### Example of Solana approving

```typescript
const tokenATA = getAssociatedTokenAddressSync(mintAddress, solanaUser.publicKey);
const [delegateAddress] = PublicKey.findProgramAddressSync([accountSeeds], programAddress);
const approveInstruction = createApproveInstruction(tokenATA, delegateAddress, solanaUser.publicKey, approveAmount);

const transactionGas = await proxyApi.estimateScheduledTransactionGas({
  solanaPayer: solanaUser.publicKey,
  transactions: transactionsData,
  preparatorySolanaTransactions: [{ instructions: prepareSolanaInstructions([approveInstruction]) }]
});

const { scheduledTransaction, transactions } = await proxyApi.createMultipleTransaction({
  nonce,
  transactionsData,
  transactionGas,
  solanaInstructions: [approveInstruction]
});
```

To submit and receive the transaction hash of a single scheduled transaction, you can use the RPC method `neon_sendRawScheduledTransaction`. This method returns the Neon EVM transaction hash, which can be used to track the transaction status.

```json
{
  "jsonrpc": "2.0",
          "id": 1,
          "method": "neon_sendRawScheduledTransaction",
          "params": [
    "<serialized_scheduled_transaction_hex>"
  ]
}
```

The result is the transaction hash.

By following these steps, you can create and execute a batch of Multiple Scheduled Transactions on Solana using Neon Proxy RPC.


## Building Docs

We can run TypeDoc with packages mode to generate a single docs folder in the root of the project.

```sh
yarn build:all
# or
npm run build:all
```
Now, we can run TypeDoc with packages mode to generate a single docs folder

```sh
yarn build:docs
# or
npm run build:docs
```

### Using with React
To integrate this library in a React application, see our React demo in `examples/react-ui` folder. A [live demo](https://codesandbox.io/p/devbox/neon-solana-signer-demo-forked-27lnss) is also available.
