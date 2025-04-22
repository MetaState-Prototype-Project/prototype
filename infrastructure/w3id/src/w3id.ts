import { v4 as uuidv4 } from "uuid";
import { IDLogManager } from "./logs/log-manager";
import type { JWTHeader, JWTPayload, LogEvent, Signer } from "./logs/log.types";
import type { StorageSpec } from "./logs/storage/storage-spec";
import { signJWT } from "./utils/jwt";
import { generateRandomAlphaNum } from "./utils/rand";
import { generateUuid } from "./utils/uuid";

export class W3ID {
	constructor(
		public id: string,
		public logs?: IDLogManager,
	) {}

	/**
	 * Signs a JWT with the W3ID's signer
	 * @param payload - The JWT payload
	 * @param header - Optional JWT header (defaults to using the signer's alg and W3ID's id as kid)
	 * @returns The signed JWT
	 */
	public async signJWT(
		payload: JWTPayload,
		header?: JWTHeader,
	): Promise<string> {
		if (!this.logs?.signer) {
			throw new Error("W3ID must have a signer to sign JWTs");
		}
		return signJWT(this.logs.signer, payload, `@${this.id}#0`, header);
	}
}

export class W3IDBuilder {
	private signer?: Signer;
	private repository?: StorageSpec<LogEvent, LogEvent>;
	private entropy?: string;
	private namespace?: string;
	private nextKeyHash?: string;
	private global?: boolean = false;
	private id?: string;

	/**
	 * Specify entropy to create the identity with
	 *
	 * @param {string} str
	 */
	public withEntropy(str: string): W3IDBuilder {
		this.entropy = str;
		return this;
	}

	/**
	 * Specify namespace to use to generate the UUIDv5
	 *
	 * @param {string} uuid
	 */
	public withNamespace(uuid: string): W3IDBuilder {
		this.namespace = uuid;
		return this;
	}

	/**
	 * Specify whether to create a global identifier or a local identifer
	 *
	 * According to the project specification there are supposed to be 2 main types of
	 * W3ID's ones which are tied to more permanent entities
	 *
	 * A global identifer is expected to live at the registry and starts with an \`@\`
	 *
	 * @param {boolean} isGlobal
	 */
	public withGlobal(isGlobal: boolean): W3IDBuilder {
		this.global = isGlobal;
		return this;
	}

	/**
	 * Add a logs repository to the W3ID, a rotateble key attached W3ID would need a
	 * repository in which the logs would be stored
	 *
	 * @param {StorageSpec<LogEvent, LogEvent>} storage
	 */
	public withRepository(storage: StorageSpec<LogEvent, LogEvent>): W3IDBuilder {
		this.repository = storage;
		return this;
	}

	/**
	 * Pre-specify a UUID to use as the W3ID
	 *
	 * @param {string} id
	 */
	public withId(id: string): W3IDBuilder {
		this.id = id;
		return this;
	}

	/**
	 * Attach a keypair to the W3ID, a key attached W3ID would also need a repository
	 * to be added.
	 *
	 * @param {Signer} signer
	 */
	public withSigner(signer: Signer): W3IDBuilder {
		this.signer = signer;
		return this;
	}

	/**
	 * Specify the SHA256 hash of the next key which will sign the next log entry after
	 * rotation of keys
	 *
	 * @param {string} hash
	 */
	public withNextKeyHash(hash: string): W3IDBuilder {
		this.nextKeyHash = hash;
		return this;
	}

	/**
	 * Build the W3ID with provided builder options
	 *
	 * @returns Promise<W3ID>
	 */
	public async build(): Promise<W3ID> {
		if ((this.id && this.namespace) || (this.id && this.entropy))
			throw new Error(
				"Namespace and Entropy can't be specified when using pre-defined ID",
			);
		this.entropy = this.entropy ?? generateRandomAlphaNum();
		this.namespace = this.namespace ?? uuidv4();
		this.id = this.id?.includes("@") ? this.id.split("@")[1] : this.id;
		const id = `${
			this.global ? "@" : ""
		}${this.id?.toString() ?? generateUuid(this.entropy, this.namespace)}`;
		if (!this.signer) {
			return new W3ID(id);
		}
		if (!this.repository)
			throw new Error(
				"Repository is required, pass with `withRepository` method",
			);
		if (!this.nextKeyHash)
			throw new Error(
				"NextKeyHash is required pass with `withNextKeyHash` method",
			);
		const logs = new IDLogManager(this.repository, this.signer);

		const currentLogs = await logs.repository.findMany({});
		if (currentLogs.length > 0) return new W3ID(id, logs);
		await logs.createLogEvent({
			id,
			nextKeyHashes: [this.nextKeyHash],
		});
		return new W3ID(id, logs);
	}
}
