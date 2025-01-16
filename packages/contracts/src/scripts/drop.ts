import {
  FaucetDropper,
  getGasToken,
  getProxyState,
  log,
  neonAirdrop,
  NeonChainId,
  sendSolanaTransaction,
  solanaAirdrop,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { NeonProxyRpcApi as NeonTokenProxyRpcApi, signerPrivateKey, SPLToken } from '@neonevm/token-transfer-core';
import { neonTransferMintTransactionEthers } from '@neonevm/token-transfer-ethers';
import { tokenBalance } from '@neonevm/solana-contracts';
import { JsonRpcProvider, Wallet } from 'ethers';
import { config } from 'dotenv';
import bs58 from 'bs58';

import { tokenList } from '../data/tokens/token-list';

config({ path: '.env' });

// @ts-ignore
const env: { [key: string]: any } = process.env;
const NEON_API_RPC_URL = `${env.NEON_CORE_API_RPC_URL!}/neon`;
const SOLANA_URL = env.SOLANA_URL!;
const NEON_FAUCET_URL = env.NEON_FAUCET_URL!;
const SOLANA_WALLET = env.SOLANA_WALLET!;

const address = ``;
const solanaAddress = ``;

async function init(): Promise<void> {
  const provider = new JsonRpcProvider(NEON_API_RPC_URL);
  const connection = new Connection(SOLANA_URL);
  const faucet = new FaucetDropper(NEON_FAUCET_URL);
  const neonTokenProxyRpcApi: NeonTokenProxyRpcApi = new NeonTokenProxyRpcApi(NEON_API_RPC_URL);
  const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_WALLET));
  const result = await getProxyState(NEON_API_RPC_URL);
  const neonEvmProgram = result.evmProgramAddress;
  const token = getGasToken(result.tokensList, NeonChainId.testnetNeon);
  const chainTokenMint = new PublicKey(token.gasToken.tokenMint);
  const chainId = Number(token.gasToken.tokenChainId);
  const solanaUser = SolanaNeonAccount.fromKeypair(keypair, neonEvmProgram, chainTokenMint, chainId);
  const amount = 100;

  await solanaAirdrop(connection, new PublicKey(solanaAddress), amount);
  await neonAirdrop(provider, faucet, address, amount);
  await erc20Airdrop(connection, provider, neonTokenProxyRpcApi, neonEvmProgram, solanaUser, address, amount);
}

export async function erc20Airdrop(connection: Connection, provider: JsonRpcProvider, proxyApi: NeonTokenProxyRpcApi, neonEvmProgram: PublicKey, solanaUser: SolanaNeonAccount, address: string, amount: number, chainId = 111): Promise<void> {
  const tokens: SPLToken[] = await findTokens(['USDT', 'USDC']);
  for (const token of tokens) {
    log(`Transfer ${amount} ${token.symbol} from Solana to Neon EVM`);
    const solanaWalletSigner = new Wallet(signerPrivateKey(solanaUser.publicKey, address), provider);
    try {
      const transaction = await neonTransferMintTransactionEthers({
        connection,
        proxyApi,
        neonEvmProgram,
        solanaWallet: solanaUser.publicKey,
        neonWallet: address,
        walletSigner: solanaWalletSigner,
        splToken: token,
        amount,
        chainId
      });
      await sendSolanaTransaction(connection, transaction, [solanaUser.signer!], true);
      const balance = await tokenBalance(provider, address, token);
      log(`Token balance: ${balance} ${token.symbol}`);
    } catch (e) {
      console.log(e);
    }
  }
}

async function findTokens(symbols: string[]): Promise<SPLToken[]> {
  console.log(symbols, tokenList);
  const result: SPLToken[] = [];
  for (const symbol of symbols) {
    const id = tokenList.findIndex((t) => t.symbol === symbol);
    if (id > -1) {
      const token: SPLToken = tokenList[id] as SPLToken;
      result.push(token);
    }
  }
  return result;
}

init();
