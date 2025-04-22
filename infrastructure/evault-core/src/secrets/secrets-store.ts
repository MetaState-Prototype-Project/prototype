import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  pbkdf2Sync,
} from "crypto";
import fs from "fs/promises";
import path from "path";
import { hexToUint8Array, uint8ArrayToHex } from "../utils/codec";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;

interface StoredSeed {
  encrypted: string;
  iv: string;
  salt: string;
  nextKeyHash: string;
}

export class SecretsStore {
  private storePath: string;
  private password: string;

  constructor(storePath: string, password: string) {
    this.storePath = storePath;
    this.password = password;
  }

  private deriveKey(salt: Buffer): Buffer {
    return pbkdf2Sync(this.password, salt, ITERATIONS, KEY_LENGTH, "sha256");
  }

  private async ensureStoreExists(): Promise<void> {
    try {
      await fs.access(this.storePath);
    } catch {
      await fs.mkdir(path.dirname(this.storePath), { recursive: true });
      await fs.writeFile(this.storePath, JSON.stringify({}));
    }
  }

  private async readStore(): Promise<Record<string, string>> {
    await this.ensureStoreExists();
    const content = await fs.readFile(this.storePath, "utf-8");
    return JSON.parse(content);
  }

  private async writeStore(store: Record<string, string>): Promise<void> {
    await fs.writeFile(this.storePath, JSON.stringify(store, null, 2));
  }

  private encrypt(data: Buffer): {
    encrypted: string;
    iv: string;
    salt: string;
  } {
    const iv = randomBytes(IV_LENGTH);
    const salt = randomBytes(SALT_LENGTH);
    const key = this.deriveKey(salt);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
    return {
      encrypted: uint8ArrayToHex(encrypted),
      iv: uint8ArrayToHex(iv),
      salt: uint8ArrayToHex(salt),
    };
  }

  private decrypt(encrypted: string, iv: string, salt: string): Buffer {
    const key = this.deriveKey(Buffer.from(hexToUint8Array(salt)));
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(hexToUint8Array(iv))
    );
    const encryptedBuffer = Buffer.from(hexToUint8Array(encrypted));
    const tag = encryptedBuffer.slice(-TAG_LENGTH);
    const data = encryptedBuffer.slice(0, -TAG_LENGTH);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  public async storeSeed(
    keyId: string,
    seed: Uint8Array,
    nextKeyHash: string
  ): Promise<void> {
    const store = await this.readStore();
    const { encrypted, iv, salt } = this.encrypt(Buffer.from(seed));
    const storedSeed: StoredSeed = { encrypted, iv, salt, nextKeyHash };
    store[keyId] = JSON.stringify(storedSeed);
    await this.writeStore(store);
  }

  public async getSeed(
    keyId: string
  ): Promise<{ seed: Uint8Array; nextKeyHash: string }> {
    const store = await this.readStore();
    const data: StoredSeed = JSON.parse(store[keyId]);
    if (!data) throw new Error(`No seed found for key ${keyId}`);
    return {
      seed: this.decrypt(data.encrypted, data.iv, data.salt),
      nextKeyHash: data.nextKeyHash,
    };
  }

  public async deleteSeed(keyId: string): Promise<void> {
    const store = await this.readStore();
    delete store[keyId];
    await this.writeStore(store);
  }

  public async listSeeds(): Promise<string[]> {
    const store = await this.readStore();
    return Object.keys(store);
  }
}
