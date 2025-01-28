import { beforeAll, describe, expect, it } from '@jest/globals';
import { Keypair, PublicKey } from '@solana/web3.js';
import { getGasToken, getProxyState, NeonChainId, ScheduledTransaction, SolanaNeonAccount } from '@neonevm/solana-sign';
import { BaseContract } from '@neonevm/contracts-deployer';
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
let baseContract: BaseContract;

beforeAll(async () => {
  const result = await getProxyState(NEON_API_RPC_URL);
  const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_WALLET));
  const token = getGasToken(result.tokensList, NeonChainId.testnetSol);
  neonEvmProgram = result.evmProgramAddress;
  chainTokenMint = new PublicKey(token.gasToken.tokenMint);
  chainId = Number(token.gasToken.tokenChainId);
  solanaUser = SolanaNeonAccount.fromKeypair(keypair, neonEvmProgram, chainTokenMint, chainId);
  baseContract = new BaseContract(chainId);

});

describe('Check ScheduledTransaction data', () => {
  it(`Compare ScheduledTransaction: new and from`, async () => {
    const target = `0xc7e376be256bdb6a1fbedaee64ca860b2b6e95ee`;
    const callData = `0x3fb5c1cb0000000000000000000000000000000000000000000000000000000000000012`;
    const trx1 = new ScheduledTransaction({ payer: solanaUser.neonWallet, target, callData });
    const trx2 = ScheduledTransaction.from([solanaUser.neonWallet, '0x', '0x', '0x', '0x', '0x', target, callData, '0x', toBeHex(NeonChainId.testnetSol), '0x02540be3ff', '0x64', '0x0a']);
    expect(trx1.encode()).toBe(trx2.encode());
  });

  it(`Should decode transaction`, async () => {
    const trx = `0xf85e94b20650b9d28d3a46e3c6d8859a7243d7627db6b0808080808094c7e376be256bdb6a1fbedaee64ca860b2b6e95eea43fb5c1cb000000000000000000000000000000000000000000000000000000000000001280708502540be3ff640a`;
    const decoded = ScheduledTransaction.decodeFrom(trx);
    expect(trx).toBe(decoded.encode());
  });
});
