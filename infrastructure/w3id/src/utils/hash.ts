import canonicalize from "canonicalize";
import { uint8ArrayToHex } from "./codec";

export async function hash(
  input: string | Record<string, unknown>,
): Promise<string> {
  let dataToHash: string;

  if (typeof input === "string") {
    dataToHash = input;
  } else {
    const canonical = canonicalize(input);
    if (!canonical) {
      throw new Error(
        `Failed to canonicalize object: ${JSON.stringify(input).substring(0, 100)}...`,
      );
    }
    dataToHash = canonical;
  }

  const buffer = new TextEncoder().encode(dataToHash);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  // const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = uint8ArrayToHex(
    Array.from(new Uint8Array(hashBuffer)) as unknown as Uint8Array,
  );

  return hashHex;
}
