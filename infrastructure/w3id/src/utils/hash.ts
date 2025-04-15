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
    const hashHex = uint8ArrayToHex(new Uint8Array(hashBuffer));

    return hashHex;
}
