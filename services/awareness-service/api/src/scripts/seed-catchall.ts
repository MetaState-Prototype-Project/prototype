import "reflect-metadata";
import { AppDataSource } from "../database/data-source";
import { SeedService } from "../services/SeedService";

/**
 * Standalone runner for catch-all subscription seeding. The same logic also
 * runs automatically on every API launch; this script is for manual re-runs
 * (e.g. after new platforms register with the registry).
 */
async function main(): Promise<void> {
    await AppDataSource.initialize();
    const result = await new SeedService().seedCatchAll();
    console.log(
        `[seed-catchall] complete: ${result.seeded} new / ${result.total} platforms`,
    );
    await AppDataSource.destroy();
}

main().catch((err) => {
    console.error("[seed-catchall] failed:", err);
    process.exit(1);
});
