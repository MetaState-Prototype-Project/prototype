import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a Forgejo webhook's `X-Forgejo-Signature` header.
 *
 * Two traps, both confirmed against GitW3's own source
 * (`services/webhook/shared/payloader.go`'s `AddDefaultHeaders`), not assumed:
 *
 * 1. The header is the **raw hex digest, with no algorithm prefix**. Forgejo also
 *    sends a GitHub-compatible `X-Hub-Signature-256` header alongside it, prefixed
 *    `sha256=` - it is easy to adapt GitHub-webhook-verification boilerplate that
 *    strips that prefix and point it at this header instead, which silently
 *    breaks every signature check. This function takes the header's bytes as-is.
 * 2. `rawBody` must be the exact bytes Forgejo signed on the wire, not a
 *    re-serialized `req.body`. If Express's JSON body parser re-`JSON.stringify`s
 *    the parsed payload before this is called, key ordering or whitespace
 *    differences make even a correctly-unprefixed comparison fail. Callers must
 *    capture the raw buffer explicitly (see webhook/push.ts) and pass that here,
 *    never `JSON.stringify(req.body)`.
 *
 * `timingSafeEqual`, not `===`, for the same reason as the bridge's
 * `client_secret` check - and length is checked first, since `timingSafeEqual`
 * throws (rather than returning false) on a length mismatch, which an attacker
 * could otherwise use to distinguish "wrong length" from "wrong bytes".
 */
export function verifyForgejoSignature(
    rawBody: Buffer,
    secret: string,
    header: string | undefined,
): boolean {
    if (!header) return false;

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

    let received: Buffer;
    let expectedBuf: Buffer;
    try {
        received = Buffer.from(header, "hex");
        expectedBuf = Buffer.from(expected, "hex");
    } catch {
        return false;
    }

    return (
        received.length === expectedBuf.length &&
        timingSafeEqual(received, expectedBuf)
    );
}
