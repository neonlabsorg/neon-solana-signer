import { AccountInfo, Connection, Keypair, PublicKey, Signer, Transaction } from '@solana/web3.js';
import { dataSlice, keccak256 } from 'ethers';
import { hexToBuffer, numberToBuffer, stringToBuffer, toBytesInt32, toBytesLittleEndian, toU256BE } from '../utils';
import { AccountAddress, NeonAddress } from '../models';
import { BalanceAccountLayout } from './layout';
import { toSigner } from './transaction';
import { createBalanceAccountInstruction } from './instructions';

export function treasuryPoolAddressSync(neonEvmProgram: PublicKey, treasuryPoolIndex: number): [PublicKey, number] {
  const a = stringToBuffer('treasury_pool');
  const b = Buffer.from(toBytesInt32(treasuryPoolIndex));
  return PublicKey.findProgramAddressSync([a, b], neonEvmProgram);
}

export function neonBalanceProgramAddressSync(neonWallet: NeonAddress, neonEvmProgram: PublicKey, chainId: number): [PublicKey, number] {
  const neonWalletBuffer = hexToBuffer(neonWallet);
  const chainIdBytes = toU256BE(BigInt(chainId)); //chain_id as u256be
  const seed: any[] = [numberToBuffer(AccountAddress.SeedVersion), neonWalletBuffer, chainIdBytes];
  return PublicKey.findProgramAddressSync(seed, neonEvmProgram);
}

export function neonAuthorityPoolAddressSync(neonEvmProgram: PublicKey): [PublicKey, number] {
  const seed: any[] = [stringToBuffer('Deposit')];
  return PublicKey.findProgramAddressSync(seed, neonEvmProgram);
}

export function neonTreeAccountAddressSync(neonWallet: NeonAddress, neonEvmProgram: PublicKey, nonce: number): [PublicKey, number] {
  const version = numberToBuffer(AccountAddress.SeedVersion);
  const tag = stringToBuffer('TREE');
  const address = hexToBuffer(neonWallet);
  const _nonce = toBytesLittleEndian(nonce, 8);
  const seed: any[] = [version, tag, address, _nonce];
  return PublicKey.findProgramAddressSync(seed, neonEvmProgram);
}

export function neonWalletProgramAddress(neonWallet: NeonAddress, neonEvmProgram: PublicKey): [PublicKey, number] {
  const seeds: any[] = [numberToBuffer(AccountAddress.SeedVersion), hexToBuffer(neonWallet)];
  return PublicKey.findProgramAddressSync(seeds, neonEvmProgram);
}

export async function balanceAccountNonce(connection: Connection, neonWallet: NeonAddress, neonEvmProgram: PublicKey, chainId: number): Promise<bigint> {
  const [neonWalletBalanceAddress] = neonBalanceProgramAddressSync(neonWallet, neonEvmProgram, chainId);
  const neonWalletBalanceAccount = await connection.getAccountInfo(neonWalletBalanceAddress);
  if (neonWalletBalanceAccount) {
    const balanceAccountLayout = BalanceAccountLayout.decode(neonWalletBalanceAccount.data as Uint8Array);
    return balanceAccountLayout.trx_count;
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
      return Number(layout.trx_count);
    }
    return 0;
  }

  async balanceAccountCreate(connection: Connection): Promise<AccountInfo<Buffer> | null> {
    let account = await connection.getAccountInfo(this.balanceAddress);
    if (account === null && this.signer) {
      const instruction = createBalanceAccountInstruction(this.neonEvmProgram, this.publicKey, this.neonWallet, this.chainId);
      const transaction = new Transaction({ feePayer: this.publicKey }).add(instruction);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
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
