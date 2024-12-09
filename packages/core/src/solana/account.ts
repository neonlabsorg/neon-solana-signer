import { AccountInfo, Connection, Keypair, PublicKey, Signer } from '@solana/web3.js';
import { dataSlice, keccak256 } from 'ethers';
import { hexToBuffer, numberToBuffer, stringToBuffer, toBytes64LE, toBytesInt32, toSigner, toU256BE } from '../utils';
import { AccountSeedTag, NeonAddress, TreeAccountData, TreeAccountTransactionData } from '../models';
import { BalanceAccountLayout } from './layout';
import { createBalanceAccountTransaction } from './transactions';

export function treasuryPoolAddressSync(neonEvmProgram: PublicKey, treasuryPoolIndex: number): [PublicKey, number] {
  const a = stringToBuffer('treasury_pool');
  const b = Buffer.from(toBytesInt32(treasuryPoolIndex));
  return PublicKey.findProgramAddressSync([a, b], neonEvmProgram);
}

export function neonBalanceProgramAddressSync(neonWallet: NeonAddress, neonEvmProgram: PublicKey, chainId: number): [PublicKey, number] {
  const neonWalletBuffer = hexToBuffer(neonWallet);
  const chainIdBytes = toU256BE(BigInt(chainId)); //chain_id as u256be
  const seed: any[] = [numberToBuffer(AccountSeedTag.SeedVersion), neonWalletBuffer, chainIdBytes];
  return PublicKey.findProgramAddressSync(seed, neonEvmProgram);
}

export function neonAuthorityPoolAddressSync(neonEvmProgram: PublicKey): [PublicKey, number] {
  const seed: any[] = [stringToBuffer('Deposit')];
  return PublicKey.findProgramAddressSync(seed, neonEvmProgram);
}

export function neonTreeAccountAddressSync(neonWallet: NeonAddress, neonEvmProgram: PublicKey, chainId: number, nonce: number): [PublicKey, number] {
  const version = numberToBuffer(AccountSeedTag.SeedVersion);
  const tag = stringToBuffer('TREE');
  const address = hexToBuffer(neonWallet);
  const _chainId = toBytes64LE(chainId, 8);
  const _nonce = toBytes64LE(nonce, 8);
  const seed: any[] = [version, tag, address, _chainId, _nonce];
  return PublicKey.findProgramAddressSync(seed, neonEvmProgram);
}

export function neonWalletProgramAddress(neonWallet: NeonAddress, neonEvmProgram: PublicKey): [PublicKey, number] {
  const seeds: any[] = [numberToBuffer(AccountSeedTag.SeedVersion), hexToBuffer(neonWallet)];
  return PublicKey.findProgramAddressSync(seeds, neonEvmProgram);
}

export async function balanceAccountNonce(connection: Connection, neonWallet: NeonAddress, neonEvmProgram: PublicKey, chainId: number): Promise<bigint> {
  const [neonWalletBalanceAddress] = neonBalanceProgramAddressSync(neonWallet, neonEvmProgram, chainId);
  const neonWalletBalanceAccount = await connection.getAccountInfo(neonWalletBalanceAddress);
  if (neonWalletBalanceAccount) {
    const balanceAccountLayout = BalanceAccountLayout.decode(neonWalletBalanceAccount.data as Uint8Array);
    return balanceAccountLayout.nonce;
  }
  return 0n;
}

export async function holderAddressWithSeed(neonEvmProgram: PublicKey, solanaWallet: PublicKey): Promise<[PublicKey, string]> {
  const seed = Math.floor(Math.random() * 1e12).toString();
  const holder = await PublicKey.createWithSeed(solanaWallet, seed, neonEvmProgram);
  return [holder, seed];
}

export function solanaToNeonAddress(publicKey: PublicKey): NeonAddress {
  return dataSlice(keccak256(publicKey.toBytes()), 12, 32);
}

export class TreasuryPoolAddress {
  index: number;
  publicKey: PublicKey;

  get buffer(): Buffer {
    return Buffer.from(toBytesInt32(this.index));
  }

  static find(neonEvmProgram: PublicKey, count: number): TreasuryPoolAddress {
    const index = Math.floor(Math.random() * count) % count;
    const publicKey = treasuryPoolAddressSync(neonEvmProgram, index)[0];
    return new TreasuryPoolAddress(publicKey, index);
  }

  constructor(publicKey: PublicKey, index: number) {
    this.publicKey = publicKey;
    this.index = index;
  }
}

export class SolanaNeonAccount {
  neonWallet: NeonAddress;
  publicKey: PublicKey;
  neonEvmProgram: PublicKey;
  tokenMint: PublicKey;
  chainId: number;
  private _keypair?: Keypair;

  get balanceAddress(): PublicKey {
    return neonBalanceProgramAddressSync(this.neonWallet, this.neonEvmProgram, this.chainId)[0];
  }

  get keypair(): Keypair {
    if (!this._keypair) {
      throw new Error(`Keypair isn't initialized`);
    }
    return this._keypair;
  }

  get signer(): Signer | null {
    if (this._keypair) {
      return toSigner(this._keypair);
    }
    return null;
  }

  nonce(account: AccountInfo<Buffer>): number {
    if (account) {
      // @ts-ignore
      const layout = BalanceAccountLayout.decode(account.data);
      return Number(layout.nonce);
    }
    return 0;
  }

  async balanceAccountCreate(connection: Connection): Promise<AccountInfo<Buffer> | null> {
    let account = await connection.getAccountInfo(this.balanceAddress);
    if (account === null && this.signer) {
      const transaction = createBalanceAccountTransaction(this.neonEvmProgram, this.publicKey, this.neonWallet, this.chainId);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.feePayer = this.publicKey;
      transaction.recentBlockhash = blockhash;
      transaction.sign(this.signer);
      const signature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction({ signature, lastValidBlockHeight, blockhash }, 'finalized');
      account = await connection.getAccountInfo(this.balanceAddress);
      if (account) {
        console.log(BalanceAccountLayout.decode(account.data as any));
      }
    }
    return account;
  }

  static fromKeypair(keypair: Keypair, neonEvmProgram: PublicKey, mint: PublicKey, chainId: number): SolanaNeonAccount {
    return new SolanaNeonAccount(keypair.publicKey, neonEvmProgram, mint, chainId, keypair);
  }

  constructor(solanaAddress: PublicKey, neonEvmProgram: PublicKey, mint: PublicKey, chainId: number, keypair?: Keypair) {
    this.publicKey = solanaAddress;
    this.neonEvmProgram = neonEvmProgram;
    this.tokenMint = mint;
    this.chainId = chainId;
    this.neonWallet = solanaToNeonAddress(this.publicKey);
    if (keypair instanceof Keypair) {
      this._keypair = keypair;
    }
  }
}

class TreeAccountTransaction {
  status: string;
  resultHash: string;
  transactionHash: string;
  gasLimit: string;
  value: string;
  childTransaction: number;
  successExecuteLimit: number;
  parentCount: number;

  get isSuccessful(): boolean {
    return this.status === 'Success';
  }

  get isFailed(): boolean {
    return this.status === 'Failed';
  }

  constructor(data: TreeAccountTransactionData) {
    this.status = data.status;
    this.resultHash = data.result_hash;
    this.transactionHash = data.transaction_hash;
    this.gasLimit = data.gas_limit;
    this.value = data.value;
    this.childTransaction = data.child_transaction;
    this.successExecuteLimit = data.success_execute_limit;
    this.parentCount = data.parent_count;
  }

  static fromObject(data: TreeAccountTransactionData): TreeAccountTransaction {
    return new TreeAccountTransaction(data);
  }
}

class TreeAccount {
  result: string;
  status: string;
  pubkey: string;
  payer: string;
  lastSlot: number;
  chainId: number;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  balance: number;
  lastIndex: number;
  transactions: TreeAccountTransaction[];

  get count(): number {
    return this.transactions.length;
  }

  get statuses(): Record<string, string> {
    return Object.fromEntries(this.transactions.map(tx => [tx.transactionHash, tx.status]));
  }

  get isAllSuccessful(): boolean {
    return this.transactions.every(tx => tx.isSuccessful);
  }

  constructor(data: TreeAccountData) {
    const value = data.value;
    this.result = data.result;
    this.status = value.status;
    this.pubkey = value.pubkey;
    this.payer = value.payer;
    this.lastSlot = value.last_slot;
    this.chainId = value.chain_id;
    this.maxFeePerGas = value.max_fee_per_gas;
    this.maxPriorityFeePerGas = value.max_priority_fee_per_gas;
    this.balance = parseInt(value.balance, 16);
    this.lastIndex = value.last_index;
    this.transactions = value.transactions.map(TreeAccountTransaction.fromObject);
  }

  static fromObject(data: TreeAccountData): TreeAccount {
    return new TreeAccount(data);
  }
}
