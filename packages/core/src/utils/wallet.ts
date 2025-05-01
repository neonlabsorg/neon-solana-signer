import { Connection, Keypair, SendOptions, Signer, Transaction } from '@solana/web3.js';
import { log, solanaTransactionLog, SolanaTransactionSignature } from '@neonevm/solana-sign';

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
  log(`Transaction${name ? ` ${name}` : ''} signature: ${signature}`);
  log(`https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=http://localhost:8899`);
  return { signature, blockhash, lastValidBlockHeight };
}
