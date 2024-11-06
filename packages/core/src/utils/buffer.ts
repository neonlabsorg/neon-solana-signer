import { HexString } from '../models';

export function isValidHex(hex: string | number): boolean {
  const isHexStrict = /^(0x)?[0-9a-f]*$/i.test(hex.toString());
  if (!isHexStrict) {
    throw new Error(`Given value "${hex}" is not a valid hex string.`);
  }
  return isHexStrict;
}

export function hexToBuffer(hex: HexString): Buffer {
  const _hex = isValidHex(hex) ? hex.replace(/^0x/i, '') : hex;
  return Buffer.from(_hex, 'hex');
}

export function bufferToHex(data: ArrayBuffer): HexString {
  return Buffer.from(data).toString('hex');
}

export function numberToBuffer(size: number): Buffer {
  return Buffer.from([size]);
}

export function stringToBuffer(str: string, encoding = 'utf8'): Buffer {
  return Buffer.from(str, encoding as any);
}

export function bufferConcat(list: Buffer[], totalLength?: number): Buffer {
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

export function numberTo64BitLittleEndian(num: number): Uint8Array {
  const buffer = new ArrayBuffer(8); // 64 bits = 8 bytes
  const view = new DataView(buffer);

  // Split the number into high and low 32-bit parts
  const low = num % Math.pow(2, 32);
  const high = Math.floor(num / Math.pow(2, 32));

  view.setUint32(0, low, true); // true for little-endian
  view.setUint32(4, high, true); // high part is set after low part

  return new Uint8Array(buffer);
}

export function toBytesLittleEndian(num: number | bigint, byteLength: number): Buffer {
  const buffer = Buffer.alloc(byteLength);
  buffer.writeBigUInt64LE(BigInt(num), 0);
  return buffer;
}
