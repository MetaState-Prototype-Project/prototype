import {
	EventSubscriber,
	EntitySubscriberInterface,
	InsertEvent,
	UpdateEvent,
	RemoveEvent,
} from "typeorm";
import { Web3Adapter } from "web3-adapter";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../../../../.env") });

export const adapter = new Web3Adapter({
	schemasPath: path.resolve(__dirname, "../mappings/"),
	dbPath: path.resolve(
		process.env.PROFILE_EDITOR_MAPPING_DB_PATH as string,
	),
	registryUrl: process.env.PUBLIC_REGISTRY_URL as string,
	platform: process.env.PUBLIC_PROFILE_EDITOR_BASE_URL as string,
});

@EventSubscriber()
export class PostgresSubscriber implements EntitySubscriberInterface {
	private adapter: Web3Adapter;
	private pendingChanges: Map<string, number> = new Map();

	constructor() {
		this.adapter = adapter;

		setInterval(() => {
			const now = Date.now();
			const maxAge = 10 * 60 * 1000;
			for (const [key, timestamp] of this.pendingChanges.entries()) {
				if (now - timestamp > maxAge) {
					this.pendingChanges.delete(key);
				}
			}
		}, 5 * 60 * 1000);
	}

	async afterInsert(event: InsertEvent<any>) {
		const entity = event.entity;
		if (!entity) return;
		const tableName = event.metadata.tableName.endsWith("s")
			? event.metadata.tableName
			: event.metadata.tableName + "s";
		await this.handleChange(this.entityToPlain(entity), tableName);
	}

	async afterUpdate(event: UpdateEvent<any>) {
		const entity = event.entity;
		if (!entity) return;
		await this.handleChange(
			this.entityToPlain(entity),
			event.metadata.tableName,
		);
	}

	async afterRemove(event: RemoveEvent<any>) {
		const entity = event.entity;
		if (!entity) return;
		await this.handleChange(
			this.entityToPlain(entity),
			event.metadata.tableName,
		);
	}

	private async handleChange(data: any, tableName: string): Promise<void> {
		if (tableName === "sessions" || tableName === "users") return;
		if (!data.id) return;
		console.log(`[subscriber] change detected: table=${tableName} id=${data.id} keys=[${Object.keys(data).join(",")}]`);

		const changeKey = `${tableName}:${data.id}`;
		if (this.pendingChanges.has(changeKey)) return;
		this.pendingChanges.set(changeKey, Date.now());

		try {
			setTimeout(async () => {
				try {
					let globalId =
						await this.adapter.mappingDb.getGlobalId(data.id);
					globalId = globalId ?? "";

					if (this.adapter.lockedIds.includes(globalId)) {
						return;
					}

					await this.adapter.handleChange({
						data,
						tableName: tableName.toLowerCase(),
					});
				} finally {
					this.pendingChanges.delete(changeKey);
				}
			}, 3_000);
		} catch (error) {
			console.error(
				`Error processing change for ${tableName}:`,
				error,
			);
			this.pendingChanges.delete(changeKey);
		}
	}

	private entityToPlain(entity: any): any {
		if (!entity || typeof entity !== "object") return entity;
		if (entity instanceof Date) return entity.toISOString();
		if (Array.isArray(entity))
			return entity.map((item) => this.entityToPlain(item));

		const plain: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(entity)) {
			if (key.startsWith("_")) continue;

			if (value && typeof value === "object") {
				if (Array.isArray(value)) {
					plain[key] = value.map((item) =>
						this.entityToPlain(item),
					);
				} else if (value instanceof Date) {
					plain[key] = value.toISOString();
				} else {
					plain[key] = this.entityToPlain(value);
				}
			} else {
				plain[key] = value;
			}
		}
		return plain;
	}
}
