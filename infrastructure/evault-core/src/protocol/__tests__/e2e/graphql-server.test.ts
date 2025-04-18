import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GraphQLServer } from "../../graphql-server";
import { DbService } from "../../../db/db.service";
import { createYoga } from "graphql-yoga";
import { W3ID } from "w3id";
import fetch from "node-fetch";

// Mock W3ID for testing
jest.mock("w3id", () => ({
  W3ID: {
    signJWT: jest.fn().mockResolvedValue("mock.jwt.token"),
    getJWTHeader: jest.fn().mockReturnValue({ kid: "user1#test" }),
  },
}));

describe("GraphQL Server E2E", () => {
  let server: any;
  let url: string;
  const testPort = 4001;

  // Create test data
  const testData = {
    "meta-1": {
      id: "meta-1",
      ontology: "test",
      acl: ["user1", "user2"],
      envelopes: [{ id: "env-1", ontology: "test", value: { data: "test1" } }],
      parsed: { test: "data1" },
    },
    "meta-2": {
      id: "meta-2",
      ontology: "test",
      acl: ["*"],
      envelopes: [{ id: "env-2", ontology: "test", value: { data: "test2" } }],
      parsed: { test: "data2" },
    },
    "meta-3": {
      id: "meta-3",
      ontology: "test",
      acl: ["user2"],
      envelopes: [{ id: "env-3", ontology: "test", value: { data: "test3" } }],
      parsed: { test: "data3" },
    },
  };

  // Mock DB Service
  class TestDbService implements Partial<DbService> {
    private data = testData;

    async findMetaEnvelopeById(id: string) {
      return this.data[id];
    }

    async findMetaEnvelopesByOntology() {
      return Object.values(this.data);
    }

    async findMetaEnvelopesBySearchTerm(ontology: string, term: string) {
      return Object.values(this.data).filter((e) => e.ontology === ontology);
    }

    async storeMetaEnvelope(input: any) {
      const id = `meta-${Object.keys(this.data).length + 1}`;
      this.data[id] = {
        id,
        ...input,
        envelopes: [],
        parsed: {},
      };
      return {
        metaEnvelope: this.data[id],
        envelopes: [],
      };
    }
  }

  beforeAll(async () => {
    const db = new TestDbService() as DbService;
    const graphqlServer = new GraphQLServer(db);
    server = createYoga({
      schema: graphqlServer["schema"],
      context: graphqlServer["createContext"],
    });

    url = `http://localhost:${testPort}/graphql`;
  });

  afterAll(() => {
    server.stop();
  });

  describe("Queries", () => {
    it("should return meta envelope when user has access", async () => {
      const query = `
                query {
                    getMetaEnvelopeById(id: "meta-1") {
                        id
                        ontology
                        parsed
                    }
                }
            `;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer user1.jwt.token",
        },
        body: JSON.stringify({ query }),
      });

      const result = await response.json();
      expect(result.data.getMetaEnvelopeById).toBeDefined();
      expect(result.data.getMetaEnvelopeById.id).toBe("meta-1");
      expect(result.data.getMetaEnvelopeById.acl).toBeUndefined();
    });

    it("should return null when user doesn't have access", async () => {
      const query = `
                query {
                    getMetaEnvelopeById(id: "meta-3") {
                        id
                        ontology
                        parsed
                    }
                }
            `;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer user1.jwt.token",
        },
        body: JSON.stringify({ query }),
      });

      const result = await response.json();
      expect(result.errors[0].message).toBe("Access denied");
    });

    it("should filter bulk query results based on ACL", async () => {
      const query = `
                query {
                    searchMetaEnvelopes(ontology: "test", term: "") {
                        id
                        ontology
                        parsed
                    }
                }
            `;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer user1.jwt.token",
        },
        body: JSON.stringify({ query }),
      });

      const result = await response.json();
      expect(result.data.searchMetaEnvelopes).toHaveLength(2);
      expect(
        result.data.searchMetaEnvelopes.find((e) => e.id === "meta-3")
      ).toBeUndefined();
    });
  });

  describe("Mutations", () => {
    it("should create meta envelope with ACL", async () => {
      const mutation = `
                mutation {
                    storeMetaEnvelope(input: {
                        ontology: "test",
                        payload: { test: "data" },
                        acl: ["user1"]
                    }) {
                        metaEnvelope {
                            id
                            ontology
                            parsed
                        }
                    }
                }
            `;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer user1.jwt.token",
        },
        body: JSON.stringify({ query: mutation }),
      });

      const result = await response.json();
      expect(result.data.storeMetaEnvelope.metaEnvelope).toBeDefined();
      expect(result.data.storeMetaEnvelope.metaEnvelope.acl).toBeUndefined();
    });

    it("should prevent updating envelope without access", async () => {
      const mutation = `
                mutation {
                    updateEnvelopeValue(
                        envelopeId: "meta-3",
                        newValue: { test: "updated" }
                    )
                }
            `;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer user1.jwt.token",
        },
        body: JSON.stringify({ query: mutation }),
      });

      const result = await response.json();
      expect(result.errors[0].message).toBe("Access denied");
    });
  });
});
