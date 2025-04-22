import { LogEvent } from "../../src/logs/log.types";
import { StorageSpec } from "../../src/logs/storage/storage-spec.ts";

export class InMemoryStorage<T extends LogEvent, K extends LogEvent>
    implements StorageSpec<T, K>
{
    private data: K[] = [];

    public static build<T extends LogEvent, K extends LogEvent>(): StorageSpec<
        T,
        K
    > {
        return new InMemoryStorage<T, K>();
    }

    public async create(body: T): Promise<K> {
        const entry = body as unknown as K;
        this.data.push(entry);
        return entry;
    }

    public async findOne(options: Partial<K>): Promise<K> {
        const result = this.data.find((item) =>
            Object.entries(options).every(
                ([key, value]) => item[key as keyof K] === value,
            ),
        );

        if (!result) throw new Error("Not found");
        return result;
    }

    public async findMany(options: Partial<K>): Promise<K[]> {
        return this.data.filter((item) =>
            Object.entries(options).every(
                ([key, value]) => item[key as keyof K] === value,
            ),
        );
    }
}
