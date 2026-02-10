import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateToPlatform, parseAuthUri } from "../auth";
import { TestCryptoAdapter } from "./TestCryptoAdapter";

describe("parseAuthUri", () => {
  it("parses w3ds://auth URI", () => {
    const uri =
      "w3ds://auth?redirect=https%3A%2F%2Fplatform.test%2Fapi%2Fauth&session=sess-123&platform=myapp";
    const parsed = parseAuthUri(uri);
    expect(parsed.redirectUrl).toBe("https://platform.test/api/auth");
    expect(parsed.sessionId).toBe("sess-123");
    expect(parsed.platform).toBe("myapp");
  });

  it("throws on invalid URL", () => {
    expect(() => parseAuthUri("not-a-url")).toThrow("Invalid auth URI");
  });

  it("throws on wrong scheme", () => {
    expect(() => parseAuthUri("https://auth?redirect=x&session=y")).toThrow(
      "expected scheme w3ds://auth"
    );
  });

  it("throws when redirect missing", () => {
    expect(() =>
      parseAuthUri("w3ds://auth?session=s1&platform=p")
    ).toThrow("missing redirect");
  });

  it("throws when session missing", () => {
    expect(() =>
      parseAuthUri("w3ds://auth?redirect=https%3A%2F%2Fa.b%2Fc&platform=p")
    ).toThrow("missing session");
  });
});

describe("authenticateToPlatform", () => {
  const adapter = new TestCryptoAdapter();

  beforeEach(async () => {
    await adapter.generateKeyPair();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs ename, session, signature to redirect URL", async () => {
    const authUri =
      "w3ds://auth?redirect=https%3A%2F%2Fplatform.test%2Fapi%2Fauth&session=sess-456&platform=test";
    let capturedBody: Record<string, string> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url === "https://platform.test/api/auth") {
          capturedBody = init?.body ? JSON.parse(init.body as string) : {};
          return Promise.resolve(
            new Response(JSON.stringify({ token: "jwt-123" }), { status: 200 })
          );
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      })
    );

    const result = await authenticateToPlatform({
      cryptoAdapter: adapter,
      keyId: "test-key-1",
      w3id: "w3id-xyz",
      authUri,
    });

    expect(result.success).toBe(true);
    expect(result.token).toBe("jwt-123");
    expect(capturedBody.ename).toBe("w3id-xyz");
    expect(capturedBody.session).toBe("sess-456");
    expect(capturedBody.signature).toMatch(/^sig:test-key-1:/);
  });

  it("includes appVersion when provided", async () => {
    const authUri =
      "w3ds://auth?redirect=https%3A%2F%2Fp.test%2Fauth&session=s1&platform=p";
    let capturedBody: Record<string, string> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: string | URL, init?: RequestInit) => {
        capturedBody = init?.body ? JSON.parse(init.body as string) : {};
        return Promise.resolve(
          new Response(JSON.stringify({}), { status: 200 })
        );
      })
    );

    await authenticateToPlatform({
      cryptoAdapter: adapter,
      keyId: "test-key-1",
      w3id: "w3id",
      authUri,
      appVersion: "1.0.0",
    });

    expect(capturedBody.appVersion).toBe("1.0.0");
  });

  it("throws when platform returns error", async () => {
    const authUri =
      "w3ds://auth?redirect=https%3A%2F%2Fp.test%2Fauth&session=s1&platform=p";
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: "Invalid session" }),
            { status: 400 }
          )
        )
      )
    );

    await expect(
      authenticateToPlatform({
        cryptoAdapter: adapter,
        keyId: "test-key-1",
        w3id: "w3id",
        authUri,
      })
    ).rejects.toThrow(/Platform auth failed/);
  });
});
