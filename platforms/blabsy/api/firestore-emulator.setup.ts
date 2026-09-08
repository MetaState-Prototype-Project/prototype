import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";

/**
 * Starts a Firestore emulator for the acceptance suite and stops it after.
 *
 * The emulator, rather than a stubbed Firestore, is the point: the reference
 * handling under test ends in a document write, and whether a room survives
 * ingest is only answerable by reading the document back. A fake would answer
 * from whatever the fake was told.
 *
 * Requires a JRE, which the emulator itself needs. When one is missing the
 * suite skips rather than failing, and says so, so a machine without Java does
 * not look like a broken change.
 */

let emulator: ChildProcess | undefined;

const PORT = Number(process.env.FIRESTORE_TEST_PORT ?? 8710);
const PROJECT = "blabsy-test";

function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;

	return new Promise((resolve) => {
		const attempt = () => {
			const socket = net.connect({ port, host: "127.0.0.1" }, () => {
				socket.end();
				resolve(true);
			});
			socket.on("error", () => {
				socket.destroy();
				if (Date.now() > deadline) resolve(false);
				else setTimeout(attempt, 500);
			});
		};
		attempt();
	});
}

export async function setup(): Promise<void> {
	emulator = spawn(
		"npx",
		[
			"-y",
			"firebase-tools@13",
			"emulators:start",
			"--only",
			"firestore",
			"--project",
			PROJECT,
			"--config",
			`${__dirname}/firebase.emulator.json`,
		],
		{ stdio: "ignore", detached: true },
	);

	const ready = await waitForPort(PORT, 180_000);
	if (!ready) {
		await teardown();
		throw new Error(
			`Firestore emulator did not start on port ${PORT}. It needs a JRE on PATH.`,
		);
	}

	process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${PORT}`;
	process.env.GOOGLE_CLOUD_PROJECT = PROJECT;
}

export async function teardown(): Promise<void> {
	if (!emulator?.pid) return;
	try {
		// The emulator spawns a Java child, so the whole group goes.
		process.kill(-emulator.pid, "SIGTERM");
	} catch {
		// Already gone.
	}
	emulator = undefined;
}
