import { resolveENameRef, resolveENameRefs } from "web3-adapter";
import type { User } from "../database/entities/User";
import type { UserService } from "../services/UserService";

/**
 * Pictique's binding of the shared entity-reference resolver to its own user
 * lookup. Chat participants, admins, and a message's sender are all named by
 * eName; see `web3-adapter`'s `entity-refs` for what happens to references that
 * cannot be resolved.
 */

export async function resolveParticipants(
	refs: unknown,
	userService: UserService,
	context: string,
): Promise<User[]> {
	return resolveENameRefs(refs, (ename) => userService.findByEname(ename), {
		context,
	});
}

export async function resolveEntityRef(
	ref: unknown,
	userService: UserService,
	context: string,
): Promise<User | null> {
	return resolveENameRef(ref, (ename) => userService.findByEname(ename), {
		context,
	});
}
