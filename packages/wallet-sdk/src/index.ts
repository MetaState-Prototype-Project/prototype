export type { CryptoAdapter } from "./crypto-adapter.js";
export { provision } from "./provision.js";
export type { ProvisionOptions, ProvisionResult } from "./provision.js";
export { authenticate } from "./auth.js";
export type { AuthenticateOptions, AuthenticateResult } from "./auth.js";
export { syncPublicKeyToEvault } from "./sync-public-key.js";
export type { SyncPublicKeyOptions } from "./sync-public-key.js";
export { signPayload } from "./sync-and-sign.js";
export type { SignPayloadOptions } from "./sync-and-sign.js";
export {
    syncPublicKeyToEvault as syncPublicKeyToEvaultWithOptions,
} from "./sync-and-sign.js";
export type { SyncPublicKeyToEvaultOptions } from "./sync-and-sign.js";
