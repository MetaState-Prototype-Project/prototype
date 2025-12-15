import { describe, expect, it } from "vitest";
import { base58btc } from "multiformats/bases/base58";
import { _testHelpers } from "./index";

describe("signature validator decoding", () => {
  it("decodes z-prefixed base58btc signatures", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252, 253, 254, 255]);
    const multibaseSignature = base58btc.encode(bytes); // includes leading 'z'

    const decoded = await _testHelpers.decodeSignature(multibaseSignature);

    expect(decoded).toEqual(bytes);
  });

  it("decodes z-prefixed base58btc public keys", async () => {
    const bytes = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const multibaseKey = base58btc.encode(bytes); // includes leading 'z'

    const decoded = await _testHelpers.decodeMultibasePublicKey(multibaseKey);

    expect(decoded).toEqual(bytes);
  });

  it("decodes z-prefixed hex public keys", async () => {
    const hex = "0a0b0c0d0e0f";
    const multibaseKey = `z${hex}`;

    const decoded = await _testHelpers.decodeMultibasePublicKey(multibaseKey);

    expect(decoded).toEqual(new Uint8Array([0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f]));
  });

  it("decodes 0x-prefixed hex public keys", async () => {
    const hex = "3059301306072a8648ce3d020106082a8648ce3d03010703420004180f32e2d5b8dd2d87ce3a9a7ff84806f3526b84e4496a6ee5a5f458d323133377229791a5ef8dd2059c2ff2ceca1fa70e8069433ea126185268de4df42c4861";
    const decoded = await _testHelpers.decodeMultibasePublicKey(`0x${hex}`);

    expect(decoded.byteLength).toBe(hex.length / 2);
    // spot-check first/last bytes
    expect(decoded[0]).toBe(0x30);
    expect(decoded[decoded.length - 1]).toBe(0x61);
  });
});

