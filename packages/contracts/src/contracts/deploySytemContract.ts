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

const CHAIN_ID_OFFSET = 35;
const V_OFFSET = 27;
// Transaction from https://github.com/Zoltu/deterministic-deployment-proxy
const TRANSACTION_HASH = `f87e8085174876e800830186a08080ad601f80600e600039806000f350fe60003681823780368234f58015156014578182fd5b80825250506014600cf31ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222`;

export function getContractDeployerAddress(sender: string, nonce: number): NeonAddress {
  const encoded = encodeRlp([sender, nonce > 0 ? toBeHex(nonce) : '0x']);
  const hash = keccak256(encoded);
  return dataSlice(hash, 12, 32);
}

export function getContractAddressByCode(deployer: NeonAddress, contractCode: HexString): NeonAddress {
  const codeHash = keccak256(Buffer.from(contractCode, 'hex'));
  console.log(codeHash);
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
  return getContractAddressByCode(deployer, contractCode);
}

export function recoverTransaction(trxBytes: HexString): HexString {
  const trx = Transaction.from(trxBytes);
  const signature = trx.signature!;
  const digest = keccak256(trx.unsignedSerialized);
  return recoverAddress(digest, signature);
}

export function buildDeployerTransaction(chainId: number, verbose: boolean = false): string {
  const trxBytes = `0x${TRANSACTION_HASH}`;
  const [nonce, , , to, value, data, v, r, s] = decodeRlp(trxBytes);
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
    console.log(`Original trx: ${trxBytes}`);
    console.log(`Deployer trx: ${deployerTrx}`);
    console.log('Deployer trx fields:', trx);
  }

  return deployerTrx;
}

export async function initDeployer(provider: JsonRpcProvider, sendTrx = false): Promise<void> {
  const { chainId } = await provider.getNetwork();
  const deployerTrx = buildDeployerTransaction(Number(chainId), true);
  const sender = recoverTransaction(deployerTrx);
  const deployer = getContractDeployerAddress(sender, 0);

  console.log(`Sender: ${sender}`);
  console.log(`Deployer: ${deployer}`);

  const deployerCode = await provider.getCode(deployer);
  console.log(`Deployer code: ${deployerCode}`);

  if (sendTrx) {
    const txHash = await provider.send('eth_sendRawTransaction', [deployerTrx]);
    console.log(`Deploy proxy transaction: ${txHash}`);
    const txReceipt = await provider.getTransactionReceipt(txHash.hash);
    console.log(txReceipt);
  }
}

export async function deploySystemContract(provider: JsonRpcProvider, senderWallet: Wallet, contractPath: string, sendTrx: boolean = false): Promise<void> {
  const { chainId } = await provider.getNetwork();
  const deployerTrx = buildDeployerTransaction(Number(chainId), false);
  const sender = recoverTransaction(deployerTrx);
  const deployer = getContractDeployerAddress(sender, 0);

  console.log(`ChainID: ${chainId}`);
  console.log(`Sender: ${sender}`);
  console.log(`Deployer: ${deployer}`);

  const deployerCode = await provider.getCode(deployer);
  if (deployerCode === '0x') {
    console.error(`Deployer isn't initialized`);
    return;
  }

  const contractCode = readFileSync(contractPath, 'utf8');
  const contractAddress = getContractAddressByCode(deployer, contractCode);
  console.log(`Contract: ${contractAddress}`);

  const contractCodeDeployed = await provider.getCode(contractAddress);
  if (contractCodeDeployed !== '0x') {
    console.log('Contract already deployed');
    return;
  }
  const accountBalance = await provider.getBalance(senderWallet.address);
  const accountNonce = await provider.getTransactionCount(senderWallet.address);

  console.log(`Account wallet: ${senderWallet.address}, Balance: ${Number(accountBalance) / 10 ** 18} NEON, Nonce: ${accountNonce}`);
  const { gasPrice } = await provider.getFeeData();
  const trx = {
    chainId,
    nonce: accountNonce,
    from: senderWallet.address,
    to: deployer,
    data: `0x${contractCode}`,
    value: 0,
    gas: 0,
    gasPrice
  };

  trx.gas = Number(await provider.estimateGas(trx));

  const requiredFunds = trx.gas * Number(trx.gasPrice!);
  console.log(`Transaction requires ${Number(requiredFunds) / 10 ** 18} NEON`);

  if (BigInt(accountBalance) < requiredFunds) {
    console.error('Sender has insufficient funds');
    return;
  }

  if (sendTrx) {
    const txHash = await senderWallet.sendTransaction(trx);
    console.log(`Deploy contract transaction: ${txHash}`);
    const receipt = await provider.getTransactionReceipt(txHash.hash);
    console.log(`Transaction receipt`, receipt);
  }
}
