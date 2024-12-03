import { beforeAll, describe, expect, it } from '@jest/globals';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  balanceAccountNonce,
  createHolderAccountTransaction,
  createScheduledNeonEvmMultipleTransaction,
  createScheduledNeonEvmTransaction,
  destroyScheduledNeonEvmMultipleTransaction,
  FaucetDropper,
  GasToken,
  getGasToken,
  getProxyState,
  holderAddressWithSeed,
  log,
  MultipleTreeAccount,
  NeonChainId,
  NeonClientApi,
  NeonProgramStatus,
  NeonProxyRpcApi,
  neonTreeAccountAddressSync,
  ScheduledTransaction,
  sendSolanaTransaction,
  solanaAirdrop,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { BaseContract, DeployContract } from '@neonevm/solana-contracts';
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

  await solanaAirdrop(connection, solanaUser.publicKey, 21e9);
});

describe('Check ScheduledTransaction instructions', () => {
  it(`Create ScheduledTransaction and sign with Solana for exist account`, async () => {
    await solanaUser.balanceAccountCreate(connection);

    const neonBalanceAccountNonce = await balanceAccountNonce(connection, solanaUser.neonWallet, neonEvmProgram, chainId);
    log('Balance account nonce', neonBalanceAccountNonce);

    const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
    const maxFeePerGas = 0x77359400;
    log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

    const scheduledTransaction = new ScheduledTransaction({
      nonce: nonce > 0 ? toBeHex(nonce) : '0x',
      payer: solanaUser.neonWallet,
      target: baseContract.address,
      callData: baseContract.transactionData(solanaUser.publicKey),
      maxFeePerGas: toBeHex(maxFeePerGas),
      chainId: toBeHex(NeonChainId.testnetSol)
    });

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

    const [transaction] = await neonClientApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 2e3);
    const { status, transaction_hash } = transaction;
    log(`Scheduled transaction result`, transaction);
    log(await neonProxyRpcApi.getTransactionReceipt(`0x${transaction_hash}`));
    expect(status).toBe('Success');
  });

  it(`Send raw ScheduledTransaction and sign with Solana`, async () => {
    await solanaUser.balanceAccountCreate(connection);

    const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
    const maxFeePerGas = 0x77359400;
    log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

    const contract = new DeployContract(chainId);

    const scheduledTransaction1 = new ScheduledTransaction({
      nonce: nonce > 0 ? toBeHex(nonce) : '0x',
      payer: solanaUser.neonWallet,
      target: baseContract.address,
      callData: baseContract.transactionData(solanaUser.publicKey),
      maxFeePerGas: toBeHex(maxFeePerGas),
      chainId: toBeHex(NeonChainId.testnetSol)
    });

    const multiple = new MultipleTreeAccount(nonce);
    multiple.addTransaction(scheduledTransaction1, 0, 0);
    // multiple.addTransaction(scheduledTransaction2, 0xffff, 1);

    // const neonTransaction = scheduledTransaction.serializeWithHash();
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

    const response = await neonProxyRpcApi.sendRawScheduledTransaction(`0x${scheduledTransaction1.serialize()}`);
    log(response);
    // expect(response.result).toBeDefined();

    const [transaction] = await neonClientApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 5e3);
    const { transaction_hash } = transaction;
    log(`Scheduled transaction result`, transaction);
    log(await neonProxyRpcApi.getTransactionReceipt(`0x${transaction_hash}`));
    expect(transaction_hash).toBe(response.result.slice(2));
  });

  it(`Should destroy all NotStarted Scheduled transactions`, async () => {
    const response = await neonProxyRpcApi.getPendingTransactions(solanaUser.publicKey);
    console.log(response);

    const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
    const [transaction] = await neonClientApi.transactionTree(solanaUser.neonWallet, nonce);
    const { transaction_hash } = transaction;
    log(`Scheduled transaction result`, transaction);

    const [treeAccountAddress] = neonTreeAccountAddressSync(solanaUser.neonWallet, neonEvmProgram, nonce);
    const destroyTransaction = destroyScheduledNeonEvmMultipleTransaction({
      neonEvmProgram,
      signerAddress: solanaUser.publicKey,
      balanceAddress: solanaUser.balanceAddress,
      treeAccountAddress
    });
    const signature = await sendSolanaTransaction(connection, destroyTransaction, [solanaUser.signer!], false, { skipPreflight });
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
