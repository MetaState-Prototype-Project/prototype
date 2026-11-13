/**
 * Prefixed console logging. Callers must never pass signatures, codes, tokens
 * or client secrets: the connector's logs are not a secret store.
 */

const PREFIX = "[w3ds-oidc]";

export const log = {
    info: (...args: unknown[]) => console.log(PREFIX, ...args),
    warn: (...args: unknown[]) => console.warn(PREFIX, ...args),
    error: (...args: unknown[]) => console.error(PREFIX, ...args),
};
