import canonicalize from "canonicalize";

export async function hashOject(object: Record<string, any>) {
    const canonical = canonicalize(object);
    const buffer = new TextEncoder().encode(canonical);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return hashHex;
}
