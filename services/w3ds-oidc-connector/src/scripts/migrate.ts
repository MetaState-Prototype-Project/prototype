/**
 * Applies pending database migrations, then exits.
 *
 *   pnpm --filter w3ds-oidc-connector migrate     (development)
 *   node dist/scripts/migrate.js                  (production image)
 */

import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createDataSource } from "../db/data-source.js";

loadEnv({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });

async function main() {
    const url = process.env.W3DS_OIDC_DATABASE_URL;
    if (!url) throw new Error("W3DS_OIDC_DATABASE_URL is required");
    const dataSource = createDataSource({ url, caCert: process.env.DB_CA_CERT });
    await dataSource.initialize();
    try {
        const applied = await dataSource.runMigrations();
        console.log(
            applied.length
                ? `[w3ds-oidc] applied ${applied.map((m) => m.name).join(", ")}`
                : "[w3ds-oidc] database is up to date",
        );
    } finally {
        await dataSource.destroy();
    }
}

main().catch((error) => {
    console.error("[w3ds-oidc] migration failed:", error instanceof Error ? error.message : error);
    process.exit(1);
});
