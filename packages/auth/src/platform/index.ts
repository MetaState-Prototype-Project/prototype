export {
	bindingDocumentHash,
	canonicalSubmissionStatement,
	decodeBase58,
	decodePublicKey,
	derSignatureToRaw,
	encodeBase58,
	labelledSignatureCandidates,
	sha256Base64Url,
	signatureCandidates,
	stableStringify,
} from "./bytes.js";
export type { SignatureCandidate, SignatureEncoding } from "./bytes.js";
export {
	generateKeyPair,
	signP256,
	verifyP256,
	verifyP256Detailed,
} from "./p256.js";
export type { P256KeyPair, P256Verification } from "./p256.js";
export {
	challengePayload,
	DEFAULT_TRUSTED_PPA_ISSUERS,
	normalizePpaIssuers,
	ppaJwksUri,
	softwareVersionEName,
	verifyDeploymentChain,
} from "./chain.js";
export type { ChainOptions, WalletVerifier } from "./chain.js";
export { createChallengeStore, verifyHandshake } from "./handshake.js";
export type { ChallengeStore, HandshakeOptions } from "./handshake.js";
export { answerChallenge, authenticate } from "./deployment.js";
export type { DeploymentIdentity } from "./deployment.js";
export {
	accessPolicyPayload,
	defaultAccessPolicy,
	parseAccessPolicy,
	POLICY_TYPE,
	verifyAccessPolicy,
} from "./policy.js";
export type { AccessPolicyStatement, SignedAccessPolicy } from "./policy.js";
export { authorize, permittedDomains } from "./authorize.js";
export { evaluateGrants, permissionFor } from "./grants.js";
export type { AccessGrant, GrantMatch, Operation } from "./grants.js";
export type {
	AuthorizationDecision,
	AuthorizationRequest,
	DenialCode,
	ReputationReading,
} from "./authorize.js";
export {
	CERTIFICATION_LEVELS,
	levelRank,
} from "./types.js";
export type {
	BindingDocument,
	BindingDocumentSignature,
	CertificationLevel,
	ChainResult,
	DeploymentEvidence,
	HandshakeChallenge,
	HandshakeResponse,
	LinkId,
	LinkResult,
	PlatformClaim,
	SubmissionProof,
	SubmissionStatement,
} from "./types.js";
