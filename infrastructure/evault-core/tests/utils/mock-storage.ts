import { StorageSpec } from "../../src/types/w3id";

export class MockStorage<T = any, U = any> implements StorageSpec<T, U> {
    private store: Map<string, string> = new Map();
    private dataStore: Map<string, T> = new Map();

    async get(key: string): Promise<string | null> {
        return this.store.get(key) ?? null;
    }

    async set(key: string, value: string): Promise<void> {
        this.store.set(key, value);
    }

    async delete(key: string): Promise<void> {
        this.store.delete(key);
    }

    async list(prefix: string): Promise<string[]> {
        return Array.from(this.store.keys()).filter((key) =>
            key.startsWith(prefix),
        );
    }

    async create(data: T): Promise<U> {
        const id = Math.random().toString(36).substring(7);
        this.dataStore.set(id, data);
        return data as unknown as U;
    }

    async findOne(query: Partial<T>): Promise<U | null> {
        for (const [_, data] of this.dataStore) {
            if (this.matchesQuery(data, query)) {
                return data as unknown as U;
            }
        }
        return null;
    }

    async findMany(query: Partial<T>): Promise<U[]> {
        const results: U[] = [];
        for (const [_, data] of this.dataStore) {
            if (this.matchesQuery(data, query)) {
                results.push(data as unknown as U);
            }
        }
        return results;
    }

    private matchesQuery(data: T, query: Partial<T>): boolean {
        return Object.entries(query).every(([key, value]) => {
            return (data as any)[key] === value;
        });
    }

    clear(): void {
        this.store.clear();
        this.dataStore.clear();
    }
}
