/** The shapes a deployment presents and a verifier resolves. */

export const CERTIFICATION_LEVELS = ["L0", "L1", "L2", "L3", "L4", "L5"] as const;
export type CertificationLevel = (typeof CERTIFICATION_LEVELS)[number];

export function levelRank(level: CertificationLevel): number {
	return CERTIFICATION_LEVELS.indexOf(level);
}

export interface BindingDocumentSignature {
	signer: string;
	signature: string;
	timestamp: string;
	scope?: "document" | "bundle";
	signedPayload?: string;
}

export interface BindingDocument {
	subject: string;
	type: string;
	data: Record<string, unknown>;
	signatures: BindingDocumentSignature[];
}

/** The release statement a platform signed when it applied to the association. */
export interface SubmissionStatement {
	type: string;
	schemaVersion: number;
	repositoryId: number;
	repository: string;
	platformEName: string;
	platformName: string;
	releaseTag: string;
	version: string;
	manifestCommitId: string;
	domains: string[];
	signerEName: string;
	issuedAt: string;
	nonce: string;
	[key: string]: unknown;
}

export interface SubmissionProof {
	statement: SubmissionStatement;
	payload: string;
	signature: string;
	publicKey: string;
	keyBindingCertificate: string;
	verifiedAt: string;
}

/** What a deployment sends. Everything here is public; none of it is a secret. */
export interface DeploymentEvidence {
	deploymentEname: string;
	deploymentName: string;
	environment: string;
	deployerEname: string;
	platformEname: string;
	versionEname: string;
	version: string;
	releaseTag: string;
	commitSha: string;
	/** The deployment's own public key — the half of the pair it proves possession of. */
	publicKey: string;
	deploymentKeyDocument: BindingDocument;
	softwareVersionDocument: BindingDocument;
	/** Compact ES256 JWS issued by the association over the certification decision. */
	accreditationJws: string;
	issuerJwksUri: string;
	submissionProof: SubmissionProof;
}

export interface HandshakeChallenge {
	nonce: string;
	audience: string;
	issuedAt: string;
	expiresAt: string;
}

export interface HandshakeResponse {
	challenge: HandshakeChallenge;
	evidence: DeploymentEvidence;
	/** Signature by the deployment key over the canonical challenge payload. */
	signature: string;
}

export type LinkId =
	| "possession"
	| "deployment-authorised"
	| "bundle-integrity"
	| "version-identity"
	| "release-authorship"
	| "accreditation";

export interface LinkResult {
	id: LinkId;
	title: string;
	/** What this link proves when it holds — shown to a human reading the trace. */
	proves: string;
	ok: boolean;
	detail: string;
}

export interface PlatformClaim {
	platformEname: string;
	platformName: string;
	deploymentEname: string;
	version: string;
	level: CertificationLevel;
	/** Domains the association certified, intersected with what the release asked for. */
	domains: string[];
	deployerEname: string;
	reviewedByEName: string;
}

export interface ChainResult {
	ok: boolean;
	links: LinkResult[];
	claim: PlatformClaim | null;
	/** Set when the chain fails: the first link that did not hold. */
	failedAt: LinkId | null;
}
