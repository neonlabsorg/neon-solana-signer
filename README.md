# Library for Scheduled Neon EVM Transaction

> Note: this package is under development, run on neon test environment and is not ready for production use.

## How to install and run tests

```sh
yarn install
cd packages/core
yarn test
```

## How to using it in code

> Node: for more details run `yarn test` in `packages/core` folder and see [solana-sign.spec.ts](packages%2Fcore%2Ftests%2Fsolana-sign.spec.ts) file.

First, it is necessary to initialize all variables and providers for Solana and Neon EVM RPCs.

```typescript
const result = await getProxyState(`<neon_proxy_rpc_url>`);
const token = getGasToken(result.tokensList, NeonChainId.testnetSol);
const connection = new Connection(`<solana_rpc_url>`, 'confirmed');
const provider = new JsonRpcProvider(`<neon_proxy_rpc_url>`);
const neonClientApi = new NeonClientApi(`<neon_client_api_url>`);
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
const [transaction] = await neonClientApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 5e3);
const { status, transaction_hash, result_hash } = transaction;
console.log(`Scheduled transaction result`, transaction);
console.log(await neonProxyRpcApi.getTransactionReceipt(`0x${transaction_hash}`));
```

### Building Docs

We can run TypeDoc with packages mode to generate a single docs folder in the root of the project.

```sh
# We need to build before building the docs so that `foo` can reference types from `bar`
# TypeDoc can't use TypeScript's build mode to do this for us because build mode may skip
# a project that needs documenting, or include packages that shouldn't be included in the docs
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
