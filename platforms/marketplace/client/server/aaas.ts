/**
 * Read side for the marketplace: pull live platform listings from
 * Awareness-as-a-Service (AaaS).
 *
 * Platforms publish a PlatformProfile into their own eVault at provisioning
 * time (see each platform's PlatformEVaultService). It is stored under the
 * User-profile ontology and distinguished from ordinary user profiles by a
 * `platformName` field. AaaS fans those writes out and exposes them at
 * `GET /api/packets?ontology=...`, which is what we page through here.
 *
 * The AaaS API key is a secret, so this only ever runs server-side.
 *
 * Env:
 *   AWARENESS_SERVICE_URL  base URL of AaaS (default http://localhost:4100)
 *   AWARENESS_API_KEY      Bearer key (aaas_…) issued from the AaaS portal
 */

// User-profile ontology — platform profiles are stored under it, tagged with
// a `platformName`. Same id the platforms write with.
const USER_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";

const AWARENESS_SERVICE_URL =
  process.env.AWARENESS_SERVICE_URL || "http://localhost:4100";
const AWARENESS_API_KEY = process.env.AWARENESS_API_KEY;

/** A single packet as returned by AaaS `GET /api/packets`. */
interface Packet {
  id: string;
  ontology: string;
  w3id: string | null;
  data: Record<string, any> | null;
  receivedAt: string;
}

interface PacketsResponse {
  packets: Packet[];
  hasMore: boolean;
  nextCursor: string | null;
}

/** The marketplace card shape (matches the static apps.json entries). */
export interface MarketplacePlatform {
  id: string;
  name: string;
  description: string;
  category: string;
  logoUrl: string | null;
  url: string;
  ename: string;
}

const base = AWARENESS_SERVICE_URL.replace(/\/$/, "");

/** One page of packets for the given filters. */
async function page(
  params: Record<string, string | number>,
  cursor?: string | null,
): Promise<PacketsResponse> {
  const query = new URLSearchParams();
  query.set("limit", "200");
  for (const [k, v] of Object.entries(params)) query.set(k, String(v));
  if (cursor) query.set("cursor", cursor);

  const res = await fetch(`${base}/api/packets?${query.toString()}`, {
    headers: { Authorization: `Bearer ${AWARENESS_API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`AaaS /api/packets returned ${res.status}`);
  }
  return (await res.json()) as PacketsResponse;
}

/** Every packet matching the filters, paged to exhaustion (newest last). */
async function all(params: Record<string, string | number>): Promise<Packet[]> {
  const out: Packet[] = [];
  let cursor: string | null | undefined;
  do {
    const res = await page(params, cursor);
    out.push(...(res.packets ?? []));
    cursor = res.hasMore ? res.nextCursor : null;
  } while (cursor);
  return out;
}

/**
 * All published platform profiles, deduped by eName (last write wins), mapped
 * to the marketplace card shape. Returns [] when AaaS is not configured so
 * local dev without AaaS still works.
 */
export async function listPlatforms(): Promise<MarketplacePlatform[]> {
  if (!AWARENESS_API_KEY) return [];

  const packets = await all({ ontology: USER_ONTOLOGY });

  // Packets are ordered oldest→newest, so a plain Map keeps the last write.
  const byEname = new Map<string, MarketplacePlatform>();
  for (const p of packets) {
    const data = p.data;
    // Isolate platform profiles from ordinary user profiles sharing the
    // ontology; skip archived/inactive platforms.
    if (!data || typeof data.platformName !== "string" || !data.platformName) {
      continue;
    }
    if (data.isArchived === true || data.isActive === false) continue;

    const ename = (p.w3id ?? (data.ename as string | undefined)) || "";
    if (!ename) continue;

    byEname.set(ename, {
      id: data.platformName,
      name: data.displayName || data.platformName,
      description: data.description || "",
      category: data.category || "Other",
      logoUrl: data.logoUrl || null,
      url: data.url || "",
      ename,
    });
  }

  return Array.from(byEname.values());
}
