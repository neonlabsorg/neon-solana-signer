import { blob, Layout, ns64, struct, u32, u8 } from '@solana/buffer-layout';
import { encodeDecode } from '@solana/buffer-layout-utils';
import { hexToBuffer } from '../utils';
import { HexString } from '../models';

/**
 * Creates a **custom binary layout** for encoding and decoding **hexadecimal strings**.
 *
 * This function provides a structured way to store and retrieve **HexString** values
 * within binary data layouts, commonly used for **binary serialization** in **Neon EVM transactions**.
 *
 * @param {number} length - The **length (in bytes)** of the expected hexadecimal string.
 * @param {string} [property] - An optional **property** for the layout.
 * @returns {Layout<HexString>} A **binary layout structure** capable of encoding and decoding hex strings.
 *
 * ### **How It Works**
 * - **Encodes hex strings into binary format** for efficient storage.
 * - **Decodes binary data back into a prefixed `0x` hex string** for readability.
 * - Uses **buffer operations** to **manipulate hex data** in a structured format.
 *
 * ### **Example Usage**
 * ```typescript
 * const layout = hexStringLayout(32, "publicKey");
 * const buffer = Buffer.alloc(32);
 * layout.encode("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", buffer, 0);
 * const decodedHex = layout.decode(buffer, 0);
 * console.log(decodedHex); // Outputs: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
 * ```
 */
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
