import { post } from '../utils';
import { NeonAddress } from '../models';

export class NeonClientApi {
  private url: string;

  transactionTree(origin: NeonAddress, nonce: number): any {
    const body = { origin, nonce };
    return post(`${this.url}/transaction_tree`, body);
  }

  constructor(url: string) {
    this.url = url;
  }
}
