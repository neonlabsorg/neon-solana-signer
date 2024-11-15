import { blob, Layout, ns64, struct, u32, u8 } from '@solana/buffer-layout';
import { encodeDecode } from '@solana/buffer-layout-utils';
import { bufferToHex, hexToBuffer } from '../utils';
import { HexString } from '../models';

export const hexStringLayout = (length: number, property?: string): Layout<HexString> => {
  const layout = blob(length, property);
  const { encode, decode } = encodeDecode(layout);

  const publicKeyLayout = layout as Layout<unknown> as Layout<HexString>;

  publicKeyLayout.decode = (buffer: Buffer, offset: number) => {
    const src = decode(buffer as any, offset);
    return `0x${bufferToHex(src)}`;
  };

  publicKeyLayout.encode = (hex: HexString, buffer: Buffer, offset: number) => {
    const src = hexToBuffer(hex);
    return encode(src, buffer as any, offset);
  };

  return publicKeyLayout;
};


export interface BalanceAccountRaw {
  type: number;
  header_version: number;
  address: HexString;
  chain_id: bigint;
  trx_count: bigint;
  balance: number;
}

export const BalanceAccountLayout = struct<BalanceAccountRaw>([
  u8('type'),
  u8('header_version'),
  hexStringLayout(20, 'address'),
  ns64('chain_id'),
  ns64('trx_count'),
  u32('balance')
]);
