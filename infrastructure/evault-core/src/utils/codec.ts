export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string must have an even length");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58btcEncode(buffer: Uint8Array): string {
  let num = BigInt("0x" + Buffer.from(buffer).toString("hex"));
  const base = BigInt(58);
  let encoded = "";

  while (num > 0) {
    const remainder = num % base;
    num = num / base;
    encoded = BASE58_ALPHABET[Number(remainder)] + encoded;
  }

  // Handle leading zero bytes
  for (const byte of buffer) {
    if (byte === 0) {
      encoded = BASE58_ALPHABET[0] + encoded;
    } else {
      break;
    }
  }

  return encoded;
}

function base58btcDecode(str: string): Uint8Array {
  const base = BigInt(58);
  let num = BigInt(0);

  for (const char of str) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`Invalid Base58 character "${char}"`);
    num = num * base + BigInt(index);
  }

  let hex = num.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  let decoded = Uint8Array.from(Buffer.from(hex, "hex"));

  // Handle leading Base58 zeroes ('1' = 0x00)
  let leadingZeros = 0;
  for (const c of str) {
    if (c === BASE58_ALPHABET[0]) {
      leadingZeros++;
    } else {
      break;
    }
  }

  const result = new Uint8Array(leadingZeros + decoded.length);
  result.set(decoded, leadingZeros);
  return result;
}

export function base58btcMultibaseEncode(data: Uint8Array): string {
  return "z" + base58btcEncode(data); // 'z' = multibase prefix for base58btc
}

export function base58btcMultibaseDecode(multibaseStr: string): Uint8Array {
  if (!multibaseStr.startsWith("z")) {
    throw new Error("Only multibase Base58BTC ('z' prefix) is supported");
  }
  return base58btcDecode(multibaseStr.slice(1));
}
