import canonicalize from "canonicalize";
import {
	BadNextKeySpecifiedError,
	BadOptionsSpecifiedError,
	BadSignatureError,
	MalformedHashChainError,
	MalformedIndexChainError,
} from "../errors/errors";
import { isSubsetOf } from "../utils/array";
import { hash } from "../utils/hash";
import {
	type CreateLogEventOptions,
	type GenesisLogOptions,
	type LogEvent,
	type RotationLogOptions,
	type Signer,
	type VerifierCallback,
	isGenesisOptions,
	isRotationOptions,
} from "./log.types";
import type { StorageSpec } from "./storage/storage-spec";

/**
 * Class to generate historic event logs for all historic events for an Identifier
 * starting with generating it's first log entry
 */

// TODO: Create a specification link inside our docs for how generation of identifier works

export class IDLogManager {
	repository: StorageSpec<LogEvent, LogEvent>;
	signer: Signer;

	constructor(repository: StorageSpec<LogEvent, LogEvent>, signer: Signer) {
		this.repository = repository;
		this.signer = signer;
	}

	/**
	 * Validate a chain of W3ID logs
	 *
	 * @param {LogEvent[]} log
	 * @param {VerifierCallback} verifyCallback
	 * @returns {Promise<true>}
	 */

	static async validateLogChain(
		log: LogEvent[],
		verifyCallback: VerifierCallback,
	): Promise<true> {
		let currIndex = 0;
		let currentNextKeyHashesSeen: string[] = [];
		let lastUpdateKeysSeen: string[] = [];
		let lastHash: string | null = null;

		for (const e of log) {
			const [_index, _hash] = e.versionId.split("-");
			const index = Number(_index);
			if (currIndex !== index) throw new MalformedIndexChainError();
			const hashedUpdateKeys = await Promise.all(
				e.updateKeys.map(async (k) => await hash(k)),
			);
			if (index > 0) {
				const updateKeysSeen = isSubsetOf(
					hashedUpdateKeys,
					currentNextKeyHashesSeen,
				);
				if (!updateKeysSeen || lastHash !== _hash)
					throw new MalformedHashChainError();
			}

			currentNextKeyHashesSeen = e.nextKeyHashes;
			await IDLogManager.verifyLogEventProof(
				e,
				lastUpdateKeysSeen.length > 0 ? lastUpdateKeysSeen : e.updateKeys,
				verifyCallback,
			);
			lastUpdateKeysSeen = e.updateKeys;
			currIndex++;
			lastHash = await hash(canonicalize(e) as string);
		}
		return true;
	}

	/**
	 * Validate cryptographic signature on a single LogEvent
	 *
	 * @param {LogEvent} e
	 * @param {string[]} currentUpdateKeys
	 * @param {VerifierCallback} verifyCallback
	 * @returns {Promise<void>}
	 */
	private static async verifyLogEventProof(
		e: LogEvent,
		currentUpdateKeys: string[],
		verifyCallback: VerifierCallback,
	): Promise<void> {
		const proofs = e.proofs;
		const copy = JSON.parse(JSON.stringify(e));
		// biome-ignore lint/performance/noDelete: we need to delete proof completely
		delete copy.proofs;
		const canonicalJson = canonicalize(copy);
		let verified = false;
		if (!proofs)
			throw new BadSignatureError("No proof found in the log event.");
		for (const key of currentUpdateKeys) {
			const signValidates = await verifyCallback(
				canonicalJson as string,
				proofs,
				key,
			);
			if (signValidates) verified = true;
		}
		if (!verified) throw new BadSignatureError();
	}

	/**
	 * Append a new log entry for a W3ID
	 *
	 * @param {LogEvent[]} entries
	 * @param {RotationLogOptions} options
	 * @returns Promise<LogEvent>
	 */
	private async appendEntry(entries: LogEvent[], options: RotationLogOptions) {
		const { nextKeyHashes, nextKeySigner } = options;
		const latestEntry = entries[entries.length - 1];
		const logHash = await hash(latestEntry);
		const index = Number(latestEntry.versionId.split("-")[0]) + 1;

		const currKeyHash = await hash(nextKeySigner.pubKey);
		if (!latestEntry.nextKeyHashes.includes(currKeyHash))
			throw new BadNextKeySpecifiedError();

		const logEvent: LogEvent = {
			id: latestEntry.id,
			versionTime: new Date(Date.now()),
			versionId: `${index}-${logHash}`,
			updateKeys: [nextKeySigner.pubKey],
			nextKeyHashes: nextKeyHashes,
			method: "w3id:v0.0.0",
		};

		const signature = await this.signer.sign(canonicalize(logEvent) as string);
		logEvent.proofs = [
			{
				kid: `${logEvent.id}#0`,
				alg: this.signer.alg,
				signature,
			},
		];

		await this.repository.create(logEvent);
		this.signer = nextKeySigner;
		return logEvent;
	}

	/**
	 * Create genesis entry for a W3ID log
	 *
	 * @param {GenesisLogOptions} options
	 * @returns Promise<LogEvent>
	 */
	private async createGenesisEntry(options: GenesisLogOptions) {
		const { id, nextKeyHashes } = options;
		const idTag = id.includes("@") ? id.split("@")[1] : id;
		const logEvent: LogEvent = {
			id,
			versionId: `0-${idTag}`,
			versionTime: new Date(Date.now()),
			updateKeys: [this.signer.pubKey],
			nextKeyHashes: nextKeyHashes,
			method: "w3id:v0.0.0",
		};
		const signature = await this.signer.sign(canonicalize(logEvent) as string);
		logEvent.proofs = [
			{
				kid: `${id}#0`,
				alg: this.signer.alg,
				signature,
			},
		];

		await this.repository.create(logEvent);
		return logEvent;
	}

	/**
	 * Create a log event and save it to the repository
	 *
	 * @param {CreateLogEventOptions} options
	 * @returns Promise<LogEvent>
	 */
	async createLogEvent(options: CreateLogEventOptions): Promise<LogEvent> {
		const entries = await this.repository.findMany({});
		if (entries.length > 0) {
			if (!isRotationOptions(options)) throw new BadOptionsSpecifiedError();
			return this.appendEntry(entries, options);
		}
		if (!isGenesisOptions(options)) throw new BadOptionsSpecifiedError();
		return this.createGenesisEntry(options);
	}
}
