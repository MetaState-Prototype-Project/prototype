import "reflect-metadata";
import path from "node:path";
import { config } from "dotenv";
import { AppDataSource } from "../src/database/data-source";
import { WishlistSummaryService } from "../src/services/WishlistSummaryService";
import { Wishlist } from "../src/database/entities/Wishlist";

// Load environment variables
config({ path: path.resolve(__dirname, "../../../.env") });

async function migrateSummaries() {
    console.log("Starting migration: Converting text summaries to AI-generated arrays...\n");

    try {
        // Initialize database connection
        await AppDataSource.initialize();
        console.log("Database connection established\n");

        const wishlistRepository = AppDataSource.getRepository(Wishlist);
        const summaryService = WishlistSummaryService.getInstance();

        // Get all wishlists that need migration (have text summaries or no summaries)
        const wishlists = await wishlistRepository.find({
            where: { isActive: true },
            relations: ["user"],
            order: { updatedAt: "DESC" },
        });

        console.log(`Found ${wishlists.length} wishlists to process\n`);

        let processedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const wishlist of wishlists) {
            try {
                // Check if already has array summaries
                const hasArraySummaries = 
                    Array.isArray(wishlist.summaryWants) && wishlist.summaryWants.length > 0 &&
                    Array.isArray(wishlist.summaryOffers) && wishlist.summaryOffers.length > 0;

                if (hasArraySummaries) {
                    skippedCount++;
                    continue;
                }

                console.log(`Processing wishlist ${wishlist.id}...`);
                console.log(`  Raw content: ${wishlist.content.substring(0, 200)}${wishlist.content.length > 200 ? '...' : ''}`);

                // Use the summary service to generate arrays from the raw content
                const summary = await summaryService.summarizeWishlistContent(wishlist.content);

                console.log(`  Generated Wants: ${JSON.stringify(summary.summaryWants)}`);
                console.log(`  Generated Offers: ${JSON.stringify(summary.summaryOffers)}`);

                // Save the arrays to the database
                wishlist.summaryWants = summary.summaryWants;
                wishlist.summaryOffers = summary.summaryOffers;
                await wishlistRepository.save(wishlist);

                console.log(`  Saved successfully\n`);
                processedCount++;

            } catch (error) {
                console.error(`  Error processing wishlist ${wishlist.id}:`, error);
                errorCount++;
            }
        }

        console.log("Migration completed:");
        console.log(`  Processed: ${processedCount}`);
        console.log(`  Skipped (already has arrays): ${skippedCount}`);
        console.log(`  Errors: ${errorCount}\n`);

    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    } finally {
        await AppDataSource.destroy();
        console.log("Database connection closed");
    }
}

// Run migration
migrateSummaries()
    .then(() => {
        console.log("Migration script completed");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Migration script failed:", error);
        process.exit(1);
    });
