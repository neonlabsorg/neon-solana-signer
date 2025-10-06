import {
  AccountSeedTag,
  createBalanceAccountInstruction,
  createScheduledNeonEvmTransaction,
  hexToBuffer,
  NeonAddress,
  NeonProxyRpcApi,
  numberToBuffer,
  PreparatorySolanaTransaction,
  prepareSolanaInstruction,
  ScheduledTransaction,
  sendSolanaTransaction,
  SolanaNeonAccount,
  toSigner
} from '@neonevm/solana-sign';
import { SPLToken } from '@neonevm/token-transfer-core';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createApproveInstruction,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  PublicKey,
  Signer,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import bs58 from 'bs58';
import { Contract, Interface, JsonRpcProvider, MaxUint256, toBeHex } from 'ethers';
import { BalanceAccountLayout, TransactionData } from '../src';
import { ERC20 } from './data/ERC20';
import { ethervistaSwapRouter } from './data/ethervistaSwapRouter';
import { approveTokenV2Instruction } from './tokens';

export const usdc: SPLToken = {
  chainId: 245022934,
  address: '0xEA6B04272f9f62F997F666F07D3a974134f7FFb9',
  address_spl: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  name: 'USDC (Mainnet)',
  symbol: 'USDC',
  decimals: 6,
  logoURI: 'USDC.svg'
};
export const wsol: SPLToken = {
  chainId: 245022934,
  address: '0x5f38248f339Bf4e84A2caf4e4c0552862dC9F82a',
  address_spl: 'So11111111111111111111111111111111111111112',
  name: 'wSOL (Mainnet)',
  symbol: 'wSOL',
  decimals: 9,
  logoURI:
    'https://raw.githubusercontent.com/neonlabsorg/token-list/master/assets/solana-wsol-logo.svg'
};
export const tcm: SPLToken = {
  chainId: 245022934,
  address: '0x066a7Bc4A5c32aF25ef0Dd5D1a73e0c61bAFE1C5',
  address_spl: '4MJeXfJTqQGYJt37fiKfsMbu3vXmcNG2d7y5qbMZhbCz',
  name: 'TCM',
  symbol: 'TCM',
  decimals: 9,
  logoURI:
    'https://dd.dexscreener.com/ds-data/tokens/neonevm/0xe96ec0fee0508a69413ff760e3976e1470048c83.png?key=1e4944'
};

const SolanaRouterAddress = '0x638f26684ebe53e6d7d939bf9fafefcbdc42af4d';
const solanaRpc = 'https://solana-mainnet.core.chainstack.com/a3fc728f9b3577991b59b07423e0577d';
const solanaprovider = new JsonRpcProvider('https://neon-proxy-mainnet.solana.p2p.org/sol');

let skipPreflight = false;

export class SolanaSignerTest {
  address: PublicKey;
  solUser: SolanaNeonAccount;
  proxy: NeonProxyRpcApi;
  keypair: Keypair;
  signer: Signer;
  provider: JsonRpcProvider;

  getAddress(): string {
    return this.solUser.neonWallet;
  }

  async signAndSend(bigTx: Transaction, conn: Connection) {
    return sendSolanaTransaction(conn, bigTx, [this.signer!], true, { skipPreflight }, 'scheduled');
  }

  constructor(
    keypair: Keypair,
    solUser: SolanaNeonAccount,
    proxy: NeonProxyRpcApi,
    provider: JsonRpcProvider
  ) {
    this.keypair = keypair;
    this.address = keypair.publicKey;
    this.solUser = solUser;
    this.proxy = proxy;
    this.provider = provider;
    this.signer = toSigner(keypair);
  }
}

export async function InitDelegateAtaAndApproveMax(
  signer: SolanaSignerTest,
  mintPk: PublicKey,
  wrapperAddr: string,
  amountLamports = 0n, // wrap this many lamports
  tokenMintPk: PublicKey | null = null,
  tokenWrapperAddr: string | null = null
) {
  const conn = new Connection(solanaRpc, 'confirmed');
  const userSolPk = signer.address;
  const userNeon = await signer.getAddress();
  const routerAddr = SolanaRouterAddress;
  const bigTx = new Transaction({ feePayer: userSolPk });

  /* ---------- (optional) wrap SOL → WSOL ------------------------- */
  if (amountLamports > 0n) {
    const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

    const wsolATA = getAssociatedTokenAddressSync(
      WSOL_MINT,
      userSolPk,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    /* create the ATA if it doesn't exist */
    if ((await conn.getAccountInfo(wsolATA)) === null) {
      console.log('CREATING WSOL ATA');
      bigTx.add(
        createAssociatedTokenAccountInstruction(
          userSolPk,
          wsolATA,
          userSolPk,
          WSOL_MINT,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    /* —–– NEW: wrap only what's missing —–– */
    let currentWSOL = 0n;
    try {
      const bal = await conn.getTokenAccountBalance(wsolATA, 'confirmed');
      currentWSOL = BigInt(bal.value.amount);
    } catch (_) {
      /* ATA was empty or missing */
    }

    const deficit =
      BigInt(amountLamports) > currentWSOL ? BigInt(amountLamports) - currentWSOL : 0n;

    if (deficit > 0n) {
      console.log('TRANSFERRING WSOL INSTRUCTION');
      bigTx.add(
        SystemProgram.transfer({
          fromPubkey: userSolPk,
          toPubkey: wsolATA,
          lamports: deficit // ← send only the short-fall
        }),
        createSyncNativeInstruction(wsolATA)
      );
    }
  }
  /* ---------- balance PDA, TOKEN ATA, delegate ------------------- */
  //balance
  if ((await conn.getAccountInfo(signer.solUser.balanceAddress)) === null) {
    console.log('CREATING BALANCE PDA');
    bigTx.add(
      createBalanceAccountInstruction(
        signer.solUser.neonEvmProgram,
        userSolPk,
        userNeon,
        signer.solUser.chainId
      )
    );
  }

  //mint ata
  const ataPk = getAssociatedTokenAddressSync(
    mintPk,
    userSolPk,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  if ((await conn.getAccountInfo(ataPk)) === null) {
    console.log('CREATING TOKEN ATA');
    bigTx.add(
      createAssociatedTokenAccountInstruction(
        userSolPk,
        ataPk,
        userSolPk,
        mintPk,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  //delegate mint
  const contractAcc = contractAccountPda(wrapperAddr, signer.solUser.neonEvmProgram);
  let needsDelegate = true;
  try {
    const ataInfo = await getAccount(conn, ataPk);
    needsDelegate = !ataInfo.delegate || ataInfo.delegate.toBase58() !== contractAcc.toBase58();

    // if (needsDelegate) {
    console.log('DELEGATING MINT');

    bigTx.add(createApproveInstruction(ataPk, contractAcc, userSolPk, amountLamports));
    // }
  } catch (_) {
    console.log('DELEGATING MINT');
    bigTx.add(createApproveInstruction(ataPk, contractAcc, userSolPk, amountLamports));
  }

  //extra token ATA + delegate token
  if (tokenMintPk !== null) {
    const extraAtaPk = getAssociatedTokenAddressSync(
      tokenMintPk,
      userSolPk,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    if ((await conn.getAccountInfo(extraAtaPk)) === null) {
      console.log('CREATING EXTRA TOKEN ATA');
      bigTx.add(
        createAssociatedTokenAccountInstruction(
          userSolPk,
          extraAtaPk,
          userSolPk,
          tokenMintPk,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    // If a wrapper address is provided for this token, also delegate this extra ATA
    if (tokenWrapperAddr !== null) {
      const extraContractAcc = contractAccountPda(tokenWrapperAddr, signer.solUser.neonEvmProgram);
      try {
        const extraInfo = await getAccount(conn, extraAtaPk);
        const needsDelegateExtra =
          !extraInfo.delegate || extraInfo.delegate.toBase58() !== extraContractAcc.toBase58();
        //if (needsDelegateExtra) {
        console.log('DELEGATING TOKEN');
        bigTx.add(
          createApproveInstruction(extraAtaPk, extraContractAcc, userSolPk, amountLamports)
        );
        //}
      } catch (_) {
        console.log('DELEGATING TOKEN');
        bigTx.add(
          createApproveInstruction(extraAtaPk, extraContractAcc, userSolPk, amountLamports)
        );
      }
    }
  }

  /* ----------  build approve(router, MaxUint256) only if needed  ---------- */

  /* 1. look up current allowance on Neon via Contract */
  const token = new Contract(wrapperAddr, ERC20.abi, solanaprovider);
  const allowance = BigInt(
    await token.allowance(userNeon, routerAddr) // returns a bigint in v6
  );
  const threshold = MaxUint256 / BigInt(2); // MaxUint256 ÷ 2
  const nonce = await getNextFreeNonce(signer, userNeon);
  let scheduledAdded = false; // track whether we added a Neon call

  if (allowance < threshold) {
    /* 2. we DO need a new approve() */
    console.log('CREATING APPROVE INSTRUCTION');
    const erc20IF = new Interface(ERC20.abi);
    const approveData = erc20IF.encodeFunctionData('approve', [routerAddr, MaxUint256]);

    const gasQ = await signer.proxy.estimateScheduledTransactionGas({
      solanaPayer: userSolPk,
      transactions: [{ from: userNeon, to: wrapperAddr, data: approveData }]
    });

    const schedApprove = createScheduledNeonEvmTransaction({
      chainId: signer.solUser.chainId,
      neonEvmProgram: signer.solUser.neonEvmProgram,
      tokenMintAddress: signer.solUser.tokenMint,
      signerAddress: userSolPk,
      neonWallet: userNeon,
      neonWalletNonce: nonce,
      neonTransaction: new ScheduledTransaction({
        nonce,
        from: userNeon,
        to: wrapperAddr,
        data: approveData,
        gasLimit: toBeHex(gasQ.gasLimit[0]),
        maxFeePerGas: toBeHex(gasQ.maxFeePerGas),
        maxPriorityFeePerGas: toBeHex(gasQ.maxPriorityFeePerGas),
        chainId: toBeHex(signer.solUser.chainId),
        value: '0x'
      }).serialize()
    });

    bigTx.add(...schedApprove.instructions);
    scheduledAdded = true;
  } else {
    console.log(`Skip approve: current allowance (${allowance}) ≥ MaxUint256/2`);
  }

  /* ---------- send & wait ---------------------------------------- */
  if (bigTx.instructions.length === 0) {
    console.log('Nothing to do – everything already initialised.');
    return 'already-initialised';
  } else {
    console.log('initialising...');
  }

  /* send Solana tx */
  bigTx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  await signer.signAndSend(bigTx, conn);

  /* wait only if we actually scheduled a Neon transaction */
  if (scheduledAdded) {
    const [exec] = await signer.proxy.waitTransactionTreeExecution(userNeon, nonce, 30_000);
    if (exec.status !== 'InProgress' && exec.status !== 'Success')
      throw new Error(`initLaunch failed: ${exec.status}`);

    console.log(exec);
    // @ts-ignore
    return exec?.transaction_hash ?? exec.transactionHash; // ← Neon tx-hash
  }

  /* helper-only success path */
  return 'solana-helpers-done'; // nothing scheduled on Neon
}

export function contractAccountPda(evmAddr: string, neonEvmProgramId: PublicKey) {
  const seed = [numberToBuffer(AccountSeedTag.SeedVersion), hexToBuffer(evmAddr)];
  return PublicKey.findProgramAddressSync(seed, neonEvmProgramId)[0];
}

export async function getNextFreeNonce(signer: any, neonWallet: string) {
  const nonce = Number(await signer.proxy.getTransactionCount(neonWallet));
  let resp;
  try {
    resp = await signer.proxy.getScheduledTreeAccount(neonWallet, nonce);
  } catch (e) {
    console.warn(`[nonce] getScheduledTreeAccount failed for ${nonce}:`, e);
    console.log(`[nonce] Fallback: using txCount=${nonce} as next nonce.`);
    return nonce; // best-effort fallback
  }
  const active = resp?.result?.activeStatus;
  console.log(`[nonce] txCount=${nonce}, activeStatus=${active ?? 'Empty|undefined'}`);

  const terminal = new Set(['Success', 'Failed', 'Empty', 'Destroyed', 'Canceled']);

  if (!active || terminal.has(active)) {
    // Soft-terminal states: give the proxy a brief moment to flip to Empty
    if (active === 'Destroyed' || active === 'Canceled') {
      console.log(`[nonce] status=${active} → polling for Empty before reuse...`);
      for (let i = 0; i < 6; i++) {
        // ~3s total
        await new Promise((r) => setTimeout(r, 500));
        try {
          const again = await signer.proxy.getScheduledTreeAccount(neonWallet, nonce);
          const st = again?.result?.activeStatus;
          console.log(`[nonce] recheck #${i + 1}: status=${st ?? 'Empty|undefined'}`);
          if (!st || st === 'Empty') break;
        } catch (e) {
          console.warn(`[nonce] recheck failed:`, e);
          break; // don't block further
        }
      }
    }
    console.log(`[nonce] nonce ${nonce} is OK to use`);
    return nonce;
  }

  // Non-terminal states like NotStarted/InProgress, etc.
  console.warn(`[nonce] nonce ${nonce} is NOT free (status=${active}).`);
  if (active === 'InProgress') {
    throw new Error(
      'A transaction is still in progress. Please wait for completion before starting a new one.'
    );
  }
  if (active === 'NotStarted') {
    throw new Error(
      'A previously scheduled transaction has not started yet. Please wait or clear it before trying again.'
    );
  }
  throw new Error('Cannot schedule a new transaction right now. Please try again later.');
}

export async function neonSwapETHForTokens(
  signer: SolanaSignerTest,
  amountInWei: bigint,
  amountOutMin: bigint,
  path: string[],
  recipient: string,
  deadline: BigInt
) {
  /* ------------ 0. house-keeping --------------------------------- */
  const conn = new Connection(solanaRpc, 'confirmed');
  const owner = signer.address; // Phantom key
  const neonWallet = await signer.getAddress(); // 0x wallet
  const chainId = signer.solUser.chainId;
  const router = SolanaRouterAddress;
  const iface = new Interface(ethervistaSwapRouter);

  console.log(signer.solUser.balanceAddress.toBase58());

  const bacc = await conn.getAccountInfo(signer.solUser.balanceAddress);
  if (bacc) {
    const layout = BalanceAccountLayout.decode(bacc.data);
    console.log('Balance PDA:', layout);
  }

  /* ------------ 1. encode Router call ---------------------------- */
  const callData = iface.encodeFunctionData('swapExactETHForTokensSupportingFeeOnTransferTokens', [
    amountInWei,
    amountOutMin,
    path,
    recipient,
    deadline
  ]);

  const txData = {
    from: neonWallet,
    to: router,
    data: callData
  };

  // const approveInstruction2 = await approveTokenV2Instruction(
  //   signer.solUser,
  //   signer.solUser.neonEvmProgram,
  //   wsol,
  //   amountInWei.toString()
  // );

  // const balanceAccount = createBalanceAccountInstruction(
  //   signer.solUser.neonEvmProgram,
  //   owner,
  //   neonWallet,
  //   chainId
  // );

  /* ------------ 2. quote gas & get nonce ------------------------- */
  // const nonce = await getNextFreeNonce(signer, neonWallet);
  // const gasQuote = await signer.proxy.estimateScheduledTransactionGas({
  //   solanaPayer: owner,
  //   transactions: [txData],
  //   preparatorySolanaTransactions: [
  //     {
  //       instructions: prepareSolanaInstructions([approveInstruction2])
  //     }
  //   ]
  // });

  /* ------------ 3. build ScheduledNeonTx ------------------------- */
  // const schedTx = createScheduledNeonEvmTransaction({
  //   chainId,
  //   neonEvmProgram: signer.solUser.neonEvmProgram,
  //   tokenMintAddress: signer.solUser.tokenMint,
  //   signerAddress: owner,
  //   neonWallet,
  //   neonWalletNonce: nonce,
  //   neonTransaction: new ScheduledTransaction({
  //     nonce,
  //     from: neonWallet,
  //     to: router,
  //     data: callData,
  //     gasLimit: toBeHex(gasQuote.gasLimit[0]),
  //     maxFeePerGas: toBeHex(gasQuote.maxFeePerGas),
  //     maxPriorityFeePerGas: toBeHex(gasQuote.maxPriorityFeePerGas),
  //     chainId: toBeHex(chainId),
  //     value: '0x'
  //   }).serialize()
  // });
  // schedTx.feePayer = owner;

  /* ------------ 4. ensure Neon balance-PDA ----------------------- */
  // if ((await conn.getAccountInfo(signer.solUser.balanceAddress)) === null) {
  //   schedTx.instructions.unshift(balanceAccount);
  // }

  /* ------------ 5. finalise, sign & send ------------------------- */
  // schedTx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  // const solanaSignature = await signer.signAndSend(schedTx, conn);

  const approveData = approveTokensForSwapTransactionData(
    router,
    signer.solUser,
    wsol,
    amountInWei
  );

  const approveInstruction2 = await approveTokenV2Instruction(
    signer.solUser,
    signer.solUser.neonEvmProgram,
    wsol,
    amountInWei
  );

  const preparatorySolanaTransactions: PreparatorySolanaTransaction[] = [];
  const instructions: TransactionInstruction[] = [];
  if (approveInstruction2) {
    preparatorySolanaTransactions.push({
      instructions: [prepareSolanaInstruction(approveInstruction2!)]
    });
    instructions.push(approveInstruction2);
  }

  const gasQuote = await signer.proxy.estimateScheduledTransactionGas({
    solanaPayer: owner,
    transactions: [approveData, txData],
    preparatorySolanaTransactions
  });
  const nonce = await getNextFreeNonce(signer, neonWallet);

  const { scheduledTransaction } = await signer.proxy.createMultipleTransaction({
    nonce,
    transactionGas: gasQuote,
    transactionsData: [approveData, txData],
    solanaInstructions: instructions
  });

  // const { signature } = await signer.signAndSend(scheduledTransaction, conn);
  const signature = ``;

  /* ------------ 6. return immediately; let UI track status ------- */
  return { scheduled: true, solanaSignature: signature, nonce };
}

export async function getTokenSolAddress(tokenContract: Contract): Promise<PublicKey> {
  let solAddr = toAddress(await tokenContract.tokenMint());
  return solAddr;
}

export function toAddress(bytes32: NeonAddress): PublicKey {
  const raw = Buffer.from(bytes32.slice(2), 'hex'); // Buffer length 32
  const solanaAddress = bs58.encode(raw);
  return new PublicKey(solanaAddress);
}

export function approveTokensForSwapTransactionData(
  router: string,
  solUser: SolanaNeonAccount,
  token: SPLToken,
  amount: bigint
): TransactionData {
  const contractAbi = Interface.from(ERC20.abi);
  const approveData = contractAbi.encodeFunctionData('approve', [router, amount]);

  return {
    from: solUser.neonWallet,
    to: token.address,
    data: approveData
  };
}
