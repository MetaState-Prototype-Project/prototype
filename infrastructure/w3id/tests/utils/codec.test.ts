import {
  uint8ArrayToHex,
  hexToUint8Array,
  stringToUint8Array,
} from "../../src/utils/codec";
import { describe, test, expect } from "vitest";

describe("Codec", () => {
  test("uint8ArrayToHex", () => {
    const input = new Uint8Array([1, 2, 3, 4]);
    const expected = "01020304";
    expect(uint8ArrayToHex(input)).toBe(expected);
  });

  test("hexToUint8Array", () => {
    const input = "01020304";
    const expected = new Uint8Array([1, 2, 3, 4]);
    expect(hexToUint8Array(input)).toEqual(expected);
  });

  test("hexToUint8Array (Odd Length)", () => {
    const input = "010203045";
    expect(() => hexToUint8Array(input)).toThrow(
      "Hex string must have an even length",
    );
  });

  test("stringToUint8Array", () => {
    const input = "hello";
    const expected = new Uint8Array([104, 101, 108, 108, 111]);
    expect(stringToUint8Array(input)).toEqual(expected);
  });
});
