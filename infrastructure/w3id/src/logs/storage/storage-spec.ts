/**
 * SPECIFICATION
 *
 * Baseline Storage Specification, used for storing and managing logs
 */

export declare class StorageSpec<T, K> {
	/**
	 * Build a new storage driver
	 *
	 * @param {...any[]} props
	 * @returns Promise<StorageSpec>
	 */

	// biome-ignore lint: lint/suspicious/noExplicitAny
	public static build<T, K>(...props: any[]): Promise<StorageSpec<T, K>>;

	/**
	 * Create a new entry in the storage
	 *
	 * @param body
	 * @returns Promise<K>
	 */

	public create(body: T): Promise<K>;

	/**
	 * Find one entry in the storage using partial of K
	 *
	 * @param {Partial<K>} options
	 * @returns Promise<K>
	 */

	public findOne(options: Partial<K>): Promise<K>;

	/**
	 * Find many entities in the storage using partial of K
	 *
	 * @param {Partial<K>} options
	 * @returns Promise<K[]>
	 */

	public findMany(options: Partial<K>): Promise<K[]>;
}
