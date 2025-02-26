import { beforeAll, describe, expect, it } from '@jest/globals';
import { Connection, Keypair, PublicKey, Signer } from '@solana/web3.js';
import {
  delay,
  FaucetDropper,
  GasToken,
  getGasToken,
  getProxyState,
  log,
  NeonChainId,
  sendSolanaTransaction,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { createAssociatedTokenAccount, neonBalance, solanaBalance } from '@neonevm/contracts-deployer';
import { NEON_TOKEN_MINT_DECIMALS, solanaSOLTransferTransaction, SPLToken } from '@neonevm/token-transfer-core';
import { JsonRpcProvider, Wallet } from 'ethers';
import { config } from 'dotenv';
import bs58 from 'bs58';

config({ path: '.env' });

const NEON_API_RPC_URL = `${process.env.NEON_CORE_API_RPC_URL!}/sol`;
const SOLANA_DEVNET_URL = process.env.SOLANA_URL!;
const NEON_FAUCET_URL = process.env.NEON_FAUCET_URL!;
const SOLANA_WALLET = process.env.SOLANA_WALLET!;
const NEON_WALLET = process.env.NEON_WALLET!;

const NEON: SPLToken = {
  chainId: 111,
  address_spl: '',
  address: '',
  decimals: NEON_TOKEN_MINT_DECIMALS,
  name: 'Neon',
  symbol: 'NEON',
  logoURI: 'https://raw.githubusercontent.com/neonlabsorg/token-list/main/neon_token_md.png'
};

let connection: Connection;
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
  const token = getGasToken(result.tokensList, NeonChainId.testnetSol);
  const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_WALLET));
  connection = new Connection(SOLANA_DEVNET_URL, 'confirmed');
  provider = new JsonRpcProvider(NEON_API_RPC_URL!);
  neonEvmProgram = result.evmProgramAddress;
  chainId = Number(token.gasToken.tokenChainId);
  chainTokenMint = new PublicKey(token.gasToken.tokenMint);
  gasToken = token.gasToken;
  faucet = new FaucetDropper(NEON_FAUCET_URL);
  solanaUser = SolanaNeonAccount.fromKeypair(keypair, neonEvmProgram, chainTokenMint, chainId);
  signer = solanaUser.signer!;
  neonWallet = new Wallet(NEON_WALLET, provider);
  NEON.address_spl = gasToken.tokenMint;

  log(`Solana wallet: ${solanaUser.publicKey.toBase58()}; ${bs58.encode(solanaUser.keypair.secretKey)}`);
  log(`Neon wallet: ${solanaUser.neonWallet}; Balance Account: ${solanaUser.balanceAddress.toBase58()}`);

  // await solanaAirdrop(connection, solanaUser.publicKey, 100e9);
  // await neonAirdrop(provider, faucet, neonWallet.address, 100, gasToken.tokenName);
  await solanaUser.balanceAccountCreate(connection);
});

describe('Token transfer (SOL)', () => {
  it.skip(`Should transfer 1 SOL from Solana to NeonEVM (SOL)`, async () => {
    const amount = 10;
    const solToken: SPLToken = {
      address: '',
      address_spl: gasToken.tokenMint,
      chainId,
      decimals: 9,
      name: 'Solana SOL',
      symbol: 'SOL',
      logoURI: 'https://raw.githubusercontent.com/neonlabsorg/token-list/master/assets/solana-sol-logo.svg'
    };
    await createAssociatedTokenAccount(connection, signer, solToken);
    const balanceBefore = (await solanaBalance(connection, solanaUser.publicKey)).toNumber();
    console.log(`Balance: ${balanceBefore} ${solToken.symbol}`);
    try {
      const transaction = await solanaSOLTransferTransaction({
        connection,
        solanaWallet: solanaUser.publicKey,
        neonWallet: neonWallet.address,
        neonEvmProgram: neonEvmProgram,
        neonTokenMint: chainTokenMint,
        splToken: solToken,
        amount,
        chainId
      });
      transaction.recentBlockhash = (await connection.getLatestBlockhash('finalized')).blockhash;
      const { signature } = await sendSolanaTransaction(connection, transaction, [signer], false, { skipPreflight });
      expect(signature.length).toBeGreaterThan(0);
      await delay(10e3);
      const balanceAfter = (await solanaBalance(connection, solanaUser.publicKey)).toNumber();
      const balanceNeon = await neonBalance(provider, neonWallet);
      console.log(`Balance: ${balanceBefore} > ${balanceAfter} ${solToken.symbol} ==> ${balanceNeon} ${solToken.symbol} in NeonEVM`);
      expect(balanceAfter).toBeLessThan(balanceBefore);
    } catch (e) {
      console.log(e);
    }
  });
});
