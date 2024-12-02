import {
  Commitment,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SendOptions,
  Signer,
  Transaction
} from '@solana/web3.js';
import { solanaTransactionLog } from '@neonevm/token-transfer-core';
import { JsonRpcProvider, keccak256 } from 'ethers';
import { delay, EVM_STEPS, FaucetDropper, hexToBuffer } from '../utils';
import { SolanaTransactionSignature } from '../models';
import { SolanaNeonAccount, TreasuryPoolAddress } from './account';
import {
  createPartialCallOrContinueFromRawEthereumTransaction,
  createScheduledTransactionStartFromAccountTransaction,
  createWriteToHolderAccountInstruction
} from './instructions';
import { ScheduledTransaction } from '../neon';

export function toSigner({ publicKey, secretKey }: Keypair): Signer {
  return { publicKey, secretKey };
}

export async function sendSolanaTransaction(connection: Connection, transaction: Transaction, signers: Signer[],
                                            confirm = false, options?: SendOptions, name = ''): Promise<SolanaTransactionSignature> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.sign(...signers);
  solanaTransactionLog(transaction);
  const signature = await connection.sendRawTransaction(transaction.serialize(), options);
  if (confirm) {
    await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
  }
  console.log(`Transaction${name ? ` ${name}` : ''} signature: ${signature}`);
  console.log(`https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=http://localhost:8899`);
  return { signature, blockhash, lastValidBlockHeight };
}

export async function solanaAirdrop(connection: Connection, publicKey: PublicKey, lamports: number, commitment: Commitment = 'finalized'): Promise<number> {
  let balance = await connection.getBalance(publicKey);
  if (balance < lamports) {
    const signature = await connection.requestAirdrop(publicKey, lamports);
    await connection.confirmTransaction(signature, commitment);
    balance = await connection.getBalance(publicKey);
  }
  console.log(`${publicKey.toBase58()} balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  return balance;
}

export async function neonAirdrop(provider: JsonRpcProvider, faucet: FaucetDropper, wallet: string, amount: number): Promise<bigint> {
  let balance = await provider.getBalance(wallet);
  if (balance < BigInt(amount * (10 ** 18))) {
    const requestAmount = amount > 100 ? 100 : amount;
    await faucet.requestNeon(wallet, requestAmount);
    await delay(4e3);
    return neonAirdrop(provider, faucet, wallet, amount);
  }
  console.log(`${wallet} balance: ${balance} NEON`);
  return balance;
}

export async function writeTransactionToHoldAccount(connection: Connection, neonEvmProgram: PublicKey, solanaUser: SolanaNeonAccount, holderAddress: PublicKey, scheduledTransaction: ScheduledTransaction): Promise<any> {
  const receipts: Promise<SolanaTransactionSignature>[] = [];
  const scheduledTransactionHash = `0x${scheduledTransaction.serialize}`;
  const transactionHash = keccak256(scheduledTransactionHash);
  let rest = hexToBuffer(scheduledTransactionHash);
  let offset = 0;

  while (rest.length) {
    const part = rest.slice(0, 920);
    rest = rest.slice(920);

    const transaction = new Transaction();
    transaction.feePayer = solanaUser.publicKey;
    transaction.add(createWriteToHolderAccountInstruction(neonEvmProgram, solanaUser.publicKey, holderAddress, transactionHash, part, offset));
    receipts.push(sendSolanaTransaction(connection, transaction, [solanaUser.signer!], false, { preflightCommitment: 'confirmed' }, `rest`));

    offset += part.length;
  }

  for (const receipt of receipts) {
    const { signature, blockhash, lastValidBlockHeight } = await receipt;
    console.log(signature, blockhash, lastValidBlockHeight);
  }
}

export async function executeScheduledTransactionFromAccount(connection: Connection, neonEvmProgram: PublicKey, solanaUser: SolanaNeonAccount, holderAddress: PublicKey, treeAddress: PublicKey, nonce: number) {
  const transaction = createScheduledTransactionStartFromAccountTransaction(neonEvmProgram, solanaUser.publicKey, solanaUser.balanceAddress, holderAddress, treeAddress, nonce);
  transaction.feePayer = solanaUser.publicKey;
  await sendSolanaTransaction(connection, transaction, [solanaUser.signer!], false, { preflightCommitment: 'confirmed' }, `rest`);
}

export async function executeTransactionStepsFromAccount(
  connection: Connection,
  neonEvmProgram: PublicKey,
  solanaUser: SolanaNeonAccount,
  holderAddress: PublicKey,
  treasuryPoolAddress: TreasuryPoolAddress,
  storageAccount: PublicKey,
  additionalAccounts: PublicKey[] = []
): Promise<any> {
  let index = 0;
  let receipt = null;
  let done = false;

  while (!done) {
    const transaction = createPartialCallOrContinueFromRawEthereumTransaction(
      index,
      EVM_STEPS,
      neonEvmProgram,
      solanaUser,
      holderAddress,
      treasuryPoolAddress,
      ``,
      additionalAccounts
    );
    const { signature } = await sendSolanaTransaction(connection, transaction, [solanaUser.signer!], false, { preflightCommitment: 'confirmed' }, `execute ${index}`);
    await delay(2e3);
    receipt = await connection.getParsedTransaction(signature, { commitment: 'confirmed' });
    console.log(receipt);
    if (receipt) {
      done = true;
    }
    index += 1;
  }

  return receipt;
}
