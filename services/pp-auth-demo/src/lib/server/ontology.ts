/** Ontology ids this app reads, and the vocabulary they belong to. */

export const USER_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";
export const PLATFORM_ACCREDITATION_ONTOLOGY = "e1749947-5a10-4973-b9fa-230d8714c36a";
export const DEPLOYMENT_PROFILE_ONTOLOGY = "d38e0c5b-9d63-4a21-8e8b-1d6b63af64d2";
export const ACCESS_POLICY_ONTOLOGY = "c7a41f6d-95b8-4e2a-9c33-8f0d1b6e4a72";
export const ACCESS_GRANT_ONTOLOGY = "15d24c04-a4f3-4e45-a00e-0123926fbc87";

export interface AccreditationRecord {
	accreditationId: string;
	platformEName: string;
	platformName: string;
	platformVersion: string;
	decision: "granted" | "denied";
	level: string | null;
	domains: string[];
	statement: string;
	reviewedByEName: string;
	issuerJwksUri: string;
	jws: string;
	createdAt: string;
}

export interface DeploymentRecord {
	deploymentEname: string;
	deploymentName: string;
	environment: string;
	deployerEname: string;
	platformEname: string;
	versionEname: string;
	version: string;
	releaseTag: string;
	commitSha: string;
	publicKey: string;
	createdAt: string;
}
