#!/usr/bin/env ts-node

import { AppDataSource } from "../database/data-source";
import { Group } from "../database/entities/Group";
import { createGroupEVault } from "../../../../infrastructure/web3-adapter/src/index";
import path from "path";
import dotenv from "dotenv";
import { IsNull } from "typeorm";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

/**
 * Migration script to create eVaults for existing chartered groups
 * This script should be run once to migrate existing groups
 */
async function migrateExistingGroupsToEVaults() {
    console.log("🚀 Starting eVault migration for existing chartered groups...");
    
    try {
        // Initialize database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            console.log("✅ Database connection initialized");
        }

        // Get the Group repository
        const groupRepository = AppDataSource.getRepository(Group);
        
        // Find all groups that have charters
        const allGroups = await groupRepository.find();

        // Filter to only include groups with actual charter content and no ename
        const groupsNeedingMigration = allGroups.filter(group => 
            group.charter && 
            group.charter.trim() !== "" && 
            (!group.ename || group.ename.trim() === "")
        );

        console.log(`📊 Found ${groupsNeedingMigration.length} groups that need eVault creation`);

        if (groupsNeedingMigration.length === 0) {
            console.log("✅ No groups need migration. All chartered groups already have eVaults!");
            return;
        }

        // Check required environment variables
        const registryUrl = process.env.PUBLIC_REGISTRY_URL;
        const provisionerUrl = process.env.PUBLIC_PROVISIONER_URL;

        if (!registryUrl || !provisionerUrl) {
            throw new Error("Missing required environment variables: PUBLIC_REGISTRY_URL and PUBLIC_PROVISIONER_URL");
        }

        console.log("🔧 Environment variables validated");
        console.log(`📡 Registry URL: ${registryUrl}`);
        console.log(`📡 Provisioner URL: ${provisionerUrl}`);

        let successCount = 0;
        let errorCount = 0;
        const errors: Array<{ groupId: string; error: string }> = [];

        // Process groups in batches to avoid overwhelming the system
        const batchSize = 5;
        for (let i = 0; i < groupsNeedingMigration.length; i += batchSize) {
            const batch = groupsNeedingMigration.slice(i, i + batchSize);
            console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(groupsNeedingMigration.length / batchSize)}`);
            
            // Process batch concurrently
            const batchPromises = batch.map(async (group) => {
                try {
                    console.log(`🔧 Creating eVault for group: ${group.name} (${group.id})`);
                    
                    // Prepare group data for eVault creation
                    const groupData = {
                        name: group.name || "Unnamed Group",
                        avatar: undefined, // No avatar property in Group entity
                        description: group.description,
                        members: group.participants?.map((p: any) => p.id) || [],
                        admins: group.admins || [],
                        owner: group.owner,
                        charter: group.charter
                    };

                    console.log(`📋 Group data prepared:`, {
                        name: groupData.name,
                        participants: groupData.members.length,
                        admins: groupData.admins.length,
                        hasCharter: !!groupData.charter
                    });

                    // Create eVault
                    const evaultResult = await createGroupEVault(
                        registryUrl,
                        provisionerUrl,
                        groupData
                    );

                    console.log(`✅ eVault created successfully for group ${group.name}:`, {
                        w3id: evaultResult.w3id,
                        uri: evaultResult.uri,
                        manifestId: evaultResult.manifestId
                    });

                    // Update the group with the ename
                    group.ename = evaultResult.w3id;
                    await groupRepository.save(group);

                    console.log(`💾 Group ${group.name} updated with ename: ${evaultResult.w3id}`);
                    successCount++;

                } catch (error: any) {
                    const errorMessage = error.message || "Unknown error";
                    console.error(`❌ Failed to create eVault for group ${group.name} (${group.id}):`, errorMessage);
                    
                    errors.push({
                        groupId: group.id,
                        error: errorMessage
                    });
                    errorCount++;
                }
            });

            // Wait for batch to complete
            await Promise.all(batchPromises);
            
            // Add a small delay between batches to be respectful to the eVault service
            if (i + batchSize < groupsNeedingMigration.length) {
                console.log("⏳ Waiting 2 seconds before next batch...");
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Print final summary
        console.log("\n" + "=".repeat(60));
        console.log("🎯 MIGRATION COMPLETE - FINAL SUMMARY");
        console.log("=".repeat(60));
        console.log(`✅ Successfully migrated: ${successCount} groups`);
        console.log(`❌ Failed migrations: ${errorCount} groups`);
        console.log(`📊 Total groups processed: ${groupsNeedingMigration.length}`);
        
        if (errors.length > 0) {
            console.log("\n❌ ERRORS ENCOUNTERED:");
            errors.forEach(({ groupId, error }) => {
                console.log(`  - Group ${groupId}: ${error}`);
            });
        }

        if (successCount > 0) {
            console.log(`\n🎉 Successfully created ${successCount} eVaults!`);
        }

        if (errorCount > 0) {
            console.log(`\n⚠️  ${errorCount} groups failed migration. Check the errors above and consider re-running the migration.`);
        }

    } catch (error) {
        console.error("💥 Migration failed with error:", error);
        throw error;
    } finally {
        // Close database connection
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            console.log("🔌 Database connection closed");
        }
    }
}

// Run the migration
migrateExistingGroupsToEVaults()
    .then(() => {
        console.log("🎯 Migration script completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("💥 Migration script failed:", error);
        process.exit(1);
    });
