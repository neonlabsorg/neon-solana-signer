import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { splTokenBalance } from '@neonevm/contracts-deployer';
import {
  createBalanceAccountInstruction,
  delay,
  log,
  logJson,
  NeonProxyRpcApi,
  prepareSolanaInstructions,
  // prepareSolanaInstructions,
  sendSolanaTransaction,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import {
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
  Signer,
  Transaction
} from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from 'dotenv';
import { Contract, Interface, JsonRpcProvider, parseUnits } from 'ethers';
import { ERC20 } from './data/ERC20';
import { ethervistaSwapRouter } from './data/ethervistaSwapRouter';
import {
  getTokenSolAddress,
  InitDelegateAtaAndApproveMax,
  // InitDelegateAtaAndApproveMax,
  neonSwapETHForTokens,
  SolanaSignerTest,
  tcm,
  wsol
} from './ethervista';
import { approveTokenV2Instruction, createATAInstruction, solWrapInstructions } from './tokens';

config({ path: '.env.mainnet' });

const NEON_API_RPC_URL = `https://neon-proxy-mainnet.solana.p2p.org/sol`;
const SOLANA_DEVNET_URL = `https://solana-mainnet.core.chainstack.com/a3fc728f9b3577991b59b07423e0577d`;
const SOLANA_WALLET = process.env.SOLANA_WALLET!;

const SolanaRouterAddress = '0x638f26684ebe53e6d7d939bf9fafefcbdc42af4d';

let connection: Connection;
let proxyApi: NeonProxyRpcApi;
let neonEvmProgram: PublicKey;
let solanaUser: SolanaNeonAccount;
let signer: Signer;
let keypair: Keypair;
let provider: JsonRpcProvider;

let skipPreflight = false;
let globalNonce: number = 0;

beforeAll(async () => {
  keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_WALLET));
  connection = new Connection(SOLANA_DEVNET_URL, 'confirmed');
  proxyApi = new NeonProxyRpcApi(NEON_API_RPC_URL);
  const result = await proxyApi.init(keypair);
  provider = result.provider;
  solanaUser = result.solanaUser;
  neonEvmProgram = result.programAddress;
  signer = solanaUser.signer!;

  log(`Solana wallet: ${solanaUser.publicKey.toBase58()}`);
  log(
    `Neon wallet: ${solanaUser.neonWallet}; Balance Account: ${solanaUser.balanceAddress.toBase58()}`
  );

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
  it(`Test Swap`, async () => {
    const signer = new SolanaSignerTest(keypair, solanaUser, proxyApi, provider);

    const tokenAddress = tcm.address;
    const tokenSolPubKey = new PublicKey(
      await getTokenSolAddress(new Contract(wsol.address, ERC20.abi, signer.provider))
    );
    const amountIn = '0.0001';
    const amountOut = '0.573777524';
    const address1 = wsol.address;
    const address2 = tcm.address;
    const tokens = [address1, address2];
    const amountInWei = parseUnits(amountIn, wsol.decimals);
    const amountOutMin = parseUnits(amountOut, tcm.decimals);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 36000);
    const accountAddress = solanaUser.neonWallet;
    console.log('initializing and wrapping (if needed)...');
    await InitDelegateAtaAndApproveMax(
      signer,
      new PublicKey(wsol.address_spl),
      wsol.address,
      amountInWei,
      tokenSolPubKey
      // address2 // tokenWrapperAddr for the extra token mint
    );
    const { nonce } = await neonSwapETHForTokens(
      signer,
      amountInWei,
      amountOutMin,
      tokens,
      accountAddress,
      deadline
    );

    const transactionsStatus = await proxyApi.waitTransactionTreeExecution(
      solanaUser.neonWallet,
      nonce,
      120e3
    );
    for (const { transactionHash, status } of transactionsStatus) {
      const { result } = await proxyApi.getTransactionReceipt(transactionHash);
      log(`Transaction receipt`, result);
      expect(status).toBe('Success');
    }
  });

  it.skip(`Should swap .0001 SOL to 0.058412411 TCM in Solana with multiple transaction`, async () => {
    const address1 = wsol.address;
    const address2 = tcm.address;
    const tokens = [address1, address2];
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
    console.log(solanaUser.neonWallet);
    const neonWallet = solanaUser.neonWallet; // 0x wallet
    const router = SolanaRouterAddress;
    const iface = new Interface(ethervistaSwapRouter);
    const amountIn = '0.0001';
    const amountOut = '0.058412411';
    const amountInWei = parseUnits(amountIn, wsol.decimals);
    const amountOutMin = parseUnits(amountOut, tcm.decimals);

    /* ------------ 1. encode Router call ---------------------------- */
    const callData = iface.encodeFunctionData(
      'swapExactETHForTokensSupportingFeeOnTransferTokens',
      [amountInWei, amountOutMin, tokens, neonWallet, deadline]
    );

    const transactionsData: any[] /*TransactionData[]*/ = [
      {
        from: neonWallet,
        to: router,
        data: callData,
        value: '0x'
      }
    ];

    const amount = 1;
    const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
    const wsolBalance = await splTokenBalance(connection, solanaUser.publicKey, wsol);
    const tcmBalance = await splTokenBalance(connection, solanaUser.publicKey, tcm);

    // wrap sol before swap
    const wrapSolIns = await solWrapInstructions(connection, solanaUser.publicKey, amountInWei);
    const tokenATAIns = await createATAInstruction(
      connection,
      solanaUser.publicKey,
      new PublicKey(tcm.address_spl)
    );

    const trx = new Transaction();
    trx.add(...wrapSolIns, ...tokenATAIns);

    try {
      await sendSolanaTransaction(connection, trx, [signer!], true, { skipPreflight }, 'scheduled');
    } catch (error) {
      if (error instanceof SendTransactionError) {
        logJson(error);
        // console.error('SendTransactionError details:');
        // console.error('Message:', error.message);
        // console.error('Logs:', error.logs);
      }
      throw error;
    }

    log(
      `Token balance: ${wsolBalance?.uiAmountString} ${wsol.symbol}; ${tcmBalance?.uiAmountString} ${tcm.symbol}`
    );
    const approveWSolInstruction = await approveTokenV2Instruction(
      solanaUser,
      neonEvmProgram,
      wsol,
      amountInWei
    );
    const approveTcmInstruction = await approveTokenV2Instruction(
      solanaUser,
      neonEvmProgram,
      tcm,
      amountOutMin
    );

    const transactionGas = await proxyApi.estimateScheduledTransactionGas({
      solanaPayer: solanaUser.publicKey,
      transactions: transactionsData,
      preparatorySolanaTransactions: [
        { instructions: prepareSolanaInstructions([approveWSolInstruction, approveTcmInstruction]) }
      ]
    });

    log(transactionGas);

    const { scheduledTransaction, transactions } = await proxyApi.createMultipleTransaction({
      nonce,
      transactionsData,
      transactionGas,
      solanaInstructions: [...wrapSolIns, ...tokenATAIns, approveWSolInstruction]
    });

    const account = await connection.getAccountInfo(solanaUser.balanceAddress);

    if (account === null) {
      const { neonEvmProgram, publicKey, neonWallet, chainId } = solanaUser;
      scheduledTransaction.instructions.unshift(
        createBalanceAccountInstruction(neonEvmProgram, publicKey, neonWallet, chainId)
      );
    }

    try {
      await sendSolanaTransaction(
        connection,
        scheduledTransaction,
        [signer!],
        true,
        { skipPreflight },
        'scheduled'
      );
    } catch (error) {
      if (error instanceof SendTransactionError) {
        logJson;
      }
      throw error;
    }

    const result = await proxyApi.sendRawScheduledTransactions(transactions);

    logJson(result);

    const transactionsStatus = await proxyApi.waitTransactionTreeExecution(
      solanaUser.neonWallet,
      nonce,
      120e3
    );
    for (const { transactionHash, status } of transactionsStatus) {
      const { result } = await proxyApi.getTransactionReceipt(transactionHash);
      log(`Transaction receipt`, result);
      expect(status).toBe('Success');
    }

    const tcmBalanceAfter = await splTokenBalance(connection, solanaUser.publicKey, wsol);
    const usdtBalanceAfter = await splTokenBalance(connection, solanaUser.publicKey, tcm);
    log(
      `Token balance: ${wsolBalance?.uiAmountString} ${wsol.symbol}; ${tcmBalance?.uiAmountString} ${tcm.symbol}`
    );
    log(
      `Token balance after: ${tcmBalanceAfter?.uiAmountString} ${wsol.symbol}; ${usdtBalanceAfter?.uiAmountString} ${tcm.symbol}`
    );
  });
});
