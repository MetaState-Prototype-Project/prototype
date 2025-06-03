import { createHmac } from "crypto";

export function createHmacSignature(body: Record<string, any>, secret: string) {
    return createHmac("sha256", secret)
        .update(JSON.stringify(body))
        .digest("hex");
}

export function verifyHmacSignature(
    body: Record<string, any>,
    signature: string,
    secret: string,
) {
    const expectedSignature = createHmacSignature(body, secret);
    return expectedSignature === signature;
}
