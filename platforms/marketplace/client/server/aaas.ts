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

  const url = `${base}/api/packets?${query.toString()}`;
  console.log(`[awareness] GET ${url}`);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AWARENESS_API_KEY}` },
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(
      `[awareness] ${res.status} ${res.statusText} from /api/packets: ${body.slice(0, 500)}`,
    );
    throw new Error(`AaaS /api/packets returned ${res.status}`);
  }
  try {
    return JSON.parse(body) as PacketsResponse;
  } catch (err) {
    console.error(
      `[awareness] failed to parse /api/packets response (first 500 chars): ${body.slice(0, 500)}`,
    );
    throw err;
  }
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
  if (!AWARENESS_API_KEY) {
    console.warn(
      "[awareness] AWARENESS_API_KEY is not set — returning no live platforms",
    );
    return [];
  }
  console.log(
    `[awareness] listPlatforms: base=${base} ontology=${USER_ONTOLOGY}`,
  );

  const packets = await all({ ontology: USER_ONTOLOGY });
  console.log(`[awareness] fetched ${packets.length} packet(s) total`);

  // Packets are ordered oldest→newest, so a plain Map keeps the last write.
  const byEname = new Map<string, MarketplacePlatform>();
  let profileCount = 0;
  let skippedNoPlatformName = 0;
  let skippedArchived = 0;
  for (const p of packets) {
    const data = p.data;
    // Isolate platform profiles from ordinary user profiles sharing the
    // ontology; skip archived/inactive platforms.
    if (!data || typeof data.platformName !== "string" || !data.platformName) {
      skippedNoPlatformName++;
      continue;
    }
    if (data.isArchived === true || data.isActive === false) {
      skippedArchived++;
      continue;
    }

    const ename = (p.w3id ?? (data.ename as string | undefined)) || "";
    if (!ename) continue;

    profileCount++;
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

  const platforms = Array.from(byEname.values());
  console.log(
    `[awareness] platform profiles=${profileCount} (deduped=${platforms.length}), ` +
      `skipped: non-platform=${skippedNoPlatformName}, archived/inactive=${skippedArchived}`,
  );
  console.log(
    `[awareness] platforms: ${platforms.map((p) => p.id).join(", ") || "(none)"}`,
  );
  return platforms;
}
