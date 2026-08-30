import { accreditations, deployments, platformProfile } from "$lib/server/aaas";
import { listDomains } from "$lib/server/domains";
import { currentGrants } from "$lib/server/grants";
import { held } from "$lib/server/keys";
import type { PageServerLoad } from "./$types";

/**
 * Everything needed to decide, and to see the decision: the certified
 * platforms, the domains they were certified for, and what each has actually
 * been permitted to do.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const ename = locals.user!.ename;

	const [records, grants, domains, allDeployments] = await Promise.all([
		accreditations().catch(() => []),
		currentGrants(ename),
		listDomains().catch(() => []),
		deployments().catch(() => []),
	]);

	const granted = new Map<string, (typeof records)[number]>();
	for (const record of records) {
		if (record.decision !== "granted") continue;
		if (!granted.has(record.platformEName)) granted.set(record.platformEName, record);
	}

	const withKeys = new Set(held());

	const platforms = await Promise.all(
		[...granted.values()].map(async (record) => {
			const profile = await platformProfile(record.platformEName);
			const mine = allDeployments.filter(
				(deployment) => deployment.platformEname === record.platformEName,
			);
			return {
				ename: record.platformEName,
				name: profile?.displayName || record.platformName,
				level: record.level,
				version: record.platformVersion,
				certifiedDomains: record.domains ?? [],
				deployments: mine.map((deployment) => ({
					ename: deployment.deploymentEname,
					name: deployment.deploymentName,
					environment: deployment.environment,
					version: deployment.version,
					keyHeld: withKeys.has(deployment.deploymentEname),
				})),
				grants: (record.domains ?? []).map((domain) => {
					const grant = grants.find(
						(entry) =>
							entry.granteeEName === record.platformEName &&
							entry.resourceType === domain,
					);
					const active = grant && grant.status === "active";
					return {
						domain,
						label: domains.find((d) => d.id === domain)?.label ?? domain,
						read: Boolean(active && grant!.permissions.includes(`${domain}:Read`)),
						write: Boolean(active && grant!.permissions.includes(`${domain}:Write`)),
						revoked: Boolean(grant && grant.status === "revoked"),
						revision: grant?.revision ?? 0,
					};
				}),
			};
		}),
	);

	return { ename, platforms };
};
