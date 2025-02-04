import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { Connection, Keypair, PublicKey, Signer, Transaction } from '@solana/web3.js';
import {
  createScheduledNeonEvmMultipleTransaction,
  createScheduledNeonEvmTransaction,
  delay,
  getGasToken,
  getProxyState,
  log,
  logJson,
  MultipleTransactions,
  NeonChainId,
  NeonProxyRpcApi,
  NO_CHILD_INDEX,
  ScheduledTransaction,
  sendSolanaTransaction,
  solanaAirdrop,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { balanceView, createAssociatedTokenAccount, tokenBalance } from '@neonevm/contracts-deployer';
import { claimTransactionData, mintNeonTransactionData } from '@neonevm/token-transfer-ethers';
import { authAccountAddress, toFullAmount } from '@neonevm/token-transfer-core';
import { createApproveInstruction, getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { JsonRpcProvider } from 'ethers';
import { config } from 'dotenv';
import bs58 from 'bs58';
import { erc20Tokens, usdc, usdt } from './tokens';

config({ path: '.env' });

const NEON_API_RPC_SOL_URL = `${process.env.NEON_CORE_API_RPC_URL!}/sol`;
const NEON_API_RPC_NEON_URL = `${process.env.NEON_CORE_API_RPC_URL!}/neon`;
const SOLANA_DEVNET_URL = process.env.SOLANA_URL!;
const SOLANA_WALLET = process.env.SOLANA_WALLET!;

let connection: Connection;
let neonProxyRpcApi: NeonProxyRpcApi;
let provider: JsonRpcProvider;
let neonEvmProgram: PublicKey;
let chainId: number;
let chainTokenMint: PublicKey;
let solanaUser: SolanaNeonAccount;
let signer: Signer;

let skipPreflight = false;
let globalNonce: number = 0;

beforeAll(async () => {
  const chainIdTestnet = NeonChainId.testnetSol;
  const result = await getProxyState(NEON_API_RPC_SOL_URL);
  const token = getGasToken(result.tokensList, chainIdTestnet);
  const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_WALLET));
  connection = new Connection(SOLANA_DEVNET_URL, 'confirmed');
  provider = new JsonRpcProvider(NEON_API_RPC_NEON_URL!);
  neonProxyRpcApi = result.proxyApi;
  neonEvmProgram = result.evmProgramAddress;
  chainId = Number(token.gasToken.tokenChainId);
  chainTokenMint = new PublicKey(token.gasToken.tokenMint);
  solanaUser = SolanaNeonAccount.fromKeypair(keypair, neonEvmProgram, chainTokenMint, chainId);
  signer = solanaUser.signer!;

  log(`Solana wallet: ${solanaUser.publicKey.toBase58()}; ${bs58.encode(solanaUser.keypair.secretKey)}`);
  log(`Neon wallet: ${solanaUser.neonWallet}; Balance Account: ${solanaUser.balanceAddress.toBase58()}`);

  await solanaAirdrop(connection, solanaUser.publicKey, 60e9);
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

describe('Check Swap with Solana singer', () => {
  it.skip(`Should transfer spl tokens from Solana to Neon wallet`, async () => {
    for (const token of erc20Tokens) {
      const amount = 100;
      log(`Transfer ${amount} ${token.symbol} from Solana to Neon EVM`);
      const fromATA = getAssociatedTokenAddressSync(new PublicKey(token.address_spl), solanaUser.publicKey);
      const tokenAmount = toFullAmount(amount, token.decimals);
      // const approveData = erc20ForSPLContract().encodeFunctionData('approve', [solanaUser.neonWallet, parseUnits(amount.toString(), token.decimals)]);
      const climeData = claimTransactionData(fromATA, solanaUser.neonWallet, tokenAmount);
      const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));

      // Approve for climeTo
      const transaction = new Transaction();
      const [delegatePDA] = authAccountAddress(solanaUser.neonWallet, neonEvmProgram, token);
      const approveInstruction = createApproveInstruction(fromATA, delegatePDA, solanaUser.publicKey, tokenAmount);
      transaction.instructions.push(approveInstruction);
      await sendSolanaTransaction(connection, transaction, [solanaUser.signer!], true, {
        skipPreflight,
        preflightCommitment: 'confirmed'
      }, 'approve');

      const { result } = await neonProxyRpcApi.estimateScheduledGas({
        scheduledSolanaPayer: solanaUser.publicKey.toBase58(),
        transactions: [{
          from: solanaUser.neonWallet,
          to: token.address,
          data: climeData
        }]
      });

      const maxFeePerGas = result?.maxFeePerGas;
      const maxPriorityFeePerGas = result?.maxPriorityFeePerGas;
      const gasLimit = result?.gasList[0];
      const scheduledTransaction = new ScheduledTransaction({
        nonce: nonce,
        payer: solanaUser.neonWallet,
        target: token.address,
        callData: climeData,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
        gasLimit: gasLimit,
        chainId: chainId
      });

      // [1] climeTo
      const createScheduledTransaction = createScheduledNeonEvmTransaction({
        chainId: chainId,
        signerAddress: solanaUser.publicKey,
        tokenMintAddress: solanaUser.tokenMint,
        neonEvmProgram: neonEvmProgram,
        neonWallet: solanaUser.neonWallet,
        neonWalletNonce: nonce,
        neonTransaction: scheduledTransaction.serialize()
      });

      const treasuryPool = createScheduledTransaction.instructions[0].keys[2].pubkey;
      await solanaAirdrop(connection, treasuryPool, 20e9);

      const { signature } = await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer!], true, {
        skipPreflight,
        preflightCommitment: 'confirmed'
      }, 'scheduled');

      const response = await neonProxyRpcApi.waitTransactionByHash(signature, 2e3);
      log('waitTransactionByHash', response);

      const transactions = await neonProxyRpcApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 7e3);
      for (const { transactionHash, status } of transactions) {
        const { result } = await neonProxyRpcApi.getTransactionReceipt(transactionHash);
        log(`Transaction receipt`, result);
        expect(status).toBe('Success');
      }
    }
  });

  it(`Should send to Solana 1 USDT from Neon EVM to Solana`, async () => {
    const amount = 1;
    await createAssociatedTokenAccount(connection, signer, usdc);
    const balance = await tokenBalance(provider, solanaUser.neonWallet, usdc);
    log(`Token balance: ${balance} ${usdc.symbol}`);

    const associatedToken = getAssociatedTokenAddressSync(new PublicKey(usdc.address_spl), solanaUser.publicKey);
    const account = await getAccount(connection, associatedToken);
    if (account) {
      log(`Token balance: ${balanceView(account.amount, usdc.decimals)}  ${usdc.symbol}`);
    }
    const data = mintNeonTransactionData(associatedToken, usdc, amount);

    const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
    const { result, error } = await neonProxyRpcApi.estimateScheduledGas({
      scheduledSolanaPayer: solanaUser.publicKey.toBase58(),
      transactions: [{
        from: solanaUser.neonWallet,
        to: usdc.address,
        data
      }]
    });

    logJson(result);
    logJson(error);

    const maxFeePerGas = result?.maxFeePerGas;
    const maxPriorityFeePerGas = result?.maxPriorityFeePerGas;
    const gasLimit = result?.gasList[0];
    const scheduledTransaction = new ScheduledTransaction({
      nonce: nonce,
      payer: solanaUser.neonWallet,
      index: 0,
      target: usdc.address,
      callData: data,
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      gasLimit: gasLimit,
      chainId: chainId
    });

    console.log(scheduledTransaction.data);

    const createScheduledTransaction = createScheduledNeonEvmTransaction({
      chainId: chainId,
      signerAddress: solanaUser.publicKey,
      tokenMintAddress: solanaUser.tokenMint,
      neonEvmProgram: neonEvmProgram,
      neonWallet: solanaUser.neonWallet,
      neonWalletNonce: nonce,
      neonTransaction: scheduledTransaction.serialize()
    });

    // for testnet treasury pool need to have tokens for gas fee
    const treasuryPool = createScheduledTransaction.instructions[0].keys[2].pubkey;
    await solanaAirdrop(connection, treasuryPool, 20e9);

    const { signature } = await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer!], true, {
      skipPreflight,
      preflightCommitment: 'confirmed'
    }, 'scheduled');

    const response = await neonProxyRpcApi.waitTransactionByHash(signature, 2e3);
    log('waitTransactionByHash', response);

    const transactions = await neonProxyRpcApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 7e3);
    for (const { transactionHash, status } of transactions) {
      const { result } = await neonProxyRpcApi.getTransactionReceipt(transactionHash);
      log(`Transaction receipt`, result);
      expect(status).toBe('Success');
    }
  });

  it(`Should transfer 1 USDT from Solana to Neon EVM`, async () => {
    const amount = 1;
    const associatedTokenAddress = getAssociatedTokenAddressSync(new PublicKey(usdt.address_spl), solanaUser.publicKey);
    const usdtAmount = toFullAmount(amount, usdt.decimals);
    const climeData = claimTransactionData(associatedTokenAddress, solanaUser.neonWallet, usdtAmount);
    // const data = erc20ForSPLContract().encodeFunctionData('claim', [associatedTokenAddress.toBuffer(), usdtAmount]);

    // Approve for climeTo
    const transaction = new Transaction();
    const [delegatePDA] = authAccountAddress(solanaUser.neonWallet, neonEvmProgram, usdt);
    const approveInstruction = createApproveInstruction(associatedTokenAddress, delegatePDA, solanaUser.publicKey, usdtAmount);
    transaction.instructions.push(approveInstruction);

    await sendSolanaTransaction(connection, transaction, [solanaUser.signer!], true, {
      skipPreflight,
      preflightCommitment: 'confirmed'
    }, 'approve');

    const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));

    const { result, error } = await neonProxyRpcApi.estimateScheduledGas({
      scheduledSolanaPayer: solanaUser.publicKey.toBase58(),
      transactions: [{
        from: solanaUser.neonWallet,
        to: usdt.address,
        data: climeData
      }]
    });

    logJson(result);
    logJson(error);

    const maxFeePerGas = result?.maxFeePerGas;
    const maxPriorityFeePerGas = result?.maxPriorityFeePerGas;
    const gasLimit = result?.gasList[0];

    const scheduledTransaction = new ScheduledTransaction({
      nonce: nonce,
      payer: solanaUser.neonWallet,
      target: usdt.address,
      callData: climeData,
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      gasLimit: gasLimit,
      chainId: chainId
    });

    // [1] climeTo
    const createScheduledTransaction = createScheduledNeonEvmTransaction({
      chainId: chainId,
      signerAddress: solanaUser.publicKey,
      tokenMintAddress: solanaUser.tokenMint,
      neonEvmProgram: neonEvmProgram,
      neonWallet: solanaUser.neonWallet,
      neonWalletNonce: nonce,
      neonTransaction: scheduledTransaction.serialize()
    });

    const treasuryPool = createScheduledTransaction.instructions[0].keys[2].pubkey;
    await solanaAirdrop(connection, treasuryPool, 20e9);

    const { signature } = await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer!], true, {
      skipPreflight,
      preflightCommitment: 'confirmed'
    }, 'scheduled');

    const response = await neonProxyRpcApi.waitTransactionByHash(signature, 2e3);
    log('waitTransactionByHash', response);

    const transactions = await neonProxyRpcApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 7e3);
    for (const { transactionHash, status } of transactions) {
      const { result } = await neonProxyRpcApi.getTransactionReceipt(transactionHash);
      log(`Transaction receipt`, result);
      expect(status).toBe('Success');
    }
  });

  it(`Should swap 1 USDT to USDC in Solana with multiple transaction`, async () => {
    const amount = 1;
    const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
    const usdcBalance = await tokenBalance(provider, solanaUser.neonWallet, usdc);
    const usdtBalance = await tokenBalance(provider, solanaUser.neonWallet, usdt);
    log(`Token balance: ${usdcBalance} ${usdc.symbol}; ${usdtBalance} ${usdt.symbol}`);

    const usdtATA = getAssociatedTokenAddressSync(new PublicKey(usdt.address_spl), solanaUser.publicKey);
    const usdtAmount = toFullAmount(amount, usdt.decimals);
    const climeToData = claimTransactionData(usdtATA, solanaUser.neonWallet, usdtAmount);

    const usdcATA = getAssociatedTokenAddressSync(new PublicKey(usdc.address_spl), solanaUser.publicKey);
    const sendSolanaData = mintNeonTransactionData(usdcATA, usdc, amount);

    // Approve for climeTo
    const transaction = new Transaction();
    const [delegatePDA] = authAccountAddress(solanaUser.neonWallet, neonEvmProgram, usdt);
    const approveInstruction = createApproveInstruction(usdtATA, delegatePDA, solanaUser.publicKey, usdtAmount);
    transaction.instructions.unshift(approveInstruction);
    await sendSolanaTransaction(connection, transaction, [solanaUser.signer!], true, { skipPreflight }, 'approve');

    const { result, error } = await neonProxyRpcApi.estimateScheduledGas({
      scheduledSolanaPayer: solanaUser.publicKey.toBase58(),
      transactions: [{
        from: solanaUser.neonWallet,
        to: usdt.address,
        data: climeToData
      }, {
        from: solanaUser.neonWallet,
        to: usdc.address,
        data: sendSolanaData
      }]
    });

    logJson(result);
    logJson(error);

    const maxFeePerGas = result?.maxFeePerGas;
    const maxPriorityFeePerGas = result?.maxPriorityFeePerGas;
    const gasLimit = result?.gasList;
    const transactionSendUSDT = new ScheduledTransaction({
      nonce: nonce,
      payer: solanaUser.neonWallet,
      index: 0,
      target: usdt.address,
      callData: climeToData,
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      gasLimit: gasLimit[0],
      chainId: chainId
    });

    const transactionSendUSDC = new ScheduledTransaction({
      nonce: nonce,
      payer: solanaUser.neonWallet,
      index: 1,
      target: usdc.address,
      callData: sendSolanaData,
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      gasLimit: gasLimit[1],
      chainId: chainId
    });

    const multiple = new MultipleTransactions(nonce, parseInt(maxFeePerGas, 16), parseInt(maxPriorityFeePerGas, 16));
    multiple.addTransaction(transactionSendUSDT, 1, 0);
    multiple.addTransaction(transactionSendUSDC, NO_CHILD_INDEX, 1);

    // scheduled trx
    const createScheduledTransaction = createScheduledNeonEvmMultipleTransaction({
      chainId: chainId,
      neonEvmProgram: neonEvmProgram,
      neonTransaction: multiple.data,
      signerAddress: solanaUser.publicKey,
      tokenMintAddress: solanaUser.tokenMint,
      neonWallet: solanaUser.neonWallet,
      neonWalletNonce: nonce
    });

    // for this test, we check that the pool account has tokens on test stand
    const treasuryPool = createScheduledTransaction.instructions[0].keys[2].pubkey;
    await solanaAirdrop(connection, treasuryPool, 20e9);

    const { signature } = await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer!], true, { skipPreflight }, 'scheduled');
    const response = await neonProxyRpcApi.waitTransactionByHash(signature, 5e3);
    log(response);
    await delay(2e3);

    const transaction1 = await neonProxyRpcApi.sendRawScheduledTransaction(`0x${transactionSendUSDC.serialize()}`);
    const transaction2 = await neonProxyRpcApi.sendRawScheduledTransaction(`0x${transactionSendUSDT.serialize()}`);
    log(transaction1.result, transaction2.result);

    const transactions = await neonProxyRpcApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 7e3);
    for (const { transactionHash, status } of transactions) {
      const { result } = await neonProxyRpcApi.getTransactionReceipt(transactionHash);
      log(`Transaction receipt`, result);
      expect(status).toBe('Success');
    }

    const usdcBalanceAfter = await tokenBalance(provider, solanaUser.neonWallet, usdc);
    const usdtBalanceAfter = await tokenBalance(provider, solanaUser.neonWallet, usdt);
    log(`Token balance: ${usdcBalance} ${usdc.symbol}; ${usdtBalance} ${usdt.symbol}`);
    log(`Token balance after: ${usdcBalanceAfter} ${usdc.symbol}; ${usdtBalanceAfter} ${usdt.symbol}`);
  });
});
