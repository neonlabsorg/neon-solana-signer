import { Connection, Keypair } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createSignerFromKeypair,
  Keypair as UmiKeypair,
  KeypairSigner,
  signerIdentity,
  Umi
} from '@metaplex-foundation/umi';
import { SPLToken } from '@neonevm/token-transfer-core';
import { JsonRpcProvider, Wallet } from 'ethers';
import { deployErc20ForSplWrapper, mintSplToken } from '../contracts';

export class ResourceForSpl {
  solanaWallet: Keypair;
  neonWallet: Wallet;
  provider: JsonRpcProvider;
  connectin: Connection;

  getUmiClient(): { umi: Umi, wallet: UmiKeypair, signer: KeypairSigner } {
    const umi = createUmi(this.connectin.rpcEndpoint);
    const wallet = umi.eddsa.createKeypairFromSecretKey(this.solanaWallet.secretKey);
    const signer = createSignerFromKeypair(umi, wallet);
    umi.use(signerIdentity(signer));
    return { umi, wallet, signer };
  }

  async deployToken(factoryAddress: string, token: SPLToken, amount = 1e6): Promise<SPLToken> {
    const { wallet, umi } = this.getUmiClient();
    const { mint } = await mintSplToken(wallet, umi, token, amount);
    if (mint) {
      token.address_spl = mint.publicKey;
      const ecr20Address = await deployErc20ForSplWrapper(this.provider, this.neonWallet, factoryAddress, mint.publicKey);
      token.address = ecr20Address ?? '0x';
    }
    return token;
  }

  constructor(solanaWallet: Keypair, neonWallet: Wallet, provider: JsonRpcProvider, connection: Connection) {
    this.solanaWallet = solanaWallet;
    this.neonWallet = neonWallet;
    this.provider = provider;
    this.connectin = connection;
  }
}
