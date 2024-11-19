import { ContractFactory, Wallet } from 'ethers';
import { contractCompile } from '../utils';

export async function deployFactory(wallet: Wallet): Promise<string> {

  // Compile contract
  const factoryContract = await contractCompile('ERC20ForSplFactory.sol', './src/data/contracts');

  // Deploy contract
  const bytecode = factoryContract.evm.bytecode.object;
  const abi = factoryContract.abi;
  const factory = new ContractFactory(abi, bytecode, wallet);
  const contractInstance = await factory.deploy();
  const address = await contractInstance.getAddress();
  console.log(`Contract deployed to: ${address}`);
  return address;
}
