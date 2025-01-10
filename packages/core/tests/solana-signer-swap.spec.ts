import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { Connection, Keypair, PublicKey, Signer } from '@solana/web3.js';
import {
  createScheduledNeonEvmMultipleTransaction,
  createScheduledNeonEvmTransaction,
  delay,
  FaucetDropper,
  GasToken,
  getGasToken,
  getProxyState,
  log,
  logJson,
  MultipleTransactions,
  NeonChainId,
  NeonClientApi,
  NeonProgramStatus,
  NeonProxyRpcApi,
  NO_CHILD_INDEX,
  ScheduledTransaction,
  sendSolanaTransaction,
  solanaAirdrop,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { balanceView, BaseContract, createAssociatedTokenAccount, tokenBalance } from '@neonevm/solana-contracts';
import { claimTransactionData, mintNeonTransactionData } from '@neonevm/token-transfer-ethers';
import { authAccountAddress, toFullAmount } from '@neonevm/token-transfer-core';
import { createApproveInstruction, getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { JsonRpcProvider, Wallet } from 'ethers';
import { config } from 'dotenv';
import bs58 from 'bs58';
import { erc20Tokens, usdc, usdt } from './tokens';

config({ path: '.env' });

const NEON_API_RPC_SOL_URL = `${process.env.NEON_CORE_API_RPC_URL!}/sol`;
const NEON_API_RPC_NEON_URL = `${process.env.NEON_CORE_API_RPC_URL!}/neon`;
const NEON_CLIENT_API_URL = process.env.NEON_CORE_API_URL!;
const SOLANA_DEVNET_URL = process.env.SOLANA_URL!;
const NEON_FAUCET_URL = process.env.NEON_FAUCET_URL!;
const SOLANA_WALLET = process.env.SOLANA_WALLET!;
const NEON_WALLET = process.env.NEON_WALLET!;

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
let signer: Signer;
let baseContract: BaseContract;
let neonWallet: Wallet;
let tokenList: GasToken[] = [];

let skipPreflight = false;
let globalNonce: number = 0;

beforeAll(async () => {
  const chainIdTestnet = NeonChainId.testnetSol;
  // const chainIdDevnet = NeonChainId.devnetSol;
  const result = await getProxyState(NEON_API_RPC_SOL_URL);
  const token = getGasToken(result.tokensList, chainIdTestnet);
  const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_WALLET));
  tokenList = result.tokensList;
  connection = new Connection(SOLANA_DEVNET_URL, 'confirmed');
  provider = new JsonRpcProvider(NEON_API_RPC_NEON_URL!);
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
  neonWallet = new Wallet(NEON_WALLET, provider);
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
  it(`Should transfer spl tokens from Solana to Neon wallet`, async () => {
    for (const token of erc20Tokens) {
      const amount = 100;
      log(`Transfer ${amount} ${token.symbol} from Solana to Neon EVM`);
      const associatedTokenAddress = getAssociatedTokenAddressSync(new PublicKey(token.address_spl), solanaUser.publicKey);
      const tokenAmount = toFullAmount(amount, token.decimals);
      const climeData = claimTransactionData(associatedTokenAddress, solanaUser.neonWallet, tokenAmount);

      const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
      const maxFeePerGas = 0x77359400;
      const scheduledTransaction = new ScheduledTransaction({
        nonce: nonce,
        payer: solanaUser.neonWallet,
        target: token.address,
        callData: climeData,
        maxFeePerGas: maxFeePerGas,
        chainId: chainId
      });

      // [1] climeTo
      const createScheduledTransaction = await createScheduledNeonEvmTransaction({
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

      // [0] approve
      const [delegatePDA] = authAccountAddress(solanaUser.neonWallet, neonEvmProgram, token);
      const approveInstruction = createApproveInstruction(associatedTokenAddress, delegatePDA, solanaUser.publicKey, tokenAmount);
      createScheduledTransaction.instructions.unshift(approveInstruction);

      const { signature } = await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer!], true, {
        skipPreflight,
        preflightCommitment: 'confirmed'
      }, 'scheduled');

      const response = await neonProxyRpcApi.waitTransactionByHash(signature, 2e3);
      log(response);

      const transactions = await neonClientApi.waitTransactionTreeExecution({
        address: solanaUser.neonWallet,
        chain_id: chainId
      }, nonce, 2e3);

      log(`Scheduled transactions result`, transactions);
      for (const { transaction_hash, status } of transactions) {
        const { result } = await neonProxyRpcApi.getTransactionReceipt(`0x${transaction_hash}`);
        console.log(result);
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
      console.log(`Token balance: ${balanceView(account.amount, usdc.decimals)}  ${usdc.symbol}`);
    }
    const data = mintNeonTransactionData(associatedToken, usdc, amount);

    const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
    const maxFeePerGas = 0x77359400; // 0x3B9ACA00;
    const scheduledTransaction = new ScheduledTransaction({
      nonce: nonce,
      payer: solanaUser.neonWallet,
      index: 0,
      target: usdc.address,
      callData: data,
      maxFeePerGas: maxFeePerGas,
      chainId: chainId
    });

    const createScheduledTransaction = await createScheduledNeonEvmTransaction({
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
    log(response);

    const transactions = await neonClientApi.waitTransactionTreeExecution({
      address: solanaUser.neonWallet,
      chain_id: chainId
    }, nonce, 2e3);

    log(`Scheduled transactions result`, transactions);
    for (const { transaction_hash, status } of transactions) {
      const { result } = await neonProxyRpcApi.getTransactionReceipt(`0x${transaction_hash}`);
      logJson(result);
      expect(status).toBe('Success');
    }
  });

  it(`Should transfer 1 USDT from Solana to Neon EVM`, async () => {
    const amount = 1;
    const associatedTokenAddress = getAssociatedTokenAddressSync(new PublicKey(usdt.address_spl), solanaUser.publicKey);
    const usdtAmount = toFullAmount(amount, usdt.decimals);
    const climeData = claimTransactionData(associatedTokenAddress, solanaUser.neonWallet, usdtAmount);
    // const data = erc20ForSPLContract().encodeFunctionData('claim', [associatedTokenAddress.toBuffer(), usdtAmount]);

    const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
    const maxFeePerGas = 0x77359400;
    const scheduledTransaction = new ScheduledTransaction({
      nonce: nonce,
      payer: solanaUser.neonWallet,
      target: usdt.address,
      callData: climeData,
      maxFeePerGas: maxFeePerGas,
      chainId: chainId
    });

    // [1] climeTo
    const createScheduledTransaction = await createScheduledNeonEvmTransaction({
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

    // [0] approve
    const [delegatePDA] = authAccountAddress(solanaUser.neonWallet, neonEvmProgram, usdt);
    const approveInstruction = createApproveInstruction(associatedTokenAddress, delegatePDA, solanaUser.publicKey, usdtAmount);
    createScheduledTransaction.instructions.unshift(approveInstruction);

    const { signature } = await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer!], true, {
      skipPreflight,
      preflightCommitment: 'confirmed'
    }, 'scheduled');

    const response = await neonProxyRpcApi.waitTransactionByHash(signature, 2e3);
    log(response);

    const transactions = await neonClientApi.waitTransactionTreeExecution({
      address: solanaUser.neonWallet,
      chain_id: chainId
    }, nonce, 2e3);

    log(`Scheduled transactions result`, transactions);
    for (const { transaction_hash, status } of transactions) {
      const { result } = await neonProxyRpcApi.getTransactionReceipt(`0x${transaction_hash}`);
      expect(status).toBe('Success');
    }
  });

  it.skip(`Should swap 1 USDT to USDC in Solana`, async () => {
    const amount = 1;
    const maxFeePerGas = 0xEE6B2800; // 0x3B9ACA00;
    const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
    const usdcBalance = await tokenBalance(provider, solanaUser.neonWallet, usdc);
    const usdtBalance = await tokenBalance(provider, solanaUser.neonWallet, usdt);
    log(`Token balance: ${usdcBalance} ${usdc.symbol}; ${usdtBalance} ${usdt.symbol}`);

    const usdcATA = getAssociatedTokenAddressSync(new PublicKey(usdc.address_spl), solanaUser.publicKey);
    const sendSolanaData = mintNeonTransactionData(usdcATA, usdc, amount);

    const transactionSendUSDC = new ScheduledTransaction({
      nonce: nonce,
      payer: solanaUser.neonWallet,
      index: 0,
      target: usdc.address,
      callData: sendSolanaData,
      maxFeePerGas: maxFeePerGas,
      chainId: chainId
    });

    const usdtATA = getAssociatedTokenAddressSync(new PublicKey(usdt.address_spl), solanaUser.publicKey);
    const usdtAmount = toFullAmount(amount, usdt.decimals);
    const climeToData = claimTransactionData(usdtATA, solanaUser.neonWallet, usdtAmount);

    const transactionSendUSDT = new ScheduledTransaction({
      nonce: nonce,
      payer: solanaUser.neonWallet,
      index: 1,
      target: usdt.address,
      callData: climeToData,
      maxFeePerGas: maxFeePerGas,
      chainId: chainId
    });

    const multiple = new MultipleTransactions(nonce, maxFeePerGas);
    multiple.addTransaction(transactionSendUSDC, 1, 0);
    multiple.addTransaction(transactionSendUSDT, NO_CHILD_INDEX, 1);

    // [0] scheduled trx
    const createScheduledTransaction = await createScheduledNeonEvmMultipleTransaction({
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

    // [0] approve
    const [delegatePDA] = authAccountAddress(solanaUser.neonWallet, neonEvmProgram, usdt);
    const approveInstruction = createApproveInstruction(usdtATA, delegatePDA, solanaUser.publicKey, usdtAmount);
    createScheduledTransaction.instructions.unshift(approveInstruction);

    const { signature } = await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer!], true, { skipPreflight }, 'scheduled');
    const response = await neonProxyRpcApi.waitTransactionByHash(signature, 5e3);
    log(response);
    await delay(2e3);

    const transaction1 = await neonProxyRpcApi.sendRawScheduledTransaction(`0x${transactionSendUSDC.serialize()}`);
    const transaction2 = await neonProxyRpcApi.sendRawScheduledTransaction(`0x${transactionSendUSDT.serialize()}`);
    log(transaction1.result, transaction2.result);

    const transactions = await neonClientApi.waitTransactionTreeExecution({
      address: solanaUser.neonWallet,
      chain_id: chainId
    }, nonce, 7e3);
    log(`Scheduled transactions result`, transactions);
    for (const { transaction_hash, status } of transactions) {
      const { result } = await neonProxyRpcApi.getTransactionReceipt(`0x${transaction_hash}`);
      logJson(result);
      expect(status).toBe('Success');
    }

    const usdcBalanceAfter = await tokenBalance(provider, solanaUser.neonWallet, usdc);
    const usdtBalanceAfter = await tokenBalance(provider, solanaUser.neonWallet, usdt);
    log(`Token balance: ${usdcBalanceAfter} ${usdc.symbol}; ${usdtBalanceAfter} ${usdt.symbol}`);
  });
});
