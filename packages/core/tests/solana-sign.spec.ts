import { beforeAll, describe, expect, it } from '@jest/globals';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  balanceAccountNonce,
  BaseContract,
  createHolderAccountTransaction,
  createScheduledNeonEvmTransaction,
  delay,
  executeScheduledTransactionFromAccount,
  executeTransactionStepsFromAccount,
  FaucetDropper,
  GasToken,
  getGasToken,
  getProxyState,
  holderAddressWithSeed,
  NeonChainId,
  NeonClientApi,
  NeonProgramStatus,
  NeonProxyRpcApi,
  neonTreeAccountAddressSync,
  ScheduledTransaction,
  sendSolanaTransaction,
  solanaAirdrop,
  SolanaNeonAccount,
  TreasuryPoolAddress,
  writeTransactionToHoldAccount
} from '@neonevm/solana-sign';
import { neonTransactionData } from '@neonevm/token-transfer-ethers';
import { NEON_TRANSFER_CONTRACT_DEVNET } from '@neonevm/token-transfer-core';
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
  baseContract = BaseContract.baseContractMock;

  console.log(`Solana wallet: ${solanaUser.publicKey.toBase58()}; ${bs58.encode(solanaUser.keypair.secretKey)}`);
  console.log(`Neon wallet: ${solanaUser.neonWallet}; Balance Account: ${solanaUser.balanceAddress.toBase58()}`);

  await solanaAirdrop(connection, solanaUser.publicKey, 21e9);
});

describe('Check ScheduledTransaction instructions', () => {
  it(`Create ScheduledTransaction and sign with Solana for exist account`, async () => {
    const treasuryPool = TreasuryPoolAddress.find(neonEvmProgram, proxyStatus.neonTreasuryPoolCount);
    await solanaAirdrop(connection, treasuryPool.publicKey, 20e9);

    await solanaUser.balanceAccountCreate(connection);
    await delay(1e3);

    const neonBalanceAccountNonce = await balanceAccountNonce(connection, solanaUser.neonWallet, neonEvmProgram, chainId);
    console.log('Balance account nonce', neonBalanceAccountNonce);

    const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
    console.log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

    const gasPrice = await neonProxyRpcApi.gasPrice();
    console.log(gasPrice.result.suggestedGasPrice);

    const scheduledTransaction = new ScheduledTransaction({
      nonce: nonce > 0 ? toBeHex(nonce) : '0x',
      payer: solanaUser.neonWallet,
      target: baseContract.ethAddress,
      callData: `0x3fb5c1cb0000000000000000000000000000000000000000000000000000000000000012`,
      maxFeePerGas: toBeHex(`0x77359400`),
      chainId: toBeHex(NeonChainId.testnetSol)
    });

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

    await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer], true, { skipPreflight }, 'scheduled');

    const treeTransaction = await neonClientApi.transactionTree(solanaUser.neonWallet, nonce);
    expect(treeTransaction.value.transactions.length).toBeGreaterThan(0);
    console.log(treeTransaction);
    for (const transaction of treeTransaction.value.transactions) {
      console.log(transaction);
      console.log(await neonProxyRpcApi.getTransactionReceipt(`0x${transaction['transaction_hash']}`));
      console.log(await provider.waitForTransaction(`0x${transaction['transaction_hash']}`, 1, 2e4));
    }
  });

  it.skip(`Create ScheduledTransaction and sign with Solana`, async () => {
    const treasuryPool = TreasuryPoolAddress.find(neonEvmProgram, proxyStatus.neonTreasuryPoolCount);
    await solanaAirdrop(connection, treasuryPool.publicKey, 1e9);
    const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));

    console.log(`Neon wallet ${solanaUser.neonWallet} nonce: ${nonce}`);

    const scheduledTransaction = new ScheduledTransaction({
      nonce: toBeHex(nonce),
      payer: solanaUser.neonWallet,
      target: NEON_TRANSFER_CONTRACT_DEVNET,
      callData: neonTransactionData(solanaUser.publicKey),
      chainId: toBeHex(NeonChainId.testnetSol)
    });

    const neonBalanceAccountNonce = await balanceAccountNonce(connection, solanaUser.neonWallet, neonEvmProgram, chainId);
    console.log('neon nonce', neonBalanceAccountNonce);

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

    await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer], false, { skipPreflight }, 'scheduled');

    console.log(await neonClientApi.transactionTree(solanaUser.neonWallet, nonce));

    const [holderAddress, holderSeed] = await holderAddressWithSeed(neonEvmProgram, solanaUser.publicKey);
    if (await connection.getBalance(holderAddress) === 0) {
      const transaction = await createHolderAccountTransaction(neonEvmProgram, solanaUser.publicKey, holderAddress, holderSeed);
      await sendSolanaTransaction(connection, transaction, [solanaUser.signer], false, { skipPreflight }, 'holder account');
      await delay(1e3);
    }

    await writeTransactionToHoldAccount(connection, neonEvmProgram, solanaUser, holderAddress, scheduledTransaction);
    await executeScheduledTransactionFromAccount(connection, neonEvmProgram, solanaUser, holderAddress, solanaUser.balanceAddress, nonce);
    const additionalAccounts = [baseContract.solanaAddress, solanaUser.balanceAddress];
    const [treeAccountAddress] = neonTreeAccountAddressSync(solanaUser.neonWallet, neonEvmProgram, nonce);
    await executeTransactionStepsFromAccount(connection, neonEvmProgram, solanaUser, holderAddress, treasuryPool, treeAccountAddress, additionalAccounts);
  });

  it(`Create holder account`, async () => {
    const solanaUser = SolanaNeonAccount.fromKeypair(Keypair.generate(), neonEvmProgram, chainTokenMint, chainId);
    await solanaAirdrop(connection, solanaUser.publicKey, 1e10);
    const [holderAccount, holderSeed] = await holderAddressWithSeed(neonEvmProgram, solanaUser.publicKey);
    let account = await connection.getAccountInfo(holderAccount);
    if (!account) {
      const transaction = await createHolderAccountTransaction(neonEvmProgram, solanaUser.publicKey, holderAccount, holderSeed);
      await sendSolanaTransaction(connection, transaction, [solanaUser.signer], false, { skipPreflight });
      account = await connection.getAccountInfo(holderAccount);
    }
    expect(account).not.toBeNull();
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
