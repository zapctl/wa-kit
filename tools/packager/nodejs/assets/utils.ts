import { inflateSync } from "node:zlib";

export function BytesEquals(bytes1: Uint8Array, bytes2: Uint8Array) {
  return bytes1.byteLength === bytes2.byteLength &&
    bytes1.every((b, i) => bytes2[i] === b);
}

export function IntToBytes(value: number, size: number) {
  const intValue = BigInt(value);
  const maxValue = (1n << BigInt(size * 8)) - 1n;

  if (intValue > maxValue) {
    throw new RangeError(`Value ${value} exceeds the maximum size for ${size} bytes.`);
  }

  const view = new DataView(new ArrayBuffer(Math.max(size, 8)));
  view.setBigInt64(Math.max(0, size - 8), intValue);

  return new Uint8Array(view.buffer, view.byteLength - size, size);
}

export function StringToBytes(str: string) {
  return new Uint8Array(new TextEncoder().encode(str));
}

export function Base64ToBytes(str: string) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export function BytesToInt(bytes: Uint8Array) {
  let view: DataView;

  if (bytes.byteLength < 8) {
    const paddedBytes = new Uint8Array(8);
    paddedBytes.set(bytes, 8 - bytes.byteLength);

    view = new DataView(paddedBytes.buffer);
  } else {
    view = new DataView(bytes.buffer, bytes.byteOffset + bytes.byteLength - 8, 8);
  }

  return Number(view.getBigInt64(0));
}

export function BytesToString(bytes: Uint8Array, encoding = "utf-8") {
  return new TextDecoder(encoding).decode(bytes);
}

export function BytesToBase64(bytes: Uint8Array) {
  return btoa(bytes.reduce((data, byte) => data + String.fromCharCode(byte), ""));
}

export function BytesToBase64Url(bytes: Uint8Array) {
  return BytesToBase64(bytes)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function Base64UrlToBytes(str: string) {
  const base64Encoded = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));

  return Base64ToBytes(base64Encoded + padding);
}

export function BytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => {
    return ("0" + (byte & 0xFF).toString(16)).slice(-2);
  }).join("")
}

export type BytesConcatLike = string | number | Uint8Array | ArrayBuffer;

export function BytesConcat(values: BytesConcatLike[]) {
  let totalLength = 0;

  for (const value of values) {
    if (value instanceof Uint8Array) {
      totalLength += value.byteLength;
    } else if (value instanceof ArrayBuffer) {
      totalLength += value.byteLength;
    } else if (typeof value === "string") {
      totalLength += value.length;
    } else if (typeof value === "number") {
      totalLength += 1;
    }
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const value of values) {
    if (value instanceof Uint8Array) {
      result.set(value, offset);
      offset += value.byteLength;
    } else if (value instanceof ArrayBuffer) {
      result.set(new Uint8Array(value), offset);
      offset += value.byteLength;
    } else if (typeof value === "string") {
      const bytes = StringToBytes(value);
      result.set(bytes, offset);
      offset += bytes.length;
    } else if (typeof value === "number") {
      result[offset] = value % 0xFF;
      offset += 1;
    }
  }

  return result;
}

export function RandomBytes(length: number) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  return array;
}

export function RandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function DecompressZLib(buffer: Uint8Array) {
  if (buffer[0] !== 0x78) return buffer;
  return inflateSync(buffer);
}

export function UnixTimestampToDate(timestamp: bigint | number | string) {
  return new Date(Number(timestamp) * 1000);
}