export type { CryptoAdapter } from "./crypto-adapter";
export {
  provision,
  type ProvisionOptions,
  type ProvisionResult,
} from "./provision";
export {
  parseAuthUri,
  authenticateToPlatform,
  type ParsedAuthUri,
  type AuthenticateToPlatformOptions,
  type AuthenticateToPlatformResult,
} from "./auth";
export {
  syncPublicKeyToEvault,
  signPayload,
  type SyncPublicKeyToEvaultOptions,
  type SignPayloadOptions,
} from "./sync-and-sign";
