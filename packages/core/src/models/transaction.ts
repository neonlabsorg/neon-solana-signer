export interface ScheduledTransactionData {
  payer: string;
  sender: string;
  nonce: number | string;
  index: number | string;
  intent: string;
  intentCallData: string;
  target: string;
  callData: string;
  value: number | string;
  chainId: number | string;
  gasLimit: number | string;
  maxFeePerGas: number | string;
  maxPriorityFeePerGas: number | string;
  hash?: string;
}
