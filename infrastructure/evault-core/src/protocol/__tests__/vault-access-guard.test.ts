import { describe, it, expect, vi, beforeEach } from "vitest";
import { VaultAccessGuard, VaultContext } from "../vault-access-guard";
import { DbService } from "../../db/db.service";
import type { MetaEnvelope } from "../../db/types";

// Mock DB Service
class MockDbService {
  private metaEnvelopes: Record<string, MetaEnvelope> = {
    "test-1": {
      id: "test-1",
      ontology: "test",
      acl: ["user1", "user2"],
      envelopes: [],
      parsed: {},
    },
    "test-2": {
      id: "test-2",
      ontology: "test",
      acl: ["*"],
      envelopes: [],
      parsed: {},
    },
    "test-3": {
      id: "test-3",
      ontology: "test",
      acl: ["user2"],
      envelopes: [],
      parsed: {},
    },
  };

  async findMetaEnvelopeById(id: string): Promise<MetaEnvelope | null> {
    return this.metaEnvelopes[id] || null;
  }

  async findMetaEnvelopesByOntology(ontology: string): Promise<string[]> {
    return Object.values(this.metaEnvelopes)
      .filter((e) => e.ontology === ontology)
      .map((e) => e.id);
  }
}

describe("VaultAccessGuard", () => {
  let guard: VaultAccessGuard;
  let mockDb: MockDbService;

  beforeEach(() => {
    mockDb = new MockDbService();
    guard = new VaultAccessGuard(mockDb as unknown as DbService);
  });

  describe("Single Entity Access", () => {
    it("should allow access when user is in ACL", async () => {
      const context: VaultContext = {
        currentUser: "user1",
      } as VaultContext;

      const resolver = vi
        .fn()
        .mockResolvedValue({ id: "test-1", data: "test" });
      const wrapped = guard.middleware(resolver);

      const result = await wrapped(null, { id: "test-1" }, context);
      expect(result).toBeDefined();
      expect(resolver).toHaveBeenCalled();
    });

    it("should allow access when ACL contains wildcard", async () => {
      const context: VaultContext = {
        currentUser: "user3",
      } as VaultContext;

      const resolver = vi
        .fn()
        .mockResolvedValue({ id: "test-2", data: "test" });
      const wrapped = guard.middleware(resolver);

      const result = await wrapped(null, { id: "test-2" }, context);
      expect(result).toBeDefined();
      expect(resolver).toHaveBeenCalled();
    });

    it("should deny access when user is not in ACL", async () => {
      const context: VaultContext = {
        currentUser: "user1",
      } as VaultContext;

      const resolver = vi
        .fn()
        .mockResolvedValue({ id: "test-3", data: "test" });
      const wrapped = guard.middleware(resolver);

      await expect(wrapped(null, { id: "test-3" }, context)).rejects.toThrow(
        "Access denied"
      );
      expect(resolver).not.toHaveBeenCalled();
    });

    it("should deny access when user is not authenticated", async () => {
      const context: VaultContext = {
        currentUser: null,
      } as VaultContext;

      const resolver = vi
        .fn()
        .mockResolvedValue({ id: "test-1", data: "test" });
      const wrapped = guard.middleware(resolver);

      await expect(wrapped(null, { id: "test-1" }, context)).rejects.toThrow(
        "Access denied"
      );
      expect(resolver).not.toHaveBeenCalled();
    });
  });

  describe("Bulk Query Access", () => {
    it("should filter results based on ACL", async () => {
      const context: VaultContext = {
        currentUser: "user1",
      } as VaultContext;

      const resolver = vi.fn().mockResolvedValue([
        { id: "test-1", data: "test1" },
        { id: "test-2", data: "test2" },
        { id: "test-3", data: "test3" },
      ]);

      const wrapped = guard.middleware(resolver);
      const result = await wrapped(null, {}, context);

      expect(result).toHaveLength(2); // Should only see test-1 and test-2 (in ACL + wildcard)
      expect(
        result.find((r: { id: string }) => r.id === "test-3")
      ).toBeUndefined();
      expect(resolver).toHaveBeenCalled();
    });

    it("should return empty array for unauthenticated user in bulk query", async () => {
      const context: VaultContext = {
        currentUser: null,
      } as VaultContext;

      const resolver = vi.fn().mockResolvedValue([
        { id: "test-1", data: "test" },
        { id: "test-2", data: "test" },
      ]);

      const wrapped = guard.middleware(resolver);
      const result = await wrapped(null, {}, context);

      expect(result).toHaveLength(0);
      expect(resolver).toHaveBeenCalled();
    });
  });

  describe("ACL Filtering", () => {
    it("should remove ACL from single result", async () => {
      const context: VaultContext = {
        currentUser: "user1",
      } as VaultContext;

      const resolver = vi.fn().mockResolvedValue({
        id: "test-1",
        acl: ["user1"],
        data: "test",
      });

      const wrapped = guard.middleware(resolver);
      const result = await wrapped(null, { id: "test-1" }, context);

      expect(result.acl).toBeUndefined();
      expect(result.data).toBe("test");
    });

    it("should remove ACL from bulk results", async () => {
      const context: VaultContext = {
        currentUser: "user1",
      } as VaultContext;

      const resolver = vi.fn().mockResolvedValue([
        { id: "test-1", acl: ["user1"], data: "test1" },
        { id: "test-2", acl: ["*"], data: "test2" },
      ]);

      const wrapped = guard.middleware(resolver);
      const result = await wrapped(null, {}, context);

      result.forEach((item: { acl?: string[]; data: string }) => {
        expect(item.acl).toBeUndefined();
        expect(item.data).toBeDefined();
      });
    });
  });
});
