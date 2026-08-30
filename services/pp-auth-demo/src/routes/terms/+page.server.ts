import { listDomains } from "$lib/server/domains";
import { currentPolicy } from "$lib/server/policy";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const ename = locals.user!.ename;
	const [policy, domains] = await Promise.all([
		currentPolicy(ename),
		listDomains().catch(() => []),
	]);
	return { ename, policy, domains };
};
