export interface TreeAccountTransactionData {
  status: string;
  result_hash: string;
  transaction_hash: string;
  gas_limit: string;
  value: string;
  child_transaction: number;
  success_execute_limit: number;
  parent_count: number;
}

export interface TreeAccountData {
  result: string;
  value: {
    status: string;
    pubkey: string;
    payer: string;
    last_slot: number;
    chain_id: number;
    max_fee_per_gas: string;
    max_priority_fee_per_gas: string;
    balance: string;
    last_index: number;
    transactions: TreeAccountTransactionData[];
  };
}
