import { base58ToHex, log } from '@neonevm/solana-sign';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { erc20ForSplFactoryAbi } from '../data';

export const zeroAddress = '0x0000000000000000000000000000000000000000';

function nonZeroAddress(address: string): boolean {
  return address !== zeroAddress;
}

export async function deployErc20ForSplWrapper(provider: JsonRpcProvider, wallet: Wallet, contractAddress: string, tokenMint: string): Promise<string | null> {
  const contract = new Contract(contractAddress, erc20ForSplFactoryAbi, provider);
  const hexAddr = base58ToHex(tokenMint);
  log(tokenMint, hexAddr);

  const contractWithSigner = contract.connect(wallet);

  // Check if ERC20 wrapper already exists
  let ecr20Address = await contract.getErc20ForSpl(hexAddr);

  if (nonZeroAddress(ecr20Address)) {
    return ecr20Address;
  }

  // @ts-ignore
  const tx = await contractWithSigner.createErc20ForSpl(hexAddr);
  log(`Transaction hash: ${tx.hash}`);

  const receipt = await tx.wait();
  log(`Transaction confirmed in block: ${receipt.blockNumber}`);

  // Get erc20 wrapper Address
  ecr20Address = await contract.getErc20ForSpl(hexAddr);
  return nonZeroAddress(ecr20Address) ? ecr20Address : null;
}
