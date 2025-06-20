import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { Connection, Keypair, Signer } from '@solana/web3.js';
import {
  delay,
  log,
  NeonProxyRpcApi,
  sendSolanaTransaction,
  SolanaNeonAccount,
  TransactionData
} from '@neonevm/solana-sign';
import { Contract, Interface, JsonRpcProvider } from 'ethers';
import { config } from 'dotenv';
import bs58 from 'bs58';
import { chainGptContractAbi } from './data/contracts/chainGpt';

config({ path: '.env' });

const NEON_API_RPC_URL = `${process.env.NEON_CORE_API_RPC_URL!}/sol`;
const SOLANA_DEVNET_URL = process.env.SOLANA_URL!;
const SOLANA_WALLET = process.env.SOLANA_WALLET!;
const CHAINGPT_CONTRACT_ADDRESS = process.env.CHAINGPT_CONTRACT_ADDRESS!;

let connection: Connection;
let proxyApi: NeonProxyRpcApi;
let solanaUser: SolanaNeonAccount;
let signer: Signer;
let chainGptContract: Contract;
let provider: JsonRpcProvider;

let skipPreflight = false;
let globalNonce: number = 0;

beforeAll(async () => {
  const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_WALLET));
  connection = new Connection(SOLANA_DEVNET_URL, 'confirmed');
  proxyApi = new NeonProxyRpcApi(NEON_API_RPC_URL);

  const result = await proxyApi.init(keypair);
  solanaUser = result.solanaUser;
  signer = solanaUser.signer!;
  provider = result.provider;

  // Initialize ChainGPT contract
  chainGptContract = new Contract(CHAINGPT_CONTRACT_ADDRESS, chainGptContractAbi, provider);

  // Solana wallet should be funded
  log(`Solana wallet: ${solanaUser.publicKey.toBase58()}
Neon wallet: ${solanaUser.neonWallet}; Balance Account: ${solanaUser.balanceAddress.toBase58()}
ChainGPT Contract: ${CHAINGPT_CONTRACT_ADDRESS}`);
});

afterEach(async () => {
  const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
  if (nonce > globalNonce) {
    globalNonce = nonce;
  } else {
    await delay(9e3);
  }
});

describe('ChainGPT Check-in Contract Test', () => {

  it('Should simulate user wallet connection and check-in flow signed with Solana wallet', async () => {
    const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));

    log(`Starting check-in flow for wallet: ${solanaUser.neonWallet}\nCurrent nonce: ${nonce}`);

    // Step 1: Get initial check-in count
    const initialCheckInCount = await chainGptContract.getTotalCheckIns(solanaUser.neonWallet);
    log(`Initial check-in count: ${initialCheckInCount.toString()}`);

    // Step 2: Prepare check-in transaction data
    const chainGptInterface = new Interface(chainGptContractAbi);
    const checkInData = chainGptInterface.encodeFunctionData('checkIn');

    const transactionData: TransactionData = {
      from: solanaUser.neonWallet,
      to: CHAINGPT_CONTRACT_ADDRESS,
      data: checkInData
    };

    // Step 3: Estimate gas for the transaction
    const transactionGas = await proxyApi.estimateScheduledTransactionGas({
      solanaPayer: solanaUser.publicKey,
      transactions: [transactionData]
    });

    log(`Estimated gas: ${JSON.stringify(transactionGas, null, 2)}`);

    // Step 4: Create scheduled transaction
    const { scheduledTransaction, transaction } = await proxyApi.createScheduledTransaction({
      transactionData,
      transactionGas
    });

    // Step 5: Send Solana transaction (simulating wallet signature)
    log('Sending Solana transaction (simulating wallet signature)...');
    const solanaSignature = await sendSolanaTransaction(
      connection,
      scheduledTransaction,
      [signer],
      true,
      { skipPreflight, preflightCommitment: 'confirmed' },
      'scheduled'
    );

    log(`Solana transaction signature: ${solanaSignature}`);

    // Step 6: Send scheduled transaction to proxy
    const txResult = await proxyApi.sendRawScheduledTransaction(transaction.serialize());
    log(`Proxy transaction result: ${JSON.stringify(txResult, null, 2)}`);

    // Step 7: Wait for transaction execution
    const transactionsStatus = await proxyApi.waitTransactionTreeExecution(
      solanaUser.neonWallet,
      nonce,
      120e3
    );

    // Step 8: Verify transaction success
    expect(transactionsStatus.length).toBeGreaterThan(0);

    for (const { transactionHash, status } of transactionsStatus) {
      log(`Transaction ${transactionHash} status: ${status}`);
      expect(status).toBe('Success');

      const { result } = await proxyApi.getTransactionReceipt(transactionHash);
      log(`Transaction receipt:`, result);
    }

    // Step 9: Verify check-in was recorded
    const finalCheckInCount = await chainGptContract.getTotalCheckIns(solanaUser.neonWallet);
    log(`Final check-in count: ${finalCheckInCount.toString()}`);

    expect(Number(finalCheckInCount)).toBe(Number(initialCheckInCount) + 1);

    log('Check-in flow completed successfully!');
  });
});
