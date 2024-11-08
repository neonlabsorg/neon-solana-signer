import { beforeAll, describe, expect, it } from '@jest/globals';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  balanceAccountNonce,
  createHolderAccountTransaction,
  createScheduledNeonEvmTransaction,
  FaucetDropper,
  GasToken,
  getGasToken,
  getProxyState,
  holderAccountData,
  NeonChainId,
  NeonProgramStatus,
  NeonProxyRpcApi,
  ScheduledTransaction,
  sendSolanaTransaction,
  solanaAirdrop,
  SolanaNeonAccount,
  TreasuryPoolAddress
} from '@neonevm/solana-sign';
import { neonNeonTransactionEthers, neonTransactionData } from '@neonevm/token-transfer-ethers';
import { NEON_TRANSFER_CONTRACT_DEVNET } from '@neonevm/token-transfer-core';
import { JsonRpcProvider, toBeHex } from 'ethers';
import { config } from 'dotenv';
import bs58 from 'bs58';

config({ path: '.env' });

const NEON_EVM_DEVNET_URL = process.env.NEON_CORE_API_RPC_URL!;
const SOLANA_DEVNET_URL = process.env.SOLANA_URL!;
const SOLANA_WALLET = bs58.decode(process.env.SOLANA_WALLET!);

let solanaWallet: Keypair;
let connection: Connection;
let neonProxyRpcApi: NeonProxyRpcApi;
let provider: JsonRpcProvider;
let neonEvmProgram: PublicKey;
let proxyStatus: NeonProgramStatus;
let chainId: number;
let chainTokenMint: PublicKey;
let gasToken: GasToken;
let faucet: FaucetDropper;
let neonUser: SolanaNeonAccount;
let skipPreflight = false;

beforeAll(async () => {
  const result = await getProxyState(NEON_EVM_DEVNET_URL);
  const token = getGasToken(result.tokensList, NeonChainId.testnetSol);
  connection = new Connection(SOLANA_DEVNET_URL, 'confirmed');
  provider = new JsonRpcProvider(NEON_EVM_DEVNET_URL!);
  neonProxyRpcApi = result.proxyApi;
  neonEvmProgram = result.evmProgramAddress;
  proxyStatus = result.proxyStatus;
  chainId = Number(token.gasToken.tokenChainId);
  chainTokenMint = new PublicKey(token.gasToken.tokenMint);
  solanaWallet = Keypair.fromSecretKey(SOLANA_WALLET);
  gasToken = token.gasToken;
  faucet = new FaucetDropper('http://159.69.19.127:3333');
  neonUser = SolanaNeonAccount.fromKeypair(solanaWallet, neonEvmProgram, chainTokenMint, chainId);

  console.log(`Solana wallet: ${neonUser.publicKey.toBase58()}; ${bs58.encode(neonUser.keypair.secretKey)}`);
  console.log(`Neon wallet: ${neonUser.neonWallet}; Balance Account: ${neonUser.balanceAddress.toBase58()}`);

  await solanaAirdrop(connection, neonUser.publicKey, 1e8);
});

describe('Check ScheduledTransaction instructions', () => {
  it(`Create ScheduledTransaction and sign with Solana`, async () => {
    const treasuryPool = TreasuryPoolAddress.find(neonEvmProgram, proxyStatus.neonTreasuryPoolCount);
    await solanaAirdrop(connection, treasuryPool.publicKey, 1e9);

    const nonce = Number(await neonProxyRpcApi.getTransactionCount(neonUser.neonWallet)) + Math.floor(Math.random() * 1000);
    console.log(`Neon wallet ${neonUser.neonWallet} nonce: ${nonce}`);

    const account = await neonProxyRpcApi.getAccount(neonUser.neonWallet, nonce);
    console.log('account', account);
    const gasPrice = await neonProxyRpcApi.gasPrice();
    console.log('gasPrice', gasPrice);

    const scheduledTransaction = new ScheduledTransaction({
      nonce: toBeHex(nonce),
      payer: neonUser.neonWallet,
      target: NEON_TRANSFER_CONTRACT_DEVNET,
      callData: neonTransactionData(neonUser.publicKey),
      chainId: toBeHex(NeonChainId.testnetSol)
    });

    console.log(scheduledTransaction.encode());


    const neonWalletNonce = await balanceAccountNonce(connection, neonUser.neonWallet, neonEvmProgram, chainId);
    console.log('neonWalletNonce', neonWalletNonce);

    const createScheduledTransaction = await createScheduledNeonEvmTransaction({
      chainId,
      signerAddress: neonUser.publicKey,
      tokenMintAddress: neonUser.tokenMint,
      neonEvmProgram,
      neonWallet: neonUser.neonWallet,
      neonWalletNonce: nonce,
      neonTransaction: scheduledTransaction.serialize(),
      treasuryPool
    });

    await sendSolanaTransaction(connection, createScheduledTransaction, [neonUser.signer], false, { skipPreflight });
  });

  it.skip(`Create holder account`, async () => {
    // create holder account
    const [holderAccount, holderSeed] = await holderAccountData(neonEvmProgram, neonUser.publicKey);
    if (await connection.getBalance(holderAccount) === 0) {
      const transaction = await createHolderAccountTransaction(neonEvmProgram, neonUser.publicKey, holderAccount, holderSeed);
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const solanaSignature = await sendSolanaTransaction(connection, transaction, [neonUser.signer], false, { skipPreflight });
      console.log('holderAccount signature', solanaSignature);
    }
  });

  it.skip(`Should encode/decode transaction`, async () => {
    const amount = 0.1;
    const transaction = await neonNeonTransactionEthers(provider, neonUser.neonWallet, NEON_TRANSFER_CONTRACT_DEVNET, neonUser.publicKey, amount);
    const nonce = await neonProxyRpcApi.getTransactionCount(neonUser.neonWallet);
    console.log(nonce);

    console.log(transaction.value);

    const scheduledTransaction = new ScheduledTransaction({
      payer: <string>transaction.from,
      nonce: toBeHex(nonce),
      target: <string>transaction.to,
      callData: <string>transaction.data,
      value: toBeHex(transaction.value!),
      chainId: toBeHex(NeonChainId.testnetSol),
      gasLimit: toBeHex(transaction.gasLimit!)
    });

    const encoded = scheduledTransaction.encode();
    const decoded = ScheduledTransaction.decodeFrom(scheduledTransaction.encode());

    expect(encoded).toBe(decoded.encode());
  });

  it.skip(`Compare ScheduledTransaction: new and from`, async () => {
    const trx1 = new ScheduledTransaction({
      payer: neonUser.neonWallet,
      target: `0xc7e376be256bdb6a1fbedaee64ca860b2b6e95ee`,
      callData: `0x3fb5c1cb0000000000000000000000000000000000000000000000000000000000000012`
    });

    const trx2 = ScheduledTransaction.from([
      neonUser.neonWallet, // payer
      '0x', // sender
      '0x', // nonce
      '0x', // index
      '0x', // intent -
      '0x', // intentCallData -
      '0xc7e376be256bdb6a1fbedaee64ca860b2b6e95ee', // target
      '0x3fb5c1cb0000000000000000000000000000000000000000000000000000000000000012', // callData
      '0x', // value
      toBeHex(NeonChainId.testnetSol), // chainId
      '0x02540be3ff', // gasLimit
      '0x64', // maxFeePerGas
      '0x0a' // maxPriorityFeePerGas
    ]);

    expect(trx1.encode()).toBe(trx2.encode());
  });

  it.skip(`Should decode transaction`, async () => {
    const trx = `0xf85e94b20650b9d28d3a46e3c6d8859a7243d7627db6b0808080808094c7e376be256bdb6a1fbedaee64ca860b2b6e95eea43fb5c1cb000000000000000000000000000000000000000000000000000000000000001280708502540be3ff640a`;
    const decoded = ScheduledTransaction.decodeFrom(trx);
    expect(trx).toBe(decoded.encode());
  });
});
