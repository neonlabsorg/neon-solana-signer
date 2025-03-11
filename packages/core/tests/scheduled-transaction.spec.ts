import { beforeAll, describe, expect, it } from '@jest/globals';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  GAS_LIMIT_DEFAULT,
  getProxyState,
  MAX_FEE_PER_GAS_DEFAULT,
  MAX_PRIORITY_FEE_PER_GAS_DEFAULT,
  NeonChainId,
  ScheduledTransaction,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { toBeHex } from 'ethers';
import { config } from 'dotenv';
import bs58 from 'bs58';

config({ path: '.env' });

const SOLANA_WALLET = process.env.SOLANA_WALLET!;
const NEON_API_RPC_URL = `${process.env.NEON_CORE_API_RPC_URL!}/sol`;

let neonEvmProgram: PublicKey;
let chainId: number;
let chainTokenMint: PublicKey;
let solanaUser: SolanaNeonAccount;

beforeAll(async () => {
  const result = await getProxyState(NEON_API_RPC_URL);
  const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_WALLET));
  const token = result.gasToken;
  neonEvmProgram = result.evmProgramAddress;
  chainId = result.chainId;
  chainTokenMint = new PublicKey(token.gasToken.tokenMint);
  solanaUser = SolanaNeonAccount.fromKeypair(keypair, neonEvmProgram, chainTokenMint, chainId);
});

describe('Check ScheduledTransaction data', () => {
  it(`Compare ScheduledTransaction: new and from`, async () => {
    const target = `0xc7e376be256bdb6a1fbedaee64ca860b2b6e95ee`;
    const callData = `0x3fb5c1cb0000000000000000000000000000000000000000000000000000000000000012`;
    const trx1 = new ScheduledTransaction({ payer: solanaUser.neonWallet, target, callData });
    const trx2 = ScheduledTransaction.from([solanaUser.neonWallet, '0x', '0x', '0x', '0x', '0x', target, callData, '0x', toBeHex(NeonChainId.devnetSol), toBeHex(GAS_LIMIT_DEFAULT), toBeHex(MAX_FEE_PER_GAS_DEFAULT), toBeHex(MAX_PRIORITY_FEE_PER_GAS_DEFAULT)]);
    expect(trx1.encode()).toBe(trx2.encode());
  });

  it(`Should decode transaction`, async () => {
    const trx = `0xf86394b42bac632c2a69a49c6f5c4c80d933952b53a1dd808080808094c7e376be256bdb6a1fbedaee64ca860b2b6e95eea43fb5c1cb0000000000000000000000000000000000000000000000000000000000000012807082c350844190ab02844190ab01`;
    const decoded = ScheduledTransaction.decodeFrom(trx);
    expect(trx).toBe(decoded.encode());
  });
});
