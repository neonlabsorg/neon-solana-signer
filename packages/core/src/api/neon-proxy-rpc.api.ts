import { Keypair, PublicKey } from '@solana/web3.js';
import build from 'fetch-retry';
import { JsonRpcProvider } from 'ethers';
import {
  BlockByNumber,
  CreateMultipleTransaction,
  CreateScheduledTransaction,
  EstimatedScheduledGasPayData,
  EstimatedScheduledGasPayResponse,
  GasToken,
  HexString,
  MaxFeePerGas,
  NeonAddress,
  NeonAddressResponse,
  NeonEvmParams,
  NeonGasPrice,
  NeonProxyRpcInitData,
  NeonProxyRpcOptions,
  PendingTransactions,
  ProxyApiState,
  RPCRequest,
  RPCResponse,
  RPCUrl,
  ScheduledTransactionResult,
  ScheduledTransactionsResult,
  ScheduledTransactionStatus,
  ScheduledTreeAccount,
  SolanaAddress,
  SolanaSignature,
  TransactionByHash,
  TransactionGas
} from '../models';
import { delay, getGasToken, log, logJson, prepareHeaders, uuid } from '../utils';
import { MAX_PRIORITY_FEE_PER_GAS_DEFAULT, ScheduledTransaction } from '../neon';
import {
  createScheduledNeonEvmMultipleTransaction,
  createScheduledNeonEvmTransaction,
  selectMultipleTransactionMethod,
  SolanaNeonAccount
} from '../solana';

const neonProxyRpcOptionsDefault: NeonProxyRpcOptions = {
  showRequestLog: true,
  space: undefined,
  retries: 5,
  retryDelay: 1e3
};

export class NeonProxyRpcApi {
  chainId: number;
  programAddress: PublicKey;
  tokenMintAddress: PublicKey;
  params: NeonEvmParams;
  provider: JsonRpcProvider;
  private _solanaUser: SolanaNeonAccount | null;

  readonly rpcUrl: RPCUrl;
  private readonly options?: NeonProxyRpcOptions;

  get solanaUser(): SolanaNeonAccount {
    if (this._solanaUser instanceof SolanaNeonAccount) {
      return this._solanaUser;
    } else {
      throw new Error(`SolanaNeonAccount is not initialized`);
    }
  }

  set solanaUser(solanaUser: SolanaNeonAccount) {
    this._solanaUser = solanaUser;
  }

  async evmParams(): Promise<NeonEvmParams> {
    return this.neonRpc<NeonEvmParams>('neon_getEvmParams', []).then(({ result }) => result);
  }

  getAccount(account: NeonAddress, nonce: number): Promise<RPCResponse<NeonAddressResponse>> {
    return this.neonRpc('neon_getAccount', [account, nonce]);
  }

  getTransactionReceipt(transactionHash: string): Promise<RPCResponse<any>> {
    return this.neonRpc('neon_getTransactionReceipt', [transactionHash]);
  }

  gasPrice(): Promise<RPCResponse<NeonGasPrice>> {
    return this.neonRpc('neon_gasPrice', []);
  }

  async nativeTokenList(): Promise<GasToken[]> {
    return this.neonRpc<GasToken[]>('neon_getNativeTokenList', []).then(({ result }) => result);
  }

  sendRawScheduledTransaction(transaction: HexString): Promise<RPCResponse<HexString>> {
    return this.neonRpc<string>('neon_sendRawScheduledTransaction', [transaction]);
  }

  getNeonTransactionByAddress(pubkey: PublicKey): Promise<RPCResponse<HexString>> {
    return this.neonRpc<string>('neon_getTransactionByHash', [pubkey.toBase58()]);
  }

  estimateScheduledTransaction(transaction: HexString): Promise<RPCResponse<HexString>> {
    return this.neonRpc<string>('neon_estimateScheduledTransaction', [transaction]);
  }

  getPendingTransactions(solanaWallet: PublicKey): Promise<RPCResponse<PendingTransactions>> {
    return this.neonRpc<PendingTransactions>('neon_getPendingTransactions', [solanaWallet.toBase58()]);
  }

  async getTransactionCount(neonWallet: NeonAddress): Promise<string> {
    const { result } = await this.neonRpc<string>('eth_getTransactionCount', [neonWallet, 'latest']);
    return result;
  }

  getTransactionByHash(signature: SolanaSignature): Promise<RPCResponse<TransactionByHash>> {
    return this.neonRpc<TransactionByHash>('eth_getTransactionByHash', [signature]);
  }

  async waitTransactionByHash(signature: string, duration: number, delayTimeout = 300): Promise<TransactionByHash | null> {
    const start = Date.now();
    while (duration > Date.now() - start) {
      const { result } = await this.getTransactionByHash(signature);
      if (result?.hash) {
        return result;
      }
      await delay(delayTimeout);
    }
    return null;
  }

  async waitTransactionTreeExecution(address: NeonAddress | SolanaAddress, nonce: number, duration: number, delayTimeout = 300): Promise<ScheduledTransactionStatus[]> {
    const start = Date.now();
    const trx: ScheduledTransactionStatus[] = [];
    while (duration > Date.now() - start) {
      const { result } = await this.getScheduledTreeAccount(address, nonce);
      if (!result) {
        return trx;
      }
      const { transactions } = result;
      if (result?.activeStatus) {
        for (const tx of transactions) {
          const index = trx.findIndex(i => i.transactionHash === tx.transactionHash);
          if (index === -1) {
            trx.push(tx);
          } else {
            trx[index] = tx;
          }
        }
        if (['Success', 'Empty', 'Failed'].includes(result.activeStatus)) {
          return trx;
        }
      }
      await delay(delayTimeout);
    }
    return trx;
  }

  getScheduledTreeAccount(address: NeonAddress | SolanaAddress, nonce: number): Promise<RPCResponse<ScheduledTreeAccount | null>> {
    return this.neonRpc<ScheduledTreeAccount | null>('neon_getScheduledTreeAccount', [address, nonce, 'latest']);
  }

  estimateScheduledGas(estimatedData: EstimatedScheduledGasPayData): Promise<RPCResponse<EstimatedScheduledGasPayResponse>> {
    const { solanaPayer, transactions, preparatorySolanaTransactions } = estimatedData;
    const scheduledSolanaPayer = solanaPayer.toBase58();
    const data = { scheduledSolanaPayer, transactions, preparatorySolanaTransactions };
    return this.neonRpc<EstimatedScheduledGasPayResponse>('neon_estimateScheduledGas', [data]);
  }

  maxPriorityFeePerGas(): Promise<RPCResponse<HexString>> {
    return this.neonRpc(`eth_maxPriorityFeePerGas`, []);
  }

  getBlockByNumber(block: HexString, detail = false): Promise<RPCResponse<BlockByNumber>> {
    return this.neonRpc(`eth_getBlockByNumber`, [block, detail]);
  }

  async getMaxFeePerGas(): Promise<MaxFeePerGas> {
    const { result: maxPriorityFeePerGasHex } = await this.maxPriorityFeePerGas();
    const { result } = await this.getBlockByNumber(`latest`, false);
    const a = parseInt(maxPriorityFeePerGasHex, 16);
    const b = MAX_PRIORITY_FEE_PER_GAS_DEFAULT;
    const maxPriorityFeePerGas = a > b ? a : b;
    const maxFeePerGas = Math.floor(parseInt(result.baseFeePerGas, 16) * 1.5 + maxPriorityFeePerGas);
    return { maxPriorityFeePerGas, maxFeePerGas };
  }

  ethGetTransactionReceipt(transaction: HexString): Promise<any> {
    return this.neonRpc<string>('eth_getTransactionReceipt', [transaction]);
  }

  /**
   * Sends ScheduledTransactions to the Proxy for subsequent execution.
   * @param {HexString[]} transactions - an array of {ScheduledTransaction} in hex format
   * @return {RPCResponse<HexString>[]} - an array of {RPCResponse} containing a list of transactions for NeonEVM
   * that can potentially be executed and found in the explorer.
   * @example
   * ```typescript
   * const transactionsData: TransactionData[] = [{
   *   from: solanaUser.neonWallet,
   *   to: contractAddress_0,
   *   data: contractData_0
   * }, {
   *   from: solanaUser.neonWallet,
   *   to: contractAddress_1,
   *   data: contractData_1
   * }];
   * const transactionGas = await proxyApi.estimateScheduledTransactionGas({
   *   scheduledSolanaPayer: solanaUser.publicKey.toBase58(),
   *   transactions: transactionsData
   * });
   * const { scheduledTransaction, transactions } = await proxyApi.createMultipleTransaction({
   *   transactionsData,
   *   transactionGas
   * });
   * const result = await proxyApi.sendRawScheduledTransactions(transactions);
   * console.log(result)
   * ```
   */
  async sendRawScheduledTransactions(transactions: ScheduledTransaction[]): Promise<RPCResponse<HexString>[]> {
    const method = `neon_sendRawScheduledTransaction`;
    const body: RPCRequest[] = transactions.map(tx => {
      const id = uuid();
      return { id, jsonrpc: '2.0', method, params: [tx.serialize()] };
    });
    return this.neonMethodsRpc<HexString>(body);
  }

  /**
   * Calculates the gas fee
   *
   * @param {EstimatedScheduledGasPayData} data - transaction data used for gas fee estimation
   * @return {TransactionGas}
   */
  async estimateScheduledTransactionGas(data: EstimatedScheduledGasPayData): Promise<TransactionGas> {
    let { maxPriorityFeePerGas, maxFeePerGas } = await this.getMaxFeePerGas();
    let gasLimit = data.transactions.map(_ => 1e7);
    try {
      const { result, error } = await this.estimateScheduledGas(data);
      logJson(error);
      if (result) {
        logJson(result);
        maxFeePerGas = parseInt(result.maxFeePerGas, 16);
        maxPriorityFeePerGas = parseInt(result.maxPriorityFeePerGas, 16);
        gasLimit = result.gasList.map(i => parseInt(i, 16));
      }
    } catch (e) {
      log(e);
    }
    return { gasLimit, maxFeePerGas, maxPriorityFeePerGas };
  }

  /**
   * A simple way to create a {ScheduledTransaction}
   *
   * @param {CreateScheduledTransaction} createData - data used to create the transaction
   * @return {ScheduledTransactionResult}
   */
  async createScheduledTransaction(createData: CreateScheduledTransaction): Promise<ScheduledTransactionResult> {
    const { transactionGas, transactionData } = createData;
    const solanaUser = createData.solanaUser ? createData.solanaUser : this.solanaUser;
    const nonce = createData.nonce ? createData.nonce : await this.provider.getTransactionCount(solanaUser.neonWallet);
    const instructions = createData.solanaInstructions ? createData.solanaInstructions : [];
    const chainId = createData.chainId ? createData.chainId : this.chainId;
    const programAddress = createData.programAddress ? createData.programAddress : this.programAddress;
    const tokenMintAddress = createData.tokenMintAddress ? createData.tokenMintAddress : this.tokenMintAddress;
    const { from, to, data } = transactionData;
    const { maxFeePerGas, maxPriorityFeePerGas, gasLimit } = transactionGas;
    const transaction = new ScheduledTransaction({
      chainId,
      nonce,
      from,
      to,
      data,
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit: gasLimit[0]
    });

    const scheduledTransaction = createScheduledNeonEvmTransaction({
      chainId,
      signerAddress: solanaUser.publicKey,
      neonEvmProgram: programAddress,
      tokenMintAddress: tokenMintAddress,
      neonWallet: solanaUser.neonWallet,
      neonWalletNonce: nonce,
      neonTransaction: transaction.serialize()
    });

    if (instructions.length > 0) {
      for (const instruction of instructions) {
        scheduledTransaction.instructions.unshift(instruction);
      }
    }

    return { scheduledTransaction, transaction };
  }

  /**
   * A simple way to create a {MultipleTransaction}
   *
   * @param {CreateScheduledTransaction} createData - data used to create the transaction
   * @return {ScheduledTransactionsResult}
   */
  async createMultipleTransaction(createData: CreateMultipleTransaction): Promise<ScheduledTransactionsResult> {
    const { transactionGas, transactionsData } = createData;
    const solanaUser = createData.solanaUser ? createData.solanaUser : this.solanaUser;
    const nonce = createData.nonce ? createData.nonce : await this.provider.getTransactionCount(solanaUser.neonWallet);
    const instructions = createData.solanaInstructions ? createData.solanaInstructions : [];
    const chainId = createData.chainId ? createData.chainId : this.chainId;
    const programAddress = createData.programAddress ? createData.programAddress : this.programAddress;
    const tokenMintAddress = createData.tokenMintAddress ? createData.tokenMintAddress : this.tokenMintAddress;
    const selectedMethod = typeof createData.method === 'function' ?
      createData.method : selectMultipleTransactionMethod(createData.method);
    const { multiple, transactions } = selectedMethod({ nonce, chainId, transactionsData, transactionGas });

    const scheduledTransaction = createScheduledNeonEvmMultipleTransaction({
      chainId,
      neonWalletNonce: nonce,
      neonEvmProgram: programAddress,
      neonTransaction: multiple.data,
      signerAddress: solanaUser.publicKey,
      tokenMintAddress: tokenMintAddress,
      neonWallet: solanaUser.neonWallet
    });

    if (instructions.length > 0) {
      for (const instruction of instructions) {
        scheduledTransaction.instructions.unshift(instruction);
      }
    }

    return {
      scheduledTransaction,
      transactions
    };
  }

  /**
   * Initializes all necessary components for creating a {ScheduledTransaction}.
   * Retrieves {chainId}, {NeonEvmParams}, {neonProgramAddress}, {tokenMintAddress}, and {JsonRpcProvider}.
   *
   * @param {PublicKey | Keypair} solanaAddress - (optional) if provided, creates a {SolanaNeonAccount} used in the {ScheduledTransaction}
   * @return {NeonProxyRpcInitData}
   */
  async init(solanaAddress?: PublicKey | Keypair): Promise<NeonProxyRpcInitData> {
    const requests: RPCRequest[] = [
      { jsonrpc: '2.0', id: uuid(), method: 'eth_chainId', params: [] },
      { jsonrpc: '2.0', id: uuid(), method: 'neon_getEvmParams', params: [] },
      { jsonrpc: '2.0', id: uuid(), method: 'neon_getNativeTokenList', params: [] }
    ];
    const [{ result: chainId }, { result: evmParams }, { result: nativeTokenList }] = await this.neonMethodsRpc(requests);
    this.chainId = Number(chainId);
    this.params = evmParams as NeonEvmParams;
    this.programAddress = new PublicKey(this.params.neonEvmProgramId);
    const { tokenMintAddress } = getGasToken(nativeTokenList as GasToken[], this.chainId);
    this.tokenMintAddress = tokenMintAddress;
    if (solanaAddress) {
      if (solanaAddress instanceof PublicKey) {
        this._solanaUser = new SolanaNeonAccount(solanaAddress, this.programAddress, this.tokenMintAddress, this.chainId);
      }
      if (solanaAddress instanceof Keypair) {
        this._solanaUser = SolanaNeonAccount.fromKeypair(solanaAddress, this.programAddress, this.tokenMintAddress, this.chainId);
      }
    }
    return {
      provider: this.provider,
      chainId: this.chainId,
      params: this.params,
      programAddress: this.programAddress,
      tokenMintAddress: this.tokenMintAddress,
      solanaUser: this.solanaUser
    };
  }

  async neonRpc<T>(method: string, params: unknown[] = []): Promise<RPCResponse<T>> {
    return NeonProxyRpcApi.rpc<RPCResponse<T>>(this.rpcUrl, method, params, this.options);
  }

  async neonMethodsRpc<T>(methods: RPCRequest[]): Promise<RPCResponse<T>[]> {
    return NeonProxyRpcApi.fetch<RPCResponse<T>[]>(this.rpcUrl, methods, this.options);
  }

  static async rpc<T>(url: string, method: string, params: unknown[] = [], options?: NeonProxyRpcOptions): Promise<T> {
    const id = uuid();
    return NeonProxyRpcApi.fetch<T>(url, { id, jsonrpc: '2.0', method, params }, options);
  }

  static async fetch<T>(url: string, request: RPCRequest | RPCRequest[], options?: NeonProxyRpcOptions): Promise<T> {
    const [headers, headersString] = prepareHeaders({});
    const body = JSON.stringify(request, null, options?.space);
    const fetchData: RequestInit = {
      headers,
      body,
      method: 'POST',
      mode: 'cors'
    };
    if (options?.showRequestLog) {
      log(`curl ${url} -X POST ${headersString} -d '${body}' | jq .`);
    }
    const retry = build(fetch, { retries: options?.retries || 5, retryDelay: options?.retryDelay || 1e3 });
    const response = await retry(url, fetchData);
    const result = await response.text();
    return JSON.parse(result);
  }

  constructor(url: RPCUrl, options: NeonProxyRpcOptions = {}) {
    this.rpcUrl = url;
    this.provider = new JsonRpcProvider(this.rpcUrl);
    this.options = { ...neonProxyRpcOptionsDefault, ...options };
  }
}

export async function getProxyState(proxyUrl: string, options: NeonProxyRpcOptions = {}): Promise<ProxyApiState> {
  const provider = new JsonRpcProvider(proxyUrl);
  const proxyApi = new NeonProxyRpcApi(proxyUrl, options);
  const proxyStatus = await proxyApi.evmParams();
  const tokensList = await proxyApi.nativeTokenList();
  const { chainId } = await provider.getNetwork();
  const evmProgramAddress = new PublicKey(proxyStatus.neonEvmProgramId);
  const gasToken = getGasToken(tokensList, Number(chainId));
  return { proxyApi, provider, chainId: Number(chainId), proxyStatus, gasToken, tokensList, evmProgramAddress };
}
