import { HexString, NeonAddress } from '@neonevm/solana-sign';
import {
  dataSlice,
  decodeRlp,
  encodeRlp,
  JsonRpcProvider,
  keccak256,
  recoverAddress,
  toBeHex,
  Transaction,
  Wallet
} from 'ethers';
import { readFileSync } from 'fs';
import { basename } from 'path';
import { compileSolidityContract } from '../utils';

const CHAIN_ID_OFFSET = 35;
const V_OFFSET = 27;
// Transaction from https://github.com/Zoltu/deterministic-deployment-proxy
const TRANSACTION_HASH = `f87e8085174876e800830186a08080ad601f80600e600039806000f350fe60003681823780368234f58015156014578182fd5b80825250506014600cf31ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222`;

export function getContractDeployerAddress(sender: string, nonce: number): NeonAddress {
  const encoded = encodeRlp([sender, nonce > 0 ? toBeHex(nonce) : '0x']);
  const hash = keccak256(encoded);
  return dataSlice(hash, 12, 32);
}

export function getContractAddressByContractData(deployer: NeonAddress, contractData: HexString): NeonAddress {
  const codeHash = keccak256(Buffer.from(contractData, 'hex'));
  return getContractAddressByHash(deployer, codeHash);
}

export function getContractAddressByHash(deployer: NeonAddress, codeHash: HexString): NeonAddress {
  const hash = keccak256(Buffer.concat([
    Buffer.from('ff', 'hex'),
    Buffer.from(deployer.slice(2), 'hex'),
    Buffer.alloc(32),
    Buffer.from(codeHash.slice(2), 'hex')
  ]));
  return dataSlice(hash, 12, 32);
}

export function getContractAddress(chainId: number, contractCode: string): NeonAddress {
  const deployerTrx = buildDeployerTransaction(chainId, false);
  const sender = recoverTransaction(deployerTrx);
  const deployer = getContractDeployerAddress(sender, 0);
  return getContractAddressByContractData(deployer, contractCode);
}

export function recoverTransaction(trxBytes: HexString): HexString {
  const trx = Transaction.from(trxBytes);
  const signature = trx.signature!;
  const digest = keccak256(trx.unsignedSerialized);
  return recoverAddress(digest, signature);
}

export function buildDeployerTransaction(chainId: number, verbose: boolean = false): HexString {
  const transaction = `0x${TRANSACTION_HASH}`;
  const [nonce, , , to, value, data, v, r, s] = decodeRlp(transaction);
  const trx = { nonce, gasPrice: '0x', gasLimit: toBeHex(1_000_000_000), to, value, data, v, r, s };

  trx.v = toBeHex(Number(trx.v) - V_OFFSET + CHAIN_ID_OFFSET + 2 * chainId);

  const deployerTrx = encodeRlp([
    trx.nonce,
    trx.gasPrice,
    trx.gasLimit,
    trx.to,
    trx.value,
    trx.data,
    trx.v,
    trx.r,
    trx.s
  ]);

  if (verbose) {
    console.log(`Original trx: ${transaction}`);
    console.log(`Deployer trx: ${deployerTrx}`);
    console.log('Deployer trx fields:', trx);
  }

  return deployerTrx;
}

export class DeploySystemContract {
  provider: JsonRpcProvider;
  chainId: number;

  get deployerTransaction(): HexString {
    return buildDeployerTransaction(this.chainId, false);
  }

  get sender(): NeonAddress {
    return recoverTransaction(this.deployerTransaction);
  }

  get deployer(): NeonAddress {
    return getContractDeployerAddress(this.sender, 0);
  }

  async initDeployer(): Promise<void> {
    console.log(`Start init deployer`);
    const sender = this.sender;
    const deployer = this.deployer;
    const deployerCode = await this.provider.getCode(deployer);
    console.log(`Sender address: ${sender}`);
    console.log(`Deployer address: ${deployer}`);
    if (deployerCode !== '0x') {
      console.log(`Deployer already initialised. Code: ${deployerCode}`);
    } else {
      const transaction = await this.provider.send('eth_sendRawTransaction', [this.deployerTransaction]);
      console.log(`Deploy proxy transaction: `, transaction);
      const receipt = await this.provider.waitForTransaction(transaction, 1, 3e4);
      console.log(`Deploy proxy transaction receipt: `, receipt);
    }
  }

  compileContract(filePath: string): { abi: string, bytecode: HexString } {
    const name = basename(filePath);
    const content = readFileSync(filePath, { encoding: 'utf-8' });
    const contract = compileSolidityContract(name, content);
    const bytecode = contract.evm.bytecode.object;
    const abi = contract.abi;
    return { abi, bytecode };
  }

  readContract(filePath: string): HexString {
    return readFileSync(filePath, 'utf8');
  }

  async deployContract(contractData: HexString, wallet: Wallet): Promise<NeonAddress> {
    const sender = this.sender;
    const deployer = this.deployer;
    const deployerCode = await this.provider.getCode(deployer);
    console.log(`Deployer code: ${deployerCode}`);
    if (deployerCode === '0x') {
      console.error(`Deployer isn't initialized`);
      await this.initDeployer();
    } else {
      console.log(`Sender address: ${sender}`);
      console.log(`Deployer address: ${deployer}`);
    }

    const contractAddress = getContractAddressByContractData(deployer, contractData);
    console.log(`Contract: ${contractAddress}`);

    const contractCode = await this.provider.getCode(contractAddress);
    if (contractCode !== '0x') {
      console.log('Contract already deployed');
      return contractAddress;
    }
    const accountBalance = await this.provider.getBalance(wallet.address);
    const accountNonce = await this.provider.getTransactionCount(wallet.address);

    console.log(`Account wallet: ${wallet.address}, Balance: ${Number(accountBalance) / 10 ** 18} NEON, Nonce: ${accountNonce}`);
    const { gasPrice } = await this.provider.getFeeData();
    const trx = {
      chainId: this.chainId,
      nonce: accountNonce,
      from: wallet.address,
      to: deployer,
      data: `0x${contractData}`,
      value: 0,
      gas: 0,
      gasPrice
    };

    trx.gas = Number(await this.provider.estimateGas(trx));

    const requiredFunds = trx.gas * Number(trx.gasPrice!);
    console.log(`Transaction requires ${Number(requiredFunds) / 10 ** 18} NEON`);

    if (BigInt(accountBalance) < requiredFunds) {
      throw new Error('Sender wallet has insufficient funds');
    }

    const transaction = await wallet.sendTransaction(trx);
    console.log(`Deploy contract transaction:`, transaction);
    const receipt = await this.provider.waitForTransaction(transaction.hash, 1, 3e4);
    console.log(`Transaction receipt`, receipt);

    return contractAddress;
  }

  constructor(provider: JsonRpcProvider, chainId: number) {
    this.provider = provider;
    this.chainId = chainId;
  }
}
