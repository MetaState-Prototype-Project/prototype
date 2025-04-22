import { describe, it, expect, beforeAll, afterAll } from "vitest";
import neo4j, { Driver } from "neo4j-driver";
import { Neo4jContainer } from "@testcontainers/neo4j";
import { Neo4jLogStorage } from "../src/w3id/log-storage";
import { LogEvent } from "w3id";

describe("Neo4jLogStorage", () => {
  let container;
  let driver: Driver;
  let storage: Neo4jLogStorage;

  beforeAll(async () => {
    container = await new Neo4jContainer("neo4j:5.15").start();
    const uri = `bolt://localhost:${container.getMappedPort(7687)}`;
    driver = neo4j.driver(
      uri,
      neo4j.auth.basic(container.getUsername(), container.getPassword())
    );
    storage = new Neo4jLogStorage(driver);
  });

  afterAll(async () => {
    await driver.close();
    await container.stop();
  });

  it("should create and retrieve a log event", async () => {
    const logEvent: LogEvent = {
      id: "test-id",
      versionId: "0-test",
      versionTime: new Date(),
      updateKeys: ["key1", "key2"],
      nextKeyHashes: ["hash1", "hash2"],
      method: "w3id:v0.0.0",
    };

    const created = await storage.create(logEvent);
    expect(created.id).toBe(logEvent.id);
    expect(created.versionId).toBe(logEvent.versionId);
    expect(created.updateKeys).toEqual(logEvent.updateKeys);
    expect(created.nextKeyHashes).toEqual(logEvent.nextKeyHashes);
    expect(created.method).toBe(logEvent.method);

    const retrieved = await storage.findOne({ id: logEvent.id });
    expect(retrieved.id).toBe(logEvent.id);
    expect(retrieved.versionId).toBe(logEvent.versionId);
    expect(retrieved.updateKeys).toEqual(logEvent.updateKeys);
    expect(retrieved.nextKeyHashes).toEqual(logEvent.nextKeyHashes);
    expect(retrieved.method).toBe(logEvent.method);
  });

  it("should find multiple log events", async () => {
    const logEvent1: LogEvent = {
      id: "test-id-1",
      versionId: "0-test-1",
      versionTime: new Date(),
      updateKeys: ["key1"],
      nextKeyHashes: ["hash1"],
      method: "w3id:v0.0.0",
    };

    const logEvent2: LogEvent = {
      id: "test-id-2",
      versionId: "0-test-2",
      versionTime: new Date(),
      updateKeys: ["key2"],
      nextKeyHashes: ["hash2"],
      method: "w3id:v0.0.0",
    };

    await storage.create(logEvent1);
    await storage.create(logEvent2);

    const events = await storage.findMany({ method: "w3id:v0.0.0" });
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.some((e) => e.id === logEvent1.id)).toBe(true);
    expect(events.some((e) => e.id === logEvent2.id)).toBe(true);
  });

  it("should throw error when log event not found", async () => {
    await expect(storage.findOne({ id: "non-existent-id" })).rejects.toThrow(
      "No log event found with id non-existent-id"
    );
  });
});
