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
  MultipleTreeAccount,
  NeonChainId,
  NeonClientApi,
  NeonProgramStatus,
  NeonProxyRpcApi,
  ScheduledTransaction,
  sendSolanaTransaction,
  solanaAirdrop,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { BaseContract } from '@neonevm/solana-contracts';
import { JsonRpcProvider, toBeHex } from 'ethers';
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

describe('Check ScheduledTransaction instructions', () => {
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
      chainId: NeonChainId.testnetSol
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

    const transactions = await neonClientApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 2e3);
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
      chainId: NeonChainId.testnetSol
    });
    log(`Scheduled transaction`, transaction.serialize(), transaction.hash());

    const multiple = new MultipleTreeAccount(nonce, maxFeePerGas);
    multiple.addTransaction(transaction, 0xFFFF, 0);

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

    const transaction1 = await neonProxyRpcApi.sendRawScheduledTransaction(`0x${transaction.serialize()}`);
    log(transaction1.result);

    const transactions = await neonClientApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 5e3);
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
      chainId: NeonChainId.testnetSol
    });

    const trx1 = new ScheduledTransaction({
      nonce: nonce,
      payer: solanaUser.neonWallet,
      index: 1,
      target: baseContract.address,
      callData: baseContract.transactionData(solanaUser.publicKey),
      maxFeePerGas: maxFeePerGas,
      chainId: NeonChainId.testnetSol
    });
    log(`Scheduled transaction 0`, trx0.serialize(), trx0.hash());
    log(`Scheduled transaction 1`, trx1.serialize(), trx1.hash());

    const multiple = new MultipleTreeAccount(nonce, maxFeePerGas);
    multiple.addTransaction(trx0, 1, 0);
    multiple.addTransaction(trx1, 0xffff, 1);

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

    const transactions = await neonClientApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 5e3);
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
        chainId: NeonChainId.testnetSol
      });
      trxs.push(trx);
      log(`Scheduled transaction ${i}`, trx.serialize(), trx.hash());
    }

    const multiple = new MultipleTreeAccount(nonce, maxFeePerGas);
    multiple.addTransaction(trxs[0], 3, 0);
    multiple.addTransaction(trxs[1], 3, 0);
    multiple.addTransaction(trxs[2], 3, 0);
    multiple.addTransaction(trxs[3], 0xFFFF, 3);

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
    const transactions = await neonClientApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 9e3);
    log(`Scheduled transactions result`, transactions);
    for (const { transaction_hash, status } of transactions) {
      const { result } = await neonProxyRpcApi.getTransactionReceipt(`0x${transaction_hash}`);
      logJson(result);
      expect(status).toBe('Success');
    }
  });

  it(`Create holder account`, async () => {
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

  it(`Compare ScheduledTransaction: new and from`, async () => {
    const target = `0xc7e376be256bdb6a1fbedaee64ca860b2b6e95ee`;
    const callData = `0x3fb5c1cb0000000000000000000000000000000000000000000000000000000000000012`;
    const trx1 = new ScheduledTransaction({ payer: solanaUser.neonWallet, target, callData });
    const trx2 = ScheduledTransaction.from([solanaUser.neonWallet, '0x', '0x', '0x', '0x', '0x', target, callData, '0x', toBeHex(NeonChainId.testnetSol), '0x02540be3ff', '0x64', '0x0a']);
    expect(trx1.encode()).toBe(trx2.encode());
  });

  it(`Should decode transaction`, async () => {
    const trx = `0xf85e94b20650b9d28d3a46e3c6d8859a7243d7627db6b0808080808094c7e376be256bdb6a1fbedaee64ca860b2b6e95eea43fb5c1cb000000000000000000000000000000000000000000000000000000000000001280708502540be3ff640a`;
    const decoded = ScheduledTransaction.decodeFrom(trx);
    expect(trx).toBe(decoded.encode());
  });
});
