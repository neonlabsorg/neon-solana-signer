import { generateSigner, Keypair, KeypairSigner, percentAmount, Umi } from '@metaplex-foundation/umi';
import { createAndMint, TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import { mplCandyMachine } from '@metaplex-foundation/mpl-candy-machine';
import { SPLToken } from '@neonevm/token-transfer-core';
import { delay } from '@neonevm/solana-sign';
import bs58 from 'bs58';

export async function mintSplToken(wallet: Keypair, umi: Umi, token: SPLToken, amount = 1e6): Promise<{
  mint: KeypairSigner,
  signature: string | null
}> {
  //Create a new Mint PDA
  const mint = generateSigner(umi);
  umi.use(mplCandyMachine());

  //Send a transaction to deploy the Mint PDA and mint 1 million of our tokens
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
    }).send(umi));
    // todo: refactoring to send and confirm method when will working solana websockets
    await delay(3e3);
    const signature = bs58.encode(response);
    console.log(`Mint signature: ${signature}`)
    console.log(`Successfully minted ${amount}.${(10 ** token.decimals).toString().slice(1)} tokens: (${mint.publicKey})`);
    return { mint, signature };
  } catch (err) {
    console.error(err);
    return { mint, signature: null };
  }
}
