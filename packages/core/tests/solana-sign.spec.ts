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
  NeonEVMChainId,
  NeonProgramStatus,
  NeonProxyRpcApi,
  NeonUser,
  requestAirdrop,
  ScheduledTransaction,
  sendSolanaTransaction
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
let gasToken: GasToken;
let faucet: FaucetDropper;
let neonUser: NeonUser;
let skipPreflight = false;

beforeAll(async () => {
  const result = await getProxyState(NEON_EVM_DEVNET_URL);
  const token = getGasToken(result.tokensList, NeonEVMChainId.testnetSol);
  connection = new Connection(SOLANA_DEVNET_URL, 'confirmed');
  provider = new JsonRpcProvider(NEON_EVM_DEVNET_URL!);
  neonProxyRpcApi = result.proxyApi;
  neonEvmProgram = result.evmProgramAddress;
  proxyStatus = result.proxyStatus;
  chainId = Number(token.gasToken.tokenChainId);
  solanaWallet = Keypair.fromSecretKey(SOLANA_WALLET);
  gasToken = token.gasToken;
  faucet = new FaucetDropper('http://159.69.19.127:3333');
  neonUser = new NeonUser(solanaWallet, neonEvmProgram, chainId);

  console.log(`Solana wallet: ${neonUser.publicKey.toBase58()}; ${bs58.encode(neonUser.solanaAccount.secretKey)}`);
  console.log(`Neon wallet: ${neonUser.neonWallet}; Balance Account: ${neonUser.balanceAccount.toBase58()}`);

  await requestAirdrop(connection, neonUser.publicKey, 2e9);
});

describe('Check ScheduledTransaction instructions', () => {
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

  it(`Create ScheduledTransaction and sign with Solana`, async () => {
    const nonce = await neonProxyRpcApi.getTransactionCount(neonUser.neonWallet);
    console.log(nonce);

    const account = await neonProxyRpcApi.getAccount(neonUser.neonWallet, Number(nonce));

    const scheduledTransaction = new ScheduledTransaction({
      payer: neonUser.neonWallet,
      target: NEON_TRANSFER_CONTRACT_DEVNET,
      callData: neonTransactionData(neonUser.publicKey),
      chainId: toBeHex(NeonEVMChainId.testnetSol)
    });

    console.log(scheduledTransaction.encode());

    const gasPrice = await neonProxyRpcApi.gasPrice();
    console.log('account', account);
    console.log('gasPrice', gasPrice);
    console.log('neonTransaction', '');

    const neonWalletNonce = await balanceAccountNonce(connection, neonUser.neonWallet, neonEvmProgram, chainId);
    console.log('neonWalletNonce', neonWalletNonce);

    const solanaTransaction = await createScheduledNeonEvmTransaction({
      chainId,
      connection,
      signerAddress: neonUser.publicKey,
      neonEvmProgram,
      neonWallet: neonUser.neonWallet,
      neonWalletNonce: Number(neonWalletNonce),
      neonTransaction: scheduledTransaction.serialize(),
      treasuryPoolCount: proxyStatus.neonTreasuryPoolCount
    });

    solanaTransaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const solanaSignature = await sendSolanaTransaction(connection, solanaTransaction, [neonUser.signer], false, { skipPreflight });

    console.log(solanaSignature);
  });

  it(`Should encode/decode transaction`, async () => {
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
      chainId: toBeHex(NeonEVMChainId.testnetSol),
      gasLimit: toBeHex(transaction.gasLimit!)
    });

    const encoded = scheduledTransaction.encode();
    const decoded = ScheduledTransaction.decodeFrom(scheduledTransaction.encode());

    expect(encoded).toBe(decoded.encode());
  });

  it(`Compare ScheduledTransaction: new and from`, async () => {
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
      toBeHex(NeonEVMChainId.testnetSol), // chainId
      '0x02540be3ff', // gasLimit
      '0x64', // maxFeePerGas
      '0x0a' // maxPriorityFeePerGas
    ]);

    expect(trx1.encode()).toBe(trx2.encode());
  });

  it(`Should decode transaction`, async () => {
    const trx = `0xf85e94b20650b9d28d3a46e3c6d8859a7243d7627db6b0808080808094c7e376be256bdb6a1fbedaee64ca860b2b6e95eea43fb5c1cb000000000000000000000000000000000000000000000000000000000000001280708502540be3ff640a`;
    const decoded = ScheduledTransaction.decodeFrom(trx);
    expect(trx).toBe(decoded.encode());
  });
});
