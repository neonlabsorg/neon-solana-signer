import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  balanceAccountNonce,
  createHolderAccountTransaction,
  createScheduledNeonEvmMultipleTransaction,
  createScheduledNeonEvmTransaction,
  delay,
  FaucetDropper,
  GasToken,
  getGasToken,
  getProxyState,
  holderAddressWithSeed,
  log,
  logJson,
  MultipleTransactions,
  NeonChainId,
  NeonClientApi,
  NeonProgramStatus,
  NeonProxyRpcApi,
  NO_CHILD_INDEX,
  ScheduledTransaction,
  sendSolanaTransaction,
  solanaAirdrop,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { BaseContract } from '@neonevm/solana-contracts';
import { JsonRpcProvider } from 'ethers';
import { config } from 'dotenv';
import bs58 from 'bs58';

config({ path: '.env' });

const NEON_API_RPC_URL = `${process.env.NEON_CORE_API_RPC_URL!}/sol`;
const NEON_CLIENT_API_URL = process.env.NEON_CORE_API_URL!;
const SOLANA_DEVNET_URL = process.env.SOLANA_URL!;
const NEON_FAUCET_URL = process.env.NEON_FAUCET_URL!;
const SOLANA_WALLET = process.env.SOLANA_WALLET!;

let connection: Connection;
let neonProxyRpcApi: NeonProxyRpcApi;
let neonClientApi: NeonClientApi;
let provider: JsonRpcProvider;
let neonEvmProgram: PublicKey;
let proxyStatus: NeonProgramStatus;
let chainId: number;
let chainTokenMint: PublicKey;
let gasToken: GasToken;
let faucet: FaucetDropper;
let solanaUser: SolanaNeonAccount;
let baseContract: BaseContract;
let skipPreflight = false;
let globalNonce: number = 0;

beforeAll(async () => {
  const result = await getProxyState(NEON_API_RPC_URL);
  const token = getGasToken(result.tokensList, NeonChainId.testnetSol);
  const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_WALLET));
  connection = new Connection(SOLANA_DEVNET_URL, 'confirmed');
  provider = new JsonRpcProvider(NEON_API_RPC_URL!);
  neonClientApi = new NeonClientApi(NEON_CLIENT_API_URL);
  neonProxyRpcApi = result.proxyApi;
  neonEvmProgram = result.evmProgramAddress;
  proxyStatus = result.proxyStatus;
  chainId = Number(token.gasToken.tokenChainId);
  chainTokenMint = new PublicKey(token.gasToken.tokenMint);
  gasToken = token.gasToken;
  faucet = new FaucetDropper(NEON_FAUCET_URL);
  solanaUser = SolanaNeonAccount.fromKeypair(keypair, neonEvmProgram, chainTokenMint, chainId);
  baseContract = new BaseContract(chainId);

  log(`Solana wallet: ${solanaUser.publicKey.toBase58()}; ${bs58.encode(solanaUser.keypair.secretKey)}`);
  log(`Neon wallet: ${solanaUser.neonWallet}; Balance Account: ${solanaUser.balanceAddress.toBase58()}`);

  await solanaAirdrop(connection, solanaUser.publicKey, 100e9);
  await solanaUser.balanceAccountCreate(connection);
});

afterEach(async () => {
  const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
  if (nonce > globalNonce) {
    globalNonce = nonce;
  } else {
    await delay(9e3);
  }
});

describe('Check Solana signer instructions', () => {
  it(`Create ScheduledTransaction and sign with Solana`, async () => {
    const neonBalanceAccountNonce = await balanceAccountNonce(connection, solanaUser.neonWallet, neonEvmProgram, chainId);
    log('Balance account nonce', neonBalanceAccountNonce);

    const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
    const maxFeePerGas = 0x77359400;
    log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

    const scheduledTransaction = new ScheduledTransaction({
      nonce: nonce,
      payer: solanaUser.neonWallet,
      target: baseContract.address,
      callData: baseContract.transactionData(solanaUser.publicKey),
      maxFeePerGas: maxFeePerGas,
      chainId
    });
    log(`Scheduled transaction`, scheduledTransaction.serialize(), scheduledTransaction.hash());

    const createScheduledTransaction = await createScheduledNeonEvmTransaction({
      chainId,
      signerAddress: solanaUser.publicKey,
      tokenMintAddress: solanaUser.tokenMint,
      neonEvmProgram,
      neonWallet: solanaUser.neonWallet,
      neonWalletNonce: nonce,
      neonTransaction: scheduledTransaction.serialize()
    });

    // for this test, we check that the pool account has tokens on test stand
    const treasuryPool = createScheduledTransaction.instructions[0].keys[2].pubkey;
    await solanaAirdrop(connection, treasuryPool, 20e9);

    await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer!], true, {
      skipPreflight,
      preflightCommitment: 'confirmed'
    }, 'scheduled');

    const transactions = await neonClientApi.waitTransactionTreeExecution({
      address: solanaUser.neonWallet,
      chain_id: chainId
    }, nonce, 2e3);
    log(`Scheduled transactions result`, transactions);
    for (const { transaction_hash, status } of transactions) {
      const { result } = await neonProxyRpcApi.getTransactionReceipt(`0x${transaction_hash}`);
      logJson(result);
      expect(status).toBe('Success');
    }
  });

  it(`Send raw ScheduledTransaction and sign with Solana`, async () => {
    const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
    const maxFeePerGas = 0x77359400;
    log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

    const transaction = new ScheduledTransaction({
      nonce: nonce,
      payer: solanaUser.neonWallet,
      index: 0,
      target: baseContract.address,
      callData: baseContract.transactionData(solanaUser.publicKey),
      maxFeePerGas: maxFeePerGas,
      chainId
    });
    log(`Scheduled transaction`, transaction.serialize(), transaction.hash());

    const multiple = new MultipleTransactions(nonce, maxFeePerGas);
    multiple.addTransaction(transaction, NO_CHILD_INDEX, 0);

    const createScheduledTransaction = await createScheduledNeonEvmMultipleTransaction({
      chainId,
      neonEvmProgram,
      neonTransaction: multiple.data,
      signerAddress: solanaUser.publicKey,
      tokenMintAddress: solanaUser.tokenMint,
      neonWallet: solanaUser.neonWallet,
      neonWalletNonce: nonce
    });

    // for this test, we check that the pool account has tokens on test stand
    const treasuryPool = createScheduledTransaction.instructions[0].keys[2].pubkey;
    await solanaAirdrop(connection, treasuryPool, 20e9);

    await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer!], true, { skipPreflight }, 'scheduled');
    await delay(2e3);

    const { result } = await neonProxyRpcApi.sendRawScheduledTransaction(`0x${transaction.serialize()}`);
    log(result);

    const transactions = await neonClientApi.waitTransactionTreeExecution({
      address: solanaUser.neonWallet,
      chain_id: chainId
    }, nonce, 5e3);
    log(`Scheduled transactions result`, transactions);
    for (const { transaction_hash, status } of transactions) {
      const { result } = await neonProxyRpcApi.getTransactionReceipt(`0x${transaction_hash}`);
      logJson(result);
      expect(status).toBe('Success');
    }
  });

  it(`Send two depended ScheduledTransactions and sign with Solana`, async () => {
    const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
    const maxFeePerGas = 0x77359400;
    log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

    const trx0 = new ScheduledTransaction({
      nonce: nonce,
      payer: solanaUser.neonWallet,
      index: 0,
      target: baseContract.address,
      callData: baseContract.transactionData(solanaUser.publicKey),
      maxFeePerGas: maxFeePerGas,
      chainId
    });

    const trx1 = new ScheduledTransaction({
      nonce: nonce,
      payer: solanaUser.neonWallet,
      index: 1,
      target: baseContract.address,
      callData: baseContract.transactionData(solanaUser.publicKey),
      maxFeePerGas: maxFeePerGas,
      chainId
    });
    log(`Scheduled transaction 0`, trx0.serialize(), trx0.hash());
    log(`Scheduled transaction 1`, trx1.serialize(), trx1.hash());

    const multiple = new MultipleTransactions(nonce, maxFeePerGas);
    multiple.addTransaction(trx0, 1, 0);
    multiple.addTransaction(trx1, NO_CHILD_INDEX, 1);

    const createScheduledTransaction = await createScheduledNeonEvmMultipleTransaction({
      chainId,
      neonEvmProgram,
      neonTransaction: multiple.data,
      signerAddress: solanaUser.publicKey,
      tokenMintAddress: solanaUser.tokenMint,
      neonWallet: solanaUser.neonWallet,
      neonWalletNonce: nonce
    });

    // for this test, we check that the pool account has tokens on test stand
    const treasuryPool = createScheduledTransaction.instructions[0].keys[2].pubkey;
    await solanaAirdrop(connection, treasuryPool, 20e9);

    await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer!], true, { skipPreflight }, 'scheduled');
    await delay(2e3);

    const transaction1 = await neonProxyRpcApi.sendRawScheduledTransaction(`0x${trx0.serialize()}`);
    const transaction2 = await neonProxyRpcApi.sendRawScheduledTransaction(`0x${trx1.serialize()}`);
    log(transaction1.result, transaction2.result);

    const transactions = await neonClientApi.waitTransactionTreeExecution({
      address: solanaUser.neonWallet,
      chain_id: chainId
    }, nonce, 5e3);
    log(`Scheduled transactions result`, transactions);
    for (const { transaction_hash, status } of transactions) {
      const { result } = await neonProxyRpcApi.getTransactionReceipt(`0x${transaction_hash}`);
      logJson(result);
      expect(status).toBe('Success');
    }
  });

  it(`Send tree parallel ScheduledTransactions and sign with Solana`, async () => {
    const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
    const maxFeePerGas = 0x77359400;
    log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

    const trxs = [];
    for (let i = 0; i < 4; i++) {
      const trx = new ScheduledTransaction({
        nonce: nonce,
        payer: solanaUser.neonWallet,
        index: i,
        target: baseContract.address,
        callData: baseContract.transactionData(solanaUser.publicKey),
        maxFeePerGas: maxFeePerGas,
        chainId
      });
      trxs.push(trx);
      log(`Scheduled transaction ${i}`, trx.serialize(), trx.hash());
    }

    const multiple = new MultipleTransactions(nonce, maxFeePerGas);
    multiple.addTransaction(trxs[0], 3, 0);
    multiple.addTransaction(trxs[1], 3, 0);
    multiple.addTransaction(trxs[2], 3, 0);
    multiple.addTransaction(trxs[3], NO_CHILD_INDEX, 3);

    const createScheduledTransaction = await createScheduledNeonEvmMultipleTransaction({
      chainId,
      neonEvmProgram,
      neonTransaction: multiple.data,
      signerAddress: solanaUser.publicKey,
      tokenMintAddress: solanaUser.tokenMint,
      neonWallet: solanaUser.neonWallet,
      neonWalletNonce: nonce
    });

    // for this test, we check that the pool account has tokens on test stand
    const treasuryPool = createScheduledTransaction.instructions[0].keys[2].pubkey;
    await solanaAirdrop(connection, treasuryPool, 20e9);

    await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer!], true, { skipPreflight }, 'scheduled');
    await delay(2e3);

    const result = await neonProxyRpcApi.sendRawScheduledTransactions(trxs.map(t => t.serialize()));
    logJson(result);
    const transactions = await neonClientApi.waitTransactionTreeExecution({
      address: solanaUser.neonWallet,
      chain_id: chainId
    }, nonce, 9e3);
    log(`Scheduled transactions result`, transactions);
    for (const { transaction_hash, status } of transactions) {
      const { result } = await neonProxyRpcApi.getTransactionReceipt(`0x${transaction_hash}`);
      logJson(result);
      expect(status).toBe('Success');
    }
  });

  it(`Check if we have pending transactions`, async () => {
    const response = await neonProxyRpcApi.getPendingTransactions(solanaUser.publicKey);
    console.log(response);
  });

  it.skip(`Create holder account`, async () => {
    const solanaUser = SolanaNeonAccount.fromKeypair(Keypair.generate(), neonEvmProgram, chainTokenMint, chainId);
    await solanaAirdrop(connection, solanaUser.publicKey, 1e10);
    const [holderAccount, holderSeed] = await holderAddressWithSeed(neonEvmProgram, solanaUser.publicKey);
    let account = await connection.getAccountInfo(holderAccount);
    if (!account) {
      const transaction = await createHolderAccountTransaction(neonEvmProgram, solanaUser.publicKey, holderAccount, holderSeed);
      await sendSolanaTransaction(connection, transaction, [solanaUser.signer!], false, { skipPreflight });
      account = await connection.getAccountInfo(holderAccount);
    }
    expect(account).not.toBeNull();
    log(await neonClientApi.getHolder(holderAccount));
  });
});
