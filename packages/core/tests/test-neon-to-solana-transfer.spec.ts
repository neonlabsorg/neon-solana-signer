import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    getAccount
}  from "@solana/spl-token";
import {
  balanceAccountNonce,
  createHolderAccountTransaction,
  createScheduledNeonEvmMultipleTransaction,
  createScheduledNeonEvmTransaction,
  delay,
  FaucetDropper,
  GasToken,
  getGasToken,
  getProxyState,
  holderAddressWithSeed,
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
import { BaseContract } from '@neonevm/solana-contracts';
import { JsonRpcProvider, Contract, zeroPadValue, toBeHex, decodeBase58, encodeBase58 } from 'ethers';
import { config } from 'dotenv';
import bs58 from 'bs58';

config({ path: '.env' });

const NEON_API_RPC_URL = `${process.env.NEON_CORE_API_RPC_URL!}/sol`;
const NEON_CLIENT_API_URL = process.env.NEON_CORE_API_URL!;
const SOLANA_DEVNET_URL = process.env.SOLANA_URL!;
const NEON_FAUCET_URL = process.env.NEON_FAUCET_URL!;
const SOLANA_WALLET = process.env.SOLANA_WALLET!;

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
let baseContract: BaseContract;
let skipPreflight = false;
let globalNonce: number = 0;

beforeAll(async () => {
  const result = await getProxyState(NEON_API_RPC_URL);
  const token = getGasToken(result.tokensList, NeonChainId.testnetSol);
  const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_WALLET));
  connection = new Connection(SOLANA_DEVNET_URL, 'confirmed');
  provider = new JsonRpcProvider(NEON_API_RPC_URL!);
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

  log(`Solana wallet: ${solanaUser.publicKey.toBase58()}; ${bs58.encode(solanaUser.keypair.secretKey)}`);
  log(`Neon wallet: ${solanaUser.neonWallet}; Balance Account: ${solanaUser.balanceAddress.toBase58()}`);

  await solanaAirdrop(connection, solanaUser.publicKey, 100e9);
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

describe('Check Solana signer instructions', () => {
    it(`Create ScheduledTransaction to transfer ERC20ForSPL tokens from Neon to Solana`, async () => {
        const erc20forspl = new Contract(
            '0x81C4e95Ce11d9732fEE99Cce25e61dEC99887530',
            [{"inputs":[{"internalType":"bytes32","name":"_tokenMint","type":"bytes32"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"bytes32","name":"spender","type":"bytes32"},{"indexed":false,"internalType":"uint64","name":"amount","type":"uint64"}],"name":"ApprovalSolana","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"bytes32","name":"to","type":"bytes32"},{"indexed":false,"internalType":"uint64","name":"amount","type":"uint64"}],"name":"TransferSolana","type":"event"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"spender","type":"bytes32"},{"internalType":"uint64","name":"amount","type":"uint64"}],"name":"approveSolana","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"who","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burn","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burnFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"from","type":"bytes32"},{"internalType":"uint64","name":"amount","type":"uint64"}],"name":"claim","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"from","type":"bytes32"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint64","name":"amount","type":"uint64"}],"name":"claimTo","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"tokenMint","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"to","type":"bytes32"},{"internalType":"uint64","name":"amount","type":"uint64"}],"name":"transferSolana","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}],
            provider
        );

        console.log(await erc20forspl.balanceOf(solanaUser.neonWallet), 'balance of EVM address');
        const solanaUserATA = await getAssociatedTokenAddress( // this has to be initialized token account for the token mint of erc20forspl smart contract
            new PublicKey(encodeBase58(await erc20forspl.tokenMint())),
            new PublicKey(solanaUser.publicKey)
        );
        const ATAInfo = await getAccount(connection, solanaUserATA);
        console.log(ATAInfo.amount, 'balance of SVM address');
        
        const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
        const maxFeePerGas = 0x77359400;

        const scheduledTransaction = new ScheduledTransaction({
            nonce: nonce,
            payer: solanaUser.neonWallet,
            target: erc20forspl.target as string,
            callData: erc20forspl.interface.encodeFunctionData("transferSolana", [
                zeroPadValue(toBeHex(decodeBase58(solanaUserATA.toBase58())), 32),
                1 * 10 ** 9 // amount of tokens to be transferred
            ]),
            maxFeePerGas: maxFeePerGas,
            chainId 
        });

        const createScheduledTransaction = await createScheduledNeonEvmTransaction({
            chainId,
            signerAddress: solanaUser.publicKey,
            tokenMintAddress: solanaUser.tokenMint,
            neonEvmProgram,
            neonWallet: solanaUser.neonWallet,
            neonWalletNonce: nonce,
            neonTransaction: scheduledTransaction.serialize()
        });

        // for this test, we check that the pool account has tokens on test stand
        const treasuryPool = createScheduledTransaction.instructions[0].keys[2].pubkey;
        await solanaAirdrop(connection, treasuryPool, 20e9);

        await sendSolanaTransaction(connection, createScheduledTransaction, [solanaUser.signer!], true, {
            skipPreflight,
            preflightCommitment: 'confirmed'
        }, 'scheduled');

        const transactions = await neonClientApi.waitTransactionTreeExecution({
            address: solanaUser.neonWallet,
            chain_id: chainId
        }, nonce, 2e3);
        for (const { transaction_hash, status } of transactions) {
            const { result } = await neonProxyRpcApi.getTransactionReceipt(`0x${transaction_hash}`);
            logJson(result);
            expect(status).toBe('Success');
        }
    });
});
