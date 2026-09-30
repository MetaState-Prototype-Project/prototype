import appsData from "../client/src/data/apps.json";
import { listPlatforms } from "./aaas";

export interface CatalogApp {
  id: string;
  name: string;
  description: string;
  category: string;
  logoUrl?: string | null;
  url?: string;
  appStoreUrl?: string;
  playStoreUrl?: string;
}

/**
 * The curated apps.json list followed by live AaaS platforms. Curated entries
 * win on an id or name collision. If AaaS fails, only the curated list is
 * returned.
 */
export async function listCatalogApps(): Promise<CatalogApp[]> {
  const curated = appsData as CatalogApp[];
  let live: CatalogApp[] = [];
  try {
    live = await listPlatforms();
  } catch (error) {
    console.error("Error fetching platforms from awareness:", error);
  }

  const ids = new Set(curated.map((a) => a.id.toLowerCase()));
  const names = new Set(curated.map((a) => a.name.toLowerCase()));
  return [
    ...curated,
    ...live.filter(
      (p) => !ids.has(p.id.toLowerCase()) && !names.has(p.name.toLowerCase()),
    ),
  ];
}
