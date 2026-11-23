/** A Storage kept in memory, for code that runs without a browser's sessionStorage. */
export class MemoryStorage implements Storage {
    private valuesByKey = new Map<string, string>();

    get length() {
        return this.valuesByKey.size;
    }

    clear() {
        this.valuesByKey.clear();
    }

    getItem(key: string) {
        return this.valuesByKey.get(key) ?? null;
    }

    key(index: number) {
        return Array.from(this.valuesByKey.keys())[index] ?? null;
    }

    removeItem(key: string) {
        this.valuesByKey.delete(key);
    }

    setItem(key: string, value: string) {
        this.valuesByKey.set(key, String(value));
    }
}
