import type { HexString } from '@neonevm/solana-sign';
import { Contract, Interface, JsonRpcProvider } from 'ethers';
import { COUNTER_CONTRACT_ADDRESS } from './consts';
import { counterContractAbi } from '../data/abi';

export function counterContract(): Interface {
  return new Interface(counterContractAbi);
}

export class CounterContract {
  contract: Contract;
  address: HexString;

  transactionData(method: string): string {
    return counterContract().encodeFunctionData(method);
  }

  async getCount(): Promise<number> {
    try {
      return Number(await this.contract.getCount());
    } catch (error) {
      console.error("Error fetching counter:", error);
      return 0;
    }
  }

  constructor(provider: JsonRpcProvider) {
    this.contract = new Contract(COUNTER_CONTRACT_ADDRESS, counterContractAbi, provider);
    this.address = COUNTER_CONTRACT_ADDRESS;
  }
}
