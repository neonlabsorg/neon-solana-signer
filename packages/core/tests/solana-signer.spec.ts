import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  createHolderAccountTransaction,
  delay,
  destroyScheduledNeonEvmMultipleTransaction,
  holderAddressWithSeed,
  log,
  logJson,
  MultipleTransactionType,
  NeonProxyRpcApi,
  neonTreeAccountAddressSync,
  sendSolanaTransaction,
  solanaAirdrop,
  SolanaNeonAccount,
  TransactionData
} from '@neonevm/solana-sign';
import { BaseContract } from '@neonevm/contracts-deployer';
import { config } from 'dotenv';
import bs58 from 'bs58';

config({ path: '.env' });

const NEON_API_RPC_URL = `${process.env.NEON_CORE_API_RPC_URL!}/sol`;
const SOLANA_DEVNET_URL = process.env.SOLANA_URL!;
const SOLANA_WALLET = process.env.SOLANA_WALLET!;

let connection: Connection;
let proxyApi: NeonProxyRpcApi;
let neonEvmProgram: PublicKey;
let chainId: number;
let tokenMintAddress: PublicKey;
let solanaUser: SolanaNeonAccount;
let baseContract: BaseContract;
let skipPreflight = false;
let globalNonce: number = 0;

beforeAll(async () => {
  const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_WALLET));
  connection = new Connection(SOLANA_DEVNET_URL, 'confirmed');
  proxyApi = new NeonProxyRpcApi(NEON_API_RPC_URL);
  const result = await proxyApi.init(keypair);
  chainId = result.chainId;
  solanaUser = result.solanaUser;
  neonEvmProgram = result.programAddress;
  tokenMintAddress = result.tokenMintAddress;
  baseContract = new BaseContract(chainId);

  log(`Solana wallet: ${solanaUser.publicKey.toBase58()}; ${bs58.encode(solanaUser.keypair.secretKey)}`);
  log(`Neon wallet: ${solanaUser.neonWallet}; Balance Account: ${solanaUser.balanceAddress.toBase58()}`);

  await solanaAirdrop(connection, solanaUser.publicKey, 100e9);
  await solanaUser.balanceAccountCreate(connection);
});

afterEach(async () => {
  console.log(await proxyApi.getTransactionCount(solanaUser.neonWallet));
  const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
  if (nonce > globalNonce) {
    globalNonce = nonce;
    await delay(5e3);
  } else {
    await delay(9e3);
  }
});

describe('Check Solana signer instructions', () => {
  it(`Create ScheduledTransaction and sign with Solana`, async () => {
    const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
    log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

    const transactionData: TransactionData = {
      from: solanaUser.neonWallet,
      to: baseContract.address,
      data: baseContract.transactionData(solanaUser.publicKey)
    };

    const transactionGas = await proxyApi.estimateScheduledTransactionGas({
      solanaPayer: solanaUser.publicKey,
      transactions: [transactionData]
    });

    const { scheduledTransaction } = await proxyApi.createScheduledTransaction({
      transactionGas,
      transactionData,
      nonce
    });

    await sendSolanaTransaction(connection, scheduledTransaction, [solanaUser.signer!], true, {
      skipPreflight,
      preflightCommitment: 'confirmed'
    }, 'scheduled');

    const transactionsStatus = await proxyApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 7e3);
    logJson(transactionsStatus);

    log(`Scheduled transactions result`, transactionsStatus);
    for (const { transactionHash, status } of transactionsStatus) {
      const { result } = await proxyApi.getTransactionReceipt(transactionHash);
      log(result);
      expect(status).toBe('Success');
    }
  });

  it(`Send raw ScheduledTransaction and sign with Solana`, async () => {
    const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
    log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

    const transactionData: TransactionData = {
      from: solanaUser.neonWallet,
      to: baseContract.address,
      data: baseContract.transactionData(solanaUser.publicKey)
    };

    const transactionGas = await proxyApi.estimateScheduledTransactionGas({
      solanaPayer: solanaUser.publicKey,
      transactions: [transactionData]
    });

    const { scheduledTransaction, transactions } = await proxyApi.createMultipleTransaction({
      nonce,
      transactionGas,
      transactionsData: [transactionData]
    });

    await sendSolanaTransaction(connection, scheduledTransaction, [solanaUser.signer!], true, { skipPreflight }, 'scheduled');
    await delay(2e3);

    const result = await proxyApi.sendRawScheduledTransactions(transactions.map(i => i.serialize()));
    logJson(result);

    const transactionsStatus = await proxyApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 7e3);
    logJson(transactionsStatus);

    log(`Scheduled transactionsStatus result`, transactionsStatus);
    for (const { transactionHash, status } of transactionsStatus) {
      const { result } = await proxyApi.getTransactionReceipt(transactionHash);
      log(result);
      expect(status).toBe('Success');
    }
  });

  it(`Send two depended ScheduledTransactions and sign with Solana`, async () => {
    const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
    log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

    const transactionsData: TransactionData[] = [{
      from: solanaUser.neonWallet,
      to: baseContract.address,
      data: baseContract.transactionData(solanaUser.publicKey)
    }, {
      from: solanaUser.neonWallet,
      to: baseContract.address,
      data: baseContract.transactionData(solanaUser.publicKey)
    }];

    const transactionGas = await proxyApi.estimateScheduledTransactionGas({
      solanaPayer: solanaUser.publicKey,
      transactions: transactionsData
    });

    const { transactions, scheduledTransaction } = await proxyApi.createMultipleTransaction({
      transactionGas,
      transactionsData,
      method: MultipleTransactionType.Parallel
    });

    await sendSolanaTransaction(connection, scheduledTransaction, [solanaUser.signer!], true, { skipPreflight }, 'scheduled');
    await delay(2e3);

    const result = await proxyApi.sendRawScheduledTransactions(transactions.map(i => i.serialize()));

    logJson(result);

    const transactionsStatus = await proxyApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 7e3);
    log(`Scheduled transactions status`, transactionsStatus);
    for (const { transactionHash, status } of transactionsStatus) {
      const { result } = await proxyApi.getTransactionReceipt(transactionHash);
      console.log(result);
      expect(status).toBe('Success');
    }
  });

  it(`Send tree parallel ScheduledTransactions and sign with Solana`, async () => {
    const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
    log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

    const transactionsData: TransactionData[] = [];
    for (let i = 0; i < 4; i++) {
      const trx = {
        from: solanaUser.neonWallet,
        to: baseContract.address,
        data: baseContract.transactionData(solanaUser.publicKey)
      };
      transactionsData.push(trx);
    }

    const transactionGas = await proxyApi.estimateScheduledTransactionGas({
      solanaPayer: solanaUser.publicKey,
      transactions: transactionsData
    });

    const { transactions, scheduledTransaction } = await proxyApi.createMultipleTransaction({
      transactionGas,
      transactionsData,
      method: MultipleTransactionType.DependLast
    });

    await sendSolanaTransaction(connection, scheduledTransaction, [solanaUser.signer!], true, { skipPreflight }, 'scheduled');
    await delay(2e3);

    const result = await proxyApi.sendRawScheduledTransactions(transactions.map(t => t.serialize()));
    logJson(result);

    const transactionsStatus = await proxyApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 7e3);
    log(`Scheduled transactions result`, transactionsStatus);
    for (const { transactionHash, status } of transactionsStatus) {
      const { result } = await proxyApi.getTransactionReceipt(transactionHash);
      console.log(result);
      expect(status).toBe('Success');
    }
  });

  it(`Check if we have pending transactions and cancel it`, async () => {
    const { result } = await proxyApi.getPendingTransactions(solanaUser.publicKey);
    log(result);
    for (const key in result) {
      if (result.hasOwnProperty(key)) {
        const nonce = Number(key);
        for (const pendingTransaction of result[key]) {
          const { result } = await proxyApi.getScheduledTreeAccount(solanaUser.neonWallet, nonce);
          log(result?.transactions);
          if (result?.transactions.some(t => ['NotStarted'].includes(t.status) && t.transactionHash === pendingTransaction.hash.slice(2))) {
            const [treeAccountAddress] = neonTreeAccountAddressSync(solanaUser.neonWallet, neonEvmProgram, chainId, nonce);
            const destroyScheduledTransaction = destroyScheduledNeonEvmMultipleTransaction({
              neonEvmProgram: neonEvmProgram,
              signerAddress: solanaUser.publicKey,
              balanceAddress: solanaUser.balanceAddress,
              treeAccountAddress: treeAccountAddress
            });
            await sendSolanaTransaction(connection, destroyScheduledTransaction, [solanaUser.signer!], true, { skipPreflight }, 'scheduled');
            await delay(2e3);
          }
        }
      }
    }
  });

  it.skip(`Create holder account`, async () => {
    const solanaUser = SolanaNeonAccount.fromKeypair(Keypair.generate(), neonEvmProgram, tokenMintAddress, chainId);
    await solanaAirdrop(connection, solanaUser.publicKey, 1e10);
    const [holderAccount, holderSeed] = await holderAddressWithSeed(neonEvmProgram, solanaUser.publicKey);
    let account = await connection.getAccountInfo(holderAccount);
    if (!account) {
      const transaction = await createHolderAccountTransaction(neonEvmProgram, solanaUser.publicKey, holderAccount, holderSeed);
      await sendSolanaTransaction(connection, transaction, [solanaUser.signer!], false, { skipPreflight });
      account = await connection.getAccountInfo(holderAccount);
    }
    expect(account).not.toBeNull();
  });
});
