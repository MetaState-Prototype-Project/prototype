export { signToken, verifyToken } from "./jwt.js";
export { createAuthMiddleware } from "./middleware.js";
export { createAuthGuard } from "./guard.js";
export { buildAuthOffer } from "./auth-offer.js";
export type { AuthOffer } from "./auth-offer.js";
export { verifyLoginSignature } from "./verify-login.js";
export type {
	AuthUser,
	JwtPayload,
	AuthMiddlewareConfig,
	AuthOfferConfig,
	LoginVerificationConfig,
	LoginVerificationResult,
} from "./types.js";
export {
	clearJwksCache,
	normalizeEName,
	verifyEnameSignature,
} from "./ename-signature.js";
export type {
	EnameKeyType,
	EnameVerificationError,
	VerifyEnameSignatureOptions,
	VerifyEnameSignatureResult,
} from "./ename-signature.js";
