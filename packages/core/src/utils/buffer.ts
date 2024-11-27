import { HexString } from '../models';

export function isValidHex(hex: string | number): boolean {
  const isHexStrict = /^(0x)?[0-9a-f]*$/i.test(hex.toString());
  if (!isHexStrict) {
    throw new Error(`Given value "${hex}" is not a valid hex string.`);
  }
  return isHexStrict;
}

export function bufferAlloc(size: number) {
  return Buffer.alloc(size);
}

export function hexToBuffer(hex: HexString) {
  const _hex = isValidHex(hex) ? hex.replace(/^0x/i, '') : hex;
  return Buffer.from(_hex, 'hex');
}

export function bufferToHex(data: ArrayBuffer): HexString {
  return Buffer.from(data).toString('hex');
}

export function numberToBuffer(size: number) {
  return Buffer.from([size]);
}

export function stringToBuffer(str: string, encoding = 'utf8') {
  return Buffer.from(str, encoding as any);
}

export function bufferConcat(list: Uint8Array[], totalLength?: number) {
  return Buffer.concat(list, totalLength);
}

export function toU256BE(bigIntNumber: bigint): Uint8Array {
  if (bigIntNumber < BigInt(0) || bigIntNumber > BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')) {
    throw new Error('Number out of range for U256BE');
  }

  const buffer = new ArrayBuffer(32); // 256 bits = 32 bytes
  const view = new DataView(buffer);

  // Loop through each byte and set it from the start to maintain big-endian order
  for (let i = 0; i < 32; i++) {
    // Extract each byte of the BigInt number
    const byte = Number((bigIntNumber >> BigInt(8 * (31 - i))) & BigInt(0xFF));
    view.setUint8(i, byte);
  }

  return new Uint8Array(buffer);
}

export function toBytesInt32(number: number, littleEndian = true): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(4); // an Int32 takes 4 bytes
  const dataView = new DataView(arrayBuffer);
  dataView.setUint32(0, number, littleEndian); // byteOffset = 0; litteEndian = false
  return arrayBuffer;
}

export function toBytesLittleEndian(num: number | bigint, byteLength: number): Buffer {
  const buffer = Buffer.alloc(byteLength);
  buffer.writeBigUInt64LE(BigInt(num), 0);
  return buffer;
}
