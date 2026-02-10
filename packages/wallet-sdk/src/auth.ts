import type { CryptoAdapter } from "./crypto-adapter";

/** Parsed w3ds://auth URI parameters. */
export interface ParsedAuthUri {
  /** URL to POST the signed session to (redirect/callback). */
  redirectUrl: string;
  /** Session ID to sign. */
  sessionId: string;
  /** Platform name or identifier. */
  platform: string;
}

/**
 * Parses a w3ds://auth URI.
 * @param uri - Full URI (e.g. w3ds://auth?redirect=...&session=...&platform=...)
 * @returns Parsed redirect URL, session ID, and platform
 * @throws If the URI is not a valid w3ds://auth URI or required params are missing
 */
export function parseAuthUri(uri: string): ParsedAuthUri {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new Error("Invalid auth URI: not a valid URL");
  }
  if (url.protocol !== "w3ds:" || url.host !== "auth") {
    throw new Error('Invalid auth URI: expected scheme w3ds://auth');
  }
  const redirectUrl = url.searchParams.get("redirect");
  const sessionId = url.searchParams.get("session");
  const platform = url.searchParams.get("platform") ?? "";
  if (!redirectUrl) throw new Error("Invalid auth URI: missing redirect");
  if (!sessionId) throw new Error("Invalid auth URI: missing session");
  return { redirectUrl, sessionId, platform };
}

/** Options for authenticating to a platform. */
export interface AuthenticateToPlatformOptions {
  cryptoAdapter: CryptoAdapter;
  keyId: string;
  w3id: string;
  /** Full w3ds://auth URI (redirect, session, platform). */
  authUri: string;
  /** Optional app version to send in the body. */
  appVersion?: string;
}

/** Result of a successful platform auth. */
export interface AuthenticateToPlatformResult {
  success: true;
  /** Response JSON from the platform (may include token, etc.). */
  token?: string;
  [key: string]: unknown;
}

/**
 * Authenticates to a platform: parses the auth URI (if needed), signs the session ID, and POSTs to the redirect URL.
 */
export async function authenticateToPlatform(
  options: AuthenticateToPlatformOptions
): Promise<AuthenticateToPlatformResult> {
  const { cryptoAdapter, keyId, w3id, authUri, appVersion } = options;
  const { redirectUrl, sessionId } = parseAuthUri(authUri);

  const signature = await cryptoAdapter.sign(keyId, sessionId);

  const body: Record<string, string> = {
    ename: w3id,
    session: sessionId,
    signature,
  };
  if (appVersion != null) body.appVersion = appVersion;

  const res = await fetch(redirectUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (data?.error as string) ||
      (data?.message as string) ||
      `${res.status} ${res.statusText}`;
    throw new Error(`Platform auth failed: ${msg}`);
  }

  return { success: true, ...data };
}
