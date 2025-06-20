import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { Connection, Keypair, PublicKey, Signer } from '@solana/web3.js';
import {
  balanceAccountNonce,
  delay,
  destroyScheduledNeonEvmMultipleTransaction,
  log,
  NeonProxyRpcApi,
  sendSolanaTransaction,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { config } from 'dotenv';
import bs58 from 'bs58';

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
});

afterEach(async () => {
  const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
  if (nonce > globalNonce) {
    globalNonce = nonce;
  } else {
    await delay(9e3);
  }
});

describe('Destroy scheduled transaction', () => {
  it(`Should destroy tree account`, async () => {
    const [balanceAddress, nonce] = await balanceAccountNonce(connection, solanaUser.neonWallet, neonEvmProgram, proxyApi.chainId);
    const { result } = await proxyApi.getScheduledTreeAccount(solanaUser.neonWallet, nonce);
    if (result && result.activeStatus === 'NotStarted') {
      expect(result.activeStatus).toEqual('NotStarted');
      const transaction = destroyScheduledNeonEvmMultipleTransaction({
        neonEvmProgram,
        signerAddress: solanaUser.publicKey,
        balanceAddress,
        treeAccountAddress: new PublicKey(result.address)
      });
      await sendSolanaTransaction(connection, transaction, [signer], true, {
        skipPreflight,
        preflightCommitment: 'confirmed'
      });
      const { result: resultAfter } = await proxyApi.getScheduledTreeAccount(solanaUser.neonWallet, nonce);
      expect(resultAfter).toEqual(null);
    }
    expect(result).toEqual(null);
  });
});
