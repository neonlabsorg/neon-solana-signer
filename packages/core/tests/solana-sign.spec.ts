import { beforeAll, describe, expect, it } from '@jest/globals';
import { Connection, Keypair, PublicKey, Signer } from '@solana/web3.js';
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
  ScheduledTransaction,
  sendSolanaTransaction,
  toSigner
} from '@neonevm/solana-sign';
import { neonNeonTransactionEthers } from '@neonevm/token-transfer-ethers';
import { NEON_TRANSFER_CONTRACT_DEVNET } from '@neonevm/token-transfer-core';
import { JsonRpcProvider, toBeHex, Wallet } from 'ethers';
import { config } from 'dotenv';
import bs58 from 'bs58';

config({ path: '.env' });

const NEON_EVM_DEVNET_URL = process.env.NEON_CORE_API_RPC_URL!;
const SOLANA_DEVNET_URL = process.env.SOLANA_URL!;
const SOLANA_WALLET = bs58.decode(process.env.SOLANA_WALLET!);
const NEON_WALLET = process.env.NEON_WALLET!;

let solanaWallet: Keypair;
let signer: Signer;
let neonWallet: Wallet;
let connection: Connection;
let neonProxyRpcApi: NeonProxyRpcApi;
let provider: JsonRpcProvider;
let neonEvmProgram: PublicKey;
let proxyStatus: NeonProgramStatus;
let chainId: number;
let gasToken: GasToken;
let faucet: FaucetDropper;
let neonUser: NeonUser;
let skipPreflight = true;

beforeAll(async () => {
  const result = await getProxyState(NEON_EVM_DEVNET_URL);
  const token = getGasToken(result.tokensList, NeonEVMChainId.testnetNeon);
  connection = new Connection(SOLANA_DEVNET_URL, 'confirmed');
  provider = new JsonRpcProvider(NEON_EVM_DEVNET_URL!);
  neonProxyRpcApi = result.proxyApi;
  neonEvmProgram = result.evmProgramAddress;
  proxyStatus = result.proxyStatus;
  chainId = Number(token.gasToken.tokenChainId);
  solanaWallet = Keypair.fromSecretKey(SOLANA_WALLET);
  signer = toSigner(solanaWallet);
  neonWallet = new Wallet(NEON_WALLET, provider);
  gasToken = token.gasToken;
  faucet = new FaucetDropper('http://159.69.19.127:3333');
  neonUser = new NeonUser(solanaWallet, neonEvmProgram, chainId);

  console.log(neonUser.neonWallet, neonUser.balanceAccount);

  // await connection.requestAirdrop(solanaWallet.publicKey, 1e9);
  // await faucet.requestNeon(neonWallet.address, 100);
  // await delay(1e4);
});

describe('Check Neon data', () => {
  it(`Should request`, async () => {

    // create holder account
    const [holderAccount, holderSeed] = await holderAccountData(neonEvmProgram, solanaWallet.publicKey);
    if (await connection.getBalance(holderAccount) === 0) {
      const transaction = await createHolderAccountTransaction(neonEvmProgram, solanaWallet.publicKey, holderAccount, holderSeed);
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const solanaSignature = await sendSolanaTransaction(connection, transaction, [signer], false, { skipPreflight });
      console.log(solanaSignature);
    }

    const nonce = await neonWallet.getNonce();
    const account = await neonProxyRpcApi.getAccount(neonWallet.address, nonce);

    const scheduledTransaction = ScheduledTransaction.from([
      neonWallet.address,
      '0x',
      '0x',
      '0x',
      '0x',
      '0x',
      '0x38c39f297f1cd32a2f9b9725cfc476a8ebea11db',
      '0x3fb5c1cb0000000000000000000000000000000000000000000000000000000000000012',
      '0x',
      toBeHex(NeonEVMChainId.testnetSol),
      '0x02540be3ff',
      '0x64',
      '0x0a'
    ]);

    console.log(scheduledTransaction.encode())

    const gasPrice = await neonProxyRpcApi.gasPrice();
    console.log('account', account);
    console.log('gasPrice', gasPrice);
    console.log('neonTransaction', '');

    const neonWalletNonce = await balanceAccountNonce(connection, neonWallet.address, neonEvmProgram, chainId);
    console.log('neonWalletNonce', neonWalletNonce);

    const solanaTransaction = await createScheduledNeonEvmTransaction({
      chainId,
      connection,
      signerAddress: solanaWallet.publicKey,
      neonEvmProgram,
      neonWallet: neonWallet.address,
      neonWalletNonce: Number(neonWalletNonce),
      neonTransaction: scheduledTransaction.serialize(),
      treasuryPoolCount: proxyStatus.neonTreasuryPoolCount
    });

    solanaTransaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const solanaSignature = await sendSolanaTransaction(connection, solanaTransaction, [signer], false, { skipPreflight });

    console.log(solanaSignature);

    // console.log(gasPrice);
    // console.log(JSON.stringify(transaction));
    // expect(true).toBe(true);
  });

  it.skip(`Should request payer_nonce`, async () => {
    expect(true).toBe(true);
  });

  it.skip(`Should encode/decode transaction`, async () => {
    const amount = 0.1;
    const transaction = await neonNeonTransactionEthers(provider, neonWallet.address, NEON_TRANSFER_CONTRACT_DEVNET, solanaWallet.publicKey, amount);
    const nonce = await neonWallet.getNonce();

    console.log(transaction.value);

    const scheduledTransaction = new ScheduledTransaction({
      payer: <string>transaction.from,
      nonce: toBeHex(nonce),
      target: <string>transaction.to,
      callData: <string>transaction.data,
      value: toBeHex(transaction.value!),
      chainId: toBeHex(NeonEVMChainId.testnetNeon),
      gasLimit: toBeHex(transaction.gasLimit!)
    });

    const encoded = scheduledTransaction.encode();
    const decoded = ScheduledTransaction.decodeFrom(scheduledTransaction.encode());

    expect(encoded).toBe(decoded.encode());
  });

  it(`Should decode transaction`, async () => {
    const trx = `0xf85e946cc055c2589985f6cc23973a8e5fbe46a812517680808080809438c39f297f1cd32a2f9b9725cfc476a8ebea11dba43fb5c1cb000000000000000000000000000000000000000000000000000000000000001280708502540be3ff640a`;
    const decoded = ScheduledTransaction.decodeFrom(trx);
    const scheduledTransaction = ScheduledTransaction.from([
      '0x6cc055c2589985f6cc23973a8e5fbe46a8125176',
      '0x',
      '0x',
      '0x',
      '0x',
      '0x',
      '0x38c39f297f1cd32a2f9b9725cfc476a8ebea11db',
      '0x3fb5c1cb0000000000000000000000000000000000000000000000000000000000000012',
      '0x',
      '0x70',
      '0x02540be3ff',
      '0x64',
      '0x0a'
    ]);

    console.log(trx, scheduledTransaction.encode())
    expect(trx).toBe(decoded.encode());
  });

  it.skip(`Should decode transaction`, async () => {
    const trx = `0xf87b947d7c2c1110756c3efea4b3a9ca5f0a39dd87af85947d7c2c1110756c3efea4b3a9ca5f0a39dd87af8501008080945238c694a8db837fff8c4068859e765b978a7607a48e19899e77f4af4f21fa3b9bf231941efc517c51fdf4a50799ce2b2f91a315b44c6cff2888016345785d8a0000840e9ac0ce82c350640a`;
    const decoded = ScheduledTransaction.decodeFrom(trx);
    expect(trx).toBe(decoded.encode());
  });
});
