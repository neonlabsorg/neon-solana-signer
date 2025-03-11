import { beforeAll, describe, expect, it } from '@jest/globals';
import { Connection, Keypair, PublicKey, Signer } from '@solana/web3.js';
import {
  delay,
  FaucetDropper,
  GasToken,
  getProxyState,
  log,
  neonAirdrop,
  sendSolanaTransaction,
  solanaAirdrop,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import {
  createAssociatedTokenAccount,
  mintTokenBalance,
  neonBalance,
  splTokenBalance
} from '@neonevm/contracts-deployer';
import {
  NeonProxyRpcApi as NeonTokenProxyRpcApi,
  neonWrapper2Abi,
  signerPrivateKey,
  solanaNEONTransferTransaction
} from '@neonevm/token-transfer-core';
import { neonNeonTransactionEthers, neonTransferMintTransactionEthers } from '@neonevm/token-transfer-ethers';
import { JsonRpcProvider, Wallet } from 'ethers';
import { config } from 'dotenv';
import bs58 from 'bs58';
import { erc20Tokens, NEON, NEON_TRANSFER_CONTRACT_TESTNET, wNEON } from './tokens';

config({ path: '.env' });

// todo deploy contracts for /sol proxy endpoint
const NEON_API_RPC_URL = `${process.env.NEON_CORE_API_RPC_URL!}`;
const SOLANA_DEVNET_URL = process.env.SOLANA_URL!;
const NEON_FAUCET_URL = process.env.NEON_FAUCET_URL!;
const SOLANA_WALLET = process.env.SOLANA_WALLET!;
const NEON_WALLET = process.env.NEON_WALLET!;

let connection: Connection;
let neonTokenProxyRpcApi: NeonTokenProxyRpcApi;
let provider: JsonRpcProvider;
let neonEvmProgram: PublicKey;
let chainId: number;
let chainTokenMint: PublicKey;
let gasToken: GasToken;
let faucet: FaucetDropper;
let solanaUser: SolanaNeonAccount;
let signer: Signer;
let neonWallet: Wallet;
let skipPreflight = false;

beforeAll(async () => {
  const result = await getProxyState(NEON_API_RPC_URL);
  const token = result.gasToken;
  const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_WALLET));
  connection = new Connection(SOLANA_DEVNET_URL, 'confirmed');
  provider = result.provider;
  neonTokenProxyRpcApi = new NeonTokenProxyRpcApi(NEON_API_RPC_URL);
  neonEvmProgram = result.evmProgramAddress;
  chainId = result.chainId;
  chainTokenMint = new PublicKey(token.gasToken.tokenMint);
  gasToken = token.gasToken;
  faucet = new FaucetDropper(NEON_FAUCET_URL);
  solanaUser = SolanaNeonAccount.fromKeypair(keypair, neonEvmProgram, chainTokenMint, chainId);
  signer = solanaUser.signer!;
  neonWallet = new Wallet(NEON_WALLET, provider);
  NEON.address_spl = gasToken.tokenMint;

  log(`Solana wallet: ${solanaUser.publicKey.toBase58()}; ${bs58.encode(solanaUser.keypair.secretKey)}`);
  log(`Neon wallet: ${solanaUser.neonWallet}; Balance Account: ${solanaUser.balanceAddress.toBase58()}`);

  await solanaAirdrop(connection, solanaUser.publicKey, 100e9);
  await neonAirdrop(provider, faucet, solanaUser.neonWallet, 100, gasToken.tokenName);
  await solanaUser.balanceAccountCreate(connection);
});

describe('Token transfer', () => {
  it(`Should transfer spl tokens from Solana to Neon EVM`, async () => {
    for (const token of erc20Tokens) {
      const amount = 100;
      log(`Transfer ${amount} ${token.symbol} from Solana to Neon EVM`);
      const solanaWalletSigner = new Wallet(signerPrivateKey(solanaUser.publicKey, neonWallet.address), provider);
      try {
        const transaction = await neonTransferMintTransactionEthers({
          connection,
          proxyApi: neonTokenProxyRpcApi,
          neonEvmProgram,
          solanaWallet: solanaUser.publicKey,
          neonWallet: neonWallet.address,
          walletSigner: solanaWalletSigner,
          splToken: token,
          amount,
          chainId
        });
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transaction.sign(solanaUser.signer);
        const { signature } = await sendSolanaTransaction(connection, transaction, [signer], true);
        const balance = await mintTokenBalance(neonWallet, token);
        log(`Token balance: ${balance} ${token.symbol}`);
        expect(signature.length).toBeGreaterThan(0);
      } catch (e) {
        console.log(e);
      }
    }
  });

  it(`Should transfer 10 NEON from Neon to Solana`, async () => {
    const amount = 10;
    try {
      const balanceBefore = await neonBalance(provider, neonWallet);
      const transaction = await neonNeonTransactionEthers({
        provider,
        from: neonWallet.address,
        to: NEON_TRANSFER_CONTRACT_TESTNET,
        solanaWallet: solanaUser.publicKey,
        amount
      });
      transaction.nonce = await neonWallet.getNonce();
      const response = await neonWallet.sendTransaction(transaction);
      expect(response.hash.length).toBeGreaterThan(2);
      await delay(20e3);
      const balanceSPL = await splTokenBalance(connection, solanaUser.publicKey, NEON);
      const balanceAfter = await neonBalance(provider, neonWallet);
      log(`Balance: ${balanceBefore} > ${balanceAfter} NEON ==> ${balanceSPL?.uiAmount} ${NEON.symbol} in Solana`);
      expect(balanceAfter.toNumber()).toBeLessThan(balanceBefore.toNumber());
    } catch (e) {
      console.log(e);
      expect(e instanceof Error ? e.message : '').toBe('');
    }
  });

  it(`Should transfer 1 NEON from Solana to Neon`, async () => {
    const amount = 1;
    await createAssociatedTokenAccount(connection, signer, NEON);
    const balanceBefore = await splTokenBalance(connection, solanaUser.publicKey, NEON);
    console.log(`Balance: ${balanceBefore?.uiAmount ?? 0} ${NEON.symbol}`);
    try {
      const transaction = await solanaNEONTransferTransaction({
        solanaWallet: solanaUser.publicKey,
        neonWallet: neonWallet.address,
        neonEvmProgram,
        neonTokenMint: chainTokenMint,
        token: NEON,
        amount,
        chainId
      });
      transaction.recentBlockhash = (await connection.getLatestBlockhash('finalized')).blockhash;
      const { signature } = await sendSolanaTransaction(connection, transaction, [signer], false, { skipPreflight });
      expect(signature.length).toBeGreaterThan(0);
      await delay(10e3);
      const balanceAfter = await splTokenBalance(connection, solanaUser.publicKey, NEON);
      const balanceNeon = await neonBalance(provider, neonWallet);
      console.log(`Balance: ${balanceBefore?.uiAmount} > ${balanceAfter?.uiAmount} ${NEON.symbol} ==> ${balanceNeon} ${NEON.symbol} in Neon`);
      expect(balanceAfter?.uiAmount).toBeLessThan(balanceBefore?.uiAmount!);
    } catch (e) {
      console.log(e);
    }
  });

  it('Should wrap 10 NEON to wNEON in Neon network', async () => {
    const amount = 10;
    const neonBalanceBefore = await neonBalance(provider, neonWallet);
    const wneonBalanceBefore = await mintTokenBalance(neonWallet, wNEON, neonWrapper2Abi);
    try {
      const wrapTransaction = await neonNeonTransactionEthers({
        provider,
        from: neonWallet.address,
        to: wNEON.address,
        solanaWallet: solanaUser.publicKey,
        amount
      });
      wrapTransaction.nonce = await neonWallet.getNonce();
      const wtResponse = await neonWallet.sendTransaction(wrapTransaction);
      expect(wtResponse.hash.length).toBeGreaterThan(2);
      await delay(5e3);

      const wneonBalanceAfter = await mintTokenBalance(neonWallet, wNEON, neonWrapper2Abi);
      const neonBalanceAfter = await neonBalance(provider, neonWallet);

      log(`Balance: ${wneonBalanceBefore} => ${wneonBalanceAfter} ${wNEON.symbol} in Neon`);
      log(`Balance: ${neonBalanceBefore} => ${neonBalanceAfter} ${NEON.symbol} in Neon`);
      expect(wneonBalanceAfter).toBeGreaterThanOrEqual(wneonBalanceBefore);
      expect(neonBalanceAfter.toNumber()).toBeLessThanOrEqual(neonBalanceBefore.toNumber());
    } catch (e) {
      log(e);
      expect(e instanceof Error ? e.message : '').toBe('');
    }
  });
});
