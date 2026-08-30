import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, url }) => ({
	user: locals.user,
	pathname: url.pathname,
});
