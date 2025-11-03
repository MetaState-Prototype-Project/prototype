export interface StorageSpec<T = any, U = any> {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  create(data: T): Promise<U>;
  findOne(query: Partial<T>): Promise<U | null>;
  findMany(query: Partial<T>): Promise<U[]>;
}

export interface Signer {
  sign(message: string): Promise<string>;
  pubKey: string;
  alg: string;
}
