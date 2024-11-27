# Library for Scheduled Neon EVM Transaction

This package is under development.

```shell
yarn install
yarn build
```

Run tests
```shell
yarn test
```


```typescript
// init connection for solana and neon evm rpc
const solanaPrivateKey = bs58.decode(`<you_private_key_base58>`);
const result = await getProxyState(`<neon_proxy_rpc_url>`);
const token = getGasToken(result.tokensList, NeonChainId.testnetSol);
const connection = new Connection(`<solana_rpc_url>`, 'confirmed');
const provider = new JsonRpcProvider(`<neon_proxy_rpc_url>`);
const neonClientApi = new NeonClientApi(`<neon_client_api_url>`);
const neonProxyRpcApi = result.proxyApi;
const neonEvmProgram = result.evmProgramAddress;

const chainId = Number(token.gasToken.tokenChainId);
const chainTokenMint = new PublicKey(token.gasToken.tokenMint);

// init contract for scheduled transaction
const baseContract = new BaseContract(chainId);

// init solana user account
const keypair = Keypair.fromSecretKey(solanaPrivateKey);
const solanaUser = SolanaNeonAccount.fromKeypair(keypair, neonEvmProgram, chainTokenMint, chainId);
await solanaAirdrop(connection, solanaUser.publicKey, 1e9);

// get nonce for native neon wallet
const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
console.log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

// create scheduled transaction
const scheduledTransaction = new ScheduledTransaction({
  nonce: toBeHex(nonce),
  payer: solanaUser.neonWallet,
  target: baseContract.address,
  callData: baseContract.transactionData(solanaUser.publicKey),
  chainId: toBeHex(NeonChainId.testnetSol)
});

// create tree account transaction for solana network
const createScheduledTransaction = await createScheduledNeonEvmTransaction({
  chainId,
  signerAddress: solanaUser.publicKey,
  tokenMintAddress: solanaUser.tokenMint,
  neonEvmProgram,
  neonWallet: solanaUser.neonWallet,
  neonWalletNonce: nonce,
  neonTransaction: scheduledTransaction.serialize()
});

// sign and send solana transaction 
const signature = await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer], false, { skipPreflight });
console.log('Transaction signature', signature);

// whaint while transaction will executed by NeonEvm
const [transaction] = await neonClientApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 2e3);
const { status, transaction_hash, result_hash } = transaction;
console.log(`Scheduled transaction result`, transaction);
console.log(await neonProxyRpcApi.getTransactionReceipt(`0x${transaction_hash}`));
console.log(await neonProxyRpcApi.getTransactionReceipt(`0x${result_hash}`));
```
