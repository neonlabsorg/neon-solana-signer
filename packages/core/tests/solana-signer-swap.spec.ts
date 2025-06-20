import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { Connection, Keypair, PublicKey, Signer } from '@solana/web3.js';
import {
  delay,
  log,
  logJson,
  NeonProxyRpcApi,
  prepareSolanaInstructions,
  sendSolanaTransaction,
  SolanaNeonAccount, solanaTransactionLog,
  TransactionData
} from '@neonevm/solana-sign';
import { splTokenBalance } from '@neonevm/contracts-deployer';
import { erc20ForSPLContract } from '@neonevm/token-transfer-ethers';
import { Interface, parseUnits } from 'ethers';
import { config } from 'dotenv';
import bs58 from 'bs58';
import { approveTokenV2Instruction, usdc, wsol } from './tokens';
import { pancakeSwapRouterAbi } from './data/pancakeSwapRouter';

config({ path: '.env.devnet' });

const NEON_API_RPC_URL = `${process.env.NEON_CORE_API_RPC_URL!}/sol`;
const SOLANA_DEVNET_URL = process.env.SOLANA_URL!;
const SOLANA_WALLET = process.env.SOLANA_WALLET!;

let connection: Connection;
let proxyApi: NeonProxyRpcApi;
let neonEvmProgram: PublicKey;
let solanaUser: SolanaNeonAccount;
let signer: Signer;

let skipPreflight = false;
let globalNonce: number = 0;

beforeAll(async () => {
  const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_WALLET));
  connection = new Connection(SOLANA_DEVNET_URL, 'confirmed');
  proxyApi = new NeonProxyRpcApi(NEON_API_RPC_URL);
  const result = await proxyApi.init(keypair);
  solanaUser = result.solanaUser;
  neonEvmProgram = result.programAddress;
  signer = solanaUser.signer!;

  log(`Solana wallet: ${solanaUser.publicKey.toBase58()}; ${bs58.encode(solanaUser.keypair.secretKey)}`);
  log(`Neon wallet: ${solanaUser.neonWallet}; Balance Account: ${solanaUser.balanceAddress.toBase58()}`);

  // await solanaAirdrop(connection, solanaUser.publicKey, 60e9);
  // await solanaUser.balanceAccountCreate(connection);
});

afterEach(async () => {
  const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
  if (nonce > globalNonce) {
    globalNonce = nonce;
  } else {
    await delay(9e3);
  }
});

describe('Check Swap with Solana singer', () => {
  it(`Should swap 1 USDT to USDC in Solana with multiple transaction`, async () => {
    const amount = 1;
    const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
    const wsolBalance = await splTokenBalance(connection, solanaUser.publicKey, wsol);
    const usdcBalance = await splTokenBalance(connection, solanaUser.publicKey, usdc);

    const pancakeRouter = `0x9c58018c0599153cDCF5cEA9F1512f58dcFbF7a6`;
    log(`Token balance: ${wsolBalance?.uiAmountString} ${wsol.symbol}; ${usdcBalance?.uiAmountString} ${usdc.symbol}`);
    const pancaceSwapInterface = new Interface(pancakeSwapRouterAbi);
    const deadline = Math.round((Date.now() + 10 * 60 * 1e3) / 1e3);
    const amountFrom = parseUnits(amount.toString(), wsol.decimals);
    const approveData = erc20ForSPLContract().encodeFunctionData('approve', [pancakeRouter, amountFrom]);
    const swapData = pancaceSwapInterface.encodeFunctionData('swapExactTokensForTokens', [amountFrom, 0, [wsol.address, usdc.address], solanaUser.neonWallet, deadline]);

    const transactionsData: TransactionData[] = [{
      from: solanaUser.neonWallet,
      to: wsol.address,
      data: approveData
    }, {
      from: solanaUser.neonWallet,
      to: pancakeRouter,
      data: swapData
    }];

    const approveInstruction = await approveTokenV2Instruction(solanaUser, neonEvmProgram, wsol, amount);

    const transactionGas = await proxyApi.estimateScheduledTransactionGas({
      solanaPayer: solanaUser.publicKey,
      transactions: transactionsData,
      preparatorySolanaTransactions: [{ instructions: prepareSolanaInstructions([approveInstruction]) }]
    });

    const { scheduledTransaction, transactions } = await proxyApi.createMultipleTransaction({
      nonce,
      transactionsData,
      transactionGas,
      solanaInstructions: [approveInstruction]
    });

    await sendSolanaTransaction(connection, scheduledTransaction, [signer!], true, { skipPreflight }, 'scheduled');

    const result = await proxyApi.sendRawScheduledTransactions(transactions);

    logJson(result);

    const transactionsStatus = await proxyApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 120e3);
    for (const { transactionHash, status } of transactionsStatus) {
      const { result } = await proxyApi.getTransactionReceipt(transactionHash);
      log(`Transaction receipt`, result);
      expect(status).toBe('Success');
    }

    const usdcBalanceAfter = await splTokenBalance(connection, solanaUser.publicKey, wsol);
    const usdtBalanceAfter = await splTokenBalance(connection, solanaUser.publicKey, usdc);
    log(`Token balance: ${wsolBalance?.uiAmountString} ${wsol.symbol}; ${usdcBalance?.uiAmountString} ${usdc.symbol}`);
    log(`Token balance after: ${usdcBalanceAfter?.uiAmountString} ${wsol.symbol}; ${usdtBalanceAfter?.uiAmountString} ${usdc.symbol}`);
  });
});
