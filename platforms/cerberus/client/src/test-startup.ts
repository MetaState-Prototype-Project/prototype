import { config } from "dotenv";
import path from "path";
import { AppDataSource } from "./database/data-source";
import { PlatformEVaultService } from "./services/PlatformEVaultService";

// Load environment variables from root .env file
config({ path: path.resolve(__dirname, "../../../../.env") });

async function testStartupInitialization() {
    try {
        console.log("🚀 Testing Cerberus Platform eVault Initialization...\n");

        // Initialize database connection
        await AppDataSource.initialize();
        console.log("✅ Database connection established\n");

        const platformService = PlatformEVaultService.getInstance();

        // Check if platform eVault exists
        console.log("🔍 Checking platform eVault existence...");
        const exists = await platformService.checkPlatformEVaultExists();
        
        if (exists) {
            console.log("✅ Platform eVault exists for Cerberus");
            
            // Get platform details
            const eName = await platformService.getPlatformEName();
            const uri = await platformService.getPlatformEVaultUri();
            const mapping = await platformService.getPlatformEVaultMapping();
            
            console.log("📋 Platform eVault Details:");
            console.log(`   eName (W3ID): ${eName}`);
            console.log(`   URI: ${uri}`);
            console.log(`   User Profile ID: ${mapping?.userProfileId}`);
            console.log(`   Created: ${mapping?.createdAt}`);
            
        } else {
            console.log("⚠️  Platform eVault does not exist - this should be created on startup");
        }

        console.log("\n🎯 Startup initialization test completed!");

    } catch (error) {
        console.error("❌ Error during startup initialization test:", error);
        
        if (error instanceof Error) {
            console.error("Error message:", error.message);
        }
    } finally {
        // Close database connection
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            console.log("\n🔌 Database connection closed");
        }
    }
}

// Run the test
testStartupInitialization()
    .then(() => {
        console.log("\n✨ Test completed");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n💥 Test failed:", error);
        process.exit(1);
    }); 