import canonicalize from "canonicalize";

export async function hash(
    input: string | Record<string, any>,
): Promise<string> {
    let dataToHash: string;

    if (typeof input === "string") {
        dataToHash = input;
    } else {
        const canonical = canonicalize(input);
        if (!canonical) {
            throw new Error("Failed to canonicalize object");
        }
        dataToHash = canonical;
    }

    const buffer = new TextEncoder().encode(dataToHash);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return hashHex;
}
