import { generateSigner, Keypair, KeypairSigner, percentAmount, Umi } from '@metaplex-foundation/umi';
import { createAndMint, TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import { mplCandyMachine } from '@metaplex-foundation/mpl-candy-machine';
import { SPLToken } from '@neonevm/token-transfer-core';
import bs58 from 'bs58';
import { log } from '@neonevm/solana-sign';

export async function mintSplToken(wallet: Keypair, umi: Umi, token: SPLToken, amount = 1e6): Promise<{
  mint: KeypairSigner,
  signature: string | null
}> {
  const mint = generateSigner(umi);
  umi.use(mplCandyMachine());

  try {
    const response = await (createAndMint(umi, {
      mint,
      authority: umi.identity,
      name: token.name,
      symbol: token.symbol,
      uri: token.logoURI,
      sellerFeeBasisPoints: percentAmount(0),
      decimals: token.decimals,
      amount: amount * (10 ** token.decimals),
      tokenOwner: wallet.publicKey,
      tokenStandard: TokenStandard.Fungible
    }).sendAndConfirm(umi));
    const { signature: signatureBytes } = response;
    const signature = bs58.encode(signatureBytes);
    log(`Mint signature: ${signature}`);
    log(`Successfully minted ${amount}.${(10 ** token.decimals).toString().slice(1)} tokens: (${mint.publicKey})`);
    return { mint, signature };
  } catch (err) {
    console.error(err);
    return { mint, signature: null };
  }
}
