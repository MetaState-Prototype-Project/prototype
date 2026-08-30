/**
 * Deployment private keys the operator has supplied, held in memory only.
 *
 * A deployment's private key is the whole of the possession proof, so this app
 * never writes one to disk, never logs it, and forgets all of them on restart.
 * It accepts one at all because the person running this demonstration is, for
 * these deployments, the deployer — supplying the key is how they prove the
 * possession link rather than watch it fail.
 */

const STORE = Symbol.for("pp-auth-demo.deploymentKeys");
const store = globalThis as typeof globalThis & { [STORE]?: Map<string, string> };
const keys: Map<string, string> = (store[STORE] ??= new Map());

export function remember(deploymentEname: string, privateKey: string): void {
	keys.set(deploymentEname, privateKey.trim());
}

export function forget(deploymentEname: string): void {
	keys.delete(deploymentEname);
}

export function keyFor(deploymentEname: string): string | null {
	return keys.get(deploymentEname) ?? null;
}

export function held(): string[] {
	return [...keys.keys()];
}
