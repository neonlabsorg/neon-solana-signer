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

```typescript
// init connection for solana and neon evm rpc
const result = await getProxyState(`<neon_proxy_rpc_url>`);
const token = getGasToken(result.tokensList, NeonChainId.testnetSol);
const connection = new Connection(`<solana_rpc_url>`, 'confirmed');
const provider = new JsonRpcProvider(`<neon_proxy_rpc_url>`);
const neonProxyRpcApi = result.proxyApi;
const neonEvmProgram = result.evmProgramAddress;
const proxyStatus = result.proxyStatus;

const chainId = Number(token.gasToken.tokenChainId);
const chainTokenMint = new PublicKey(token.gasToken.tokenMint);

// init solana user account
const solanaUser = SolanaNeonAccount.fromKeypair(new Keypair(), neonEvmProgram, chainTokenMint, chainId);
await solanaAirdrop(connection, solanaUser.publicKey, 1e9);

// find treasury pool account
const treasuryPool = TreasuryPoolAddress.find(neonEvmProgram, proxyStatus.neonTreasuryPoolCount);

// check that treasury pool account exists ans has enough balance
await solanaAirdrop(connection, treasuryPool.publicKey, 1e9);

// get nonce for native neon wallet
const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
console.log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

// create scheduled transaction
const scheduledTransaction = new ScheduledTransaction({
  nonce: toBeHex(nonce),
  payer: solanaUser.neonWallet,
  target: `<target_contract_hex>`,
  callData: `<run_abi_method_contract_data>`,
  chainId: toBeHex(NeonChainId.testnetSol)
});

// get balance account nonce
const neonBalanceAccountNonce = await balanceAccountNonce(connection, solanaUser.neonWallet, neonEvmProgram, chainId);
console.log('neon nonce', neonBalanceAccountNonce);

// create tree account transaction for solana network
const createScheduledTransaction = await createScheduledNeonEvmTransaction({
  chainId,
  signerAddress: solanaUser.publicKey,
  tokenMintAddress: solanaUser.tokenMint,
  neonEvmProgram,
  neonWallet: solanaUser.neonWallet,
  neonWalletNonce: nonce,
  neonTransaction: scheduledTransaction.serialize(),
  treasuryPool
});

// send transaction 
const signature = await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer], false, { skipPreflight });
console.log('Transaction signature', signature);
```
