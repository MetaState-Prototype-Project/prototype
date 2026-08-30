import { json } from "@sveltejs/kit";
import { resetWorld, world } from "$lib/server/world";
import type { RequestHandler } from "./$types";

/**
 * Breaks one link on purpose.
 *
 * A chain that only ever passes demonstrates nothing. Each of these edits is
 * something an attacker would plausibly try — presenting a key you do not
 * hold, widening your own authorisation, borrowing a better-certified
 * release's paperwork — and each should be caught by exactly one link.
 */
const EDITS: Record<
	string,
	{ label: string; expect: string; apply: (deployment: any, other: any, value: string) => void }
> = {
	publicKey: {
		label: "Present a different public key",
		expect: "possession",
		apply: (deployment, _other, value) => {
			deployment.identity.evidence.publicKey = value;
			deployment.identity.evidence.deploymentKeyDocument.data.publicKey = value;
		},
	},
	environment: {
		label: "Promote itself from staging to production",
		expect: "deployment-authorised",
		apply: (deployment, _other, value) => {
			deployment.identity.evidence.deploymentKeyDocument.data.environment =
				value || "production-plus";
		},
	},
	versionDocument: {
		label: "Borrow the other platform's version document",
		expect: "bundle-integrity",
		apply: (deployment, other) => {
			deployment.identity.evidence.softwareVersionDocument =
				structuredClone(other.identity.evidence.softwareVersionDocument);
		},
	},
	versionEname: {
		label: "Point at a different release",
		expect: "version-identity",
		apply: (deployment, _other, value) => {
			deployment.identity.evidence.versionEname =
				value || "@99999999-9999-4999-8999-999999999999";
		},
	},
	certificate: {
		label: "Borrow the other platform's certificate",
		expect: "accreditation",
		apply: (deployment, other) => {
			deployment.identity.evidence.accreditationJws =
				other.identity.evidence.accreditationJws;
		},
	},
};

export const POST: RequestHandler = async ({ request }) => {
	const { deploymentId, edit, value } = (await request.json()) as {
		deploymentId?: string;
		edit?: string;
		value?: string;
	};
	const current = await world();
	const deployment = current.deployments.get(String(deploymentId));
	if (!deployment) return json({ error: "Unknown deployment" }, { status: 404 });

	if (edit === "restore") {
		deployment.identity = structuredClone(deployment.pristine);
		deployment.tampered = null;
		return json({ tampered: null });
	}

	const change = EDITS[String(edit)];
	if (!change) return json({ error: "Unknown edit" }, { status: 400 });

	const other = [...current.deployments.values()].find(
		(entry) => entry.id !== deployment.id,
	);
	change.apply(deployment, other, String(value ?? ""));
	deployment.tampered = change.label;

	return json({ tampered: change.label, expect: change.expect });
};

export const DELETE: RequestHandler = async () => {
	await resetWorld();
	return json({ ok: true });
};
