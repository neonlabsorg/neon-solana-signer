import { blob, Layout, ns64, struct, u32, u8 } from '@solana/buffer-layout';
import { encodeDecode } from '@solana/buffer-layout-utils';
import { hexToBuffer } from '../utils';
import { HexString } from '../models';

export const hexStringLayout = (length: number, property?: string): Layout<HexString> => {
  const layout = blob(length, property);
  const { encode, decode } = encodeDecode(layout);

  const publicKeyLayout = layout as Layout<unknown> as Layout<HexString>;

  publicKeyLayout.decode = (buffer: Buffer, offset: number) => {
    const src = decode(buffer as any, offset);
    return `0x${Buffer.from(src).toString('hex')}`;
  };

  publicKeyLayout.encode = (hex: HexString, buffer: Buffer, offset: number) => {
    const src = hexToBuffer(hex);
    return encode(src, buffer as any, offset);
  };

  return publicKeyLayout;
};


export interface BalanceAccountRaw {
  type: number;
  headerVersion: number;
  address: HexString;
  chainId: bigint;
  nonce: bigint;
  balance: number;
}

export const BalanceAccountLayout = struct<BalanceAccountRaw>([
  u8('type'),
  u8('headerVersion'),
  hexStringLayout(20, 'address'),
  ns64('chainId'),
  ns64('nonce'),
  u32('balance')
]);
