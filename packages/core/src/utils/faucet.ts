import { post } from './rest';

export class FaucetDropper {
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async requestERC20(wallet: string, address_spl: string, amount: number): Promise<any> {
    return post(`${this.url}/request_erc20`, { amount, wallet, address_spl });
  }

  async requestNeon(wallet: string, amount: number): Promise<any> {
    try {
      return await post(`${this.url}/request_neon`, { amount, wallet });
    } catch (e) {
      return 0;
    }
  }
}
