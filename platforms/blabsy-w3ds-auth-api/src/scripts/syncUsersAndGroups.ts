import { getFirestore } from "firebase-admin/firestore";
import { DocumentData } from "firebase-admin/firestore";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import * as fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { adapter } from "../controllers/WebhookController";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

// Initialize Firebase Admin SDK if not already initialized
function initializeFirebase(): void {
    try {
        // Check if already initialized
        if (getApps().length > 0) {
            console.log("✅ Firebase Admin SDK already initialized");
            return;
        }
        
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CREDENTIALS_PATH) {
            const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CREDENTIALS_PATH;
            
            // Explicitly load credentials from file if path is provided
            if (credentialsPath && fs.existsSync(credentialsPath)) {
                try {
                    const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
                    initializeApp({
                        credential: cert(serviceAccount),
                    });
                    console.log("✅ Firebase Admin SDK initialized with service account file");
                    return;
                } catch (fileError: any) {
                    console.error("❌ Failed to load service account file:", fileError.message);
                    console.error("   File path:", credentialsPath);
                    // Fall back to applicationDefault
                    try {
                        initializeApp({
                            credential: applicationDefault(),
                        });
                        console.log("✅ Firebase Admin SDK initialized with applicationDefault (fallback)");
                        return;
                    } catch (fallbackError: any) {
                        console.error("❌ Failed to initialize with applicationDefault:", fallbackError.message);
                    }
                }
            } else {
                // Try applicationDefault (for GCP metadata service or other default locations)
                try {
                    initializeApp({
                        credential: applicationDefault(),
                    });
                    console.log("✅ Firebase Admin SDK initialized with applicationDefault");
                    return;
                } catch (defaultError: any) {
                    console.error("❌ Failed to initialize with applicationDefault:", defaultError.message);
                    if (credentialsPath) {
                        console.error("   Credentials path was set but file not found:", credentialsPath);
                    }
                }
            }
        } else {
            throw new Error("Firebase credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_CREDENTIALS_PATH environment variable");
        }
    } catch (error: any) {
        console.error("❌ Failed to initialize Firebase Admin SDK:", error.message);
        throw error;
    }
}

const DELAY_BETWEEN_CALLS_MS = 3330; // 3.33 seconds

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process a single user document by calling handleChange
 */
async function processUser(doc: FirebaseFirestore.QueryDocumentSnapshot<DocumentData>): Promise<void> {
    const data = doc.data();
    const enrichedData: DocumentData & { id: string } = { ...data, id: doc.id };
    
    await adapter.handleChange({
        data: enrichedData,
        tableName: "user",
    }).catch((e) => {
        console.error(`Error processing user ${doc.id}:`, e);
        throw e;
    });
}

/**
 * Process a single group document by calling handleChange
 */
async function processGroup(doc: FirebaseFirestore.QueryDocumentSnapshot<DocumentData>): Promise<void> {
    const data = doc.data();
    const enrichedData: DocumentData & { id: string } = { ...data, id: doc.id };
    
    await adapter.handleChange({
        data: enrichedData,
        tableName: "group",
    }).catch((e) => {
        console.error(`Error processing group ${doc.id}:`, e);
        throw e;
    });
}

/**
 * Sync all users and groups from Firestore
 */
async function syncUsersAndGroups(): Promise<void> {
    // Initialize Firebase first
    console.log("🔧 Initializing Firebase Admin SDK...");
    initializeFirebase();
    
    const db = getFirestore();
    
    console.log("🚀 Starting sync of users and groups...\n");
    
    // Fetch all users
    console.log("📥 Fetching all users from Firestore...");
    const usersSnapshot = await db.collection("users").get();
    const users = usersSnapshot.docs;
    console.log(`✅ Found ${users.length} users\n`);
    
    // Fetch all groups
    console.log("📥 Fetching all groups from Firestore...");
    let groups: FirebaseFirestore.QueryDocumentSnapshot<DocumentData>[] = [];
    try {
        const groupsSnapshot = await db.collection("groups").get();
        groups = groupsSnapshot.docs;
        console.log(`✅ Found ${groups.length} groups\n`);
    } catch (error: any) {
        console.warn(`⚠️  Could not fetch groups collection: ${error.message}`);
        console.warn("   Continuing with users only...\n");
        groups = [];
    }
    
    const totalItems = users.length + groups.length;
    let processedCount = 0;
    let failedCount = 0;
    
    // Process all users first
    console.log("=".repeat(60));
    console.log("👥 Processing Users");
    console.log("=".repeat(60));
    
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const userNumber = i + 1;
        const remaining = users.length - userNumber;
        
        try {
            console.log(`\n[${userNumber}/${users.length}] Processing user: ${user.id}`);
            await processUser(user);
            processedCount++;
            console.log(`✅ Successfully processed user ${user.id}`);
        } catch (error) {
            failedCount++;
            console.error(`❌ Failed to process user ${user.id}:`, error);
        }
        
        // Show progress
        const progress = ((processedCount + failedCount) / totalItems) * 100;
        console.log(`📊 Progress: ${processedCount + failedCount}/${totalItems} (${progress.toFixed(1)}%) | ✅ Success: ${processedCount} | ❌ Failed: ${failedCount}`);
        
        // Wait before processing next item (except for the last one)
        if (i < users.length - 1) {
            console.log(`⏳ Waiting ${DELAY_BETWEEN_CALLS_MS / 1000}s before next user...`);
            await sleep(DELAY_BETWEEN_CALLS_MS);
        }
    }
    
    console.log("\n" + "=".repeat(60));
    console.log(`✅ Finished processing ${users.length} users`);
    console.log("=".repeat(60) + "\n");
    
    // Process all groups
    console.log("=".repeat(60));
    console.log("👥 Processing Groups");
    console.log("=".repeat(60));
    
    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const groupNumber = i + 1;
        
        try {
            console.log(`\n[${groupNumber}/${groups.length}] Processing group: ${group.id}`);
            await processGroup(group);
            processedCount++;
            console.log(`✅ Successfully processed group ${group.id}`);
        } catch (error) {
            failedCount++;
            console.error(`❌ Failed to process group ${group.id}:`, error);
        }
        
        // Show progress
        const progress = ((processedCount + failedCount) / totalItems) * 100;
        console.log(`📊 Progress: ${processedCount + failedCount}/${totalItems} (${progress.toFixed(1)}%) | ✅ Success: ${processedCount} | ❌ Failed: ${failedCount}`);
        
        // Wait before processing next item (except for the last one)
        if (i < groups.length - 1) {
            console.log(`⏳ Waiting ${DELAY_BETWEEN_CALLS_MS / 1000}s before next group...`);
            await sleep(DELAY_BETWEEN_CALLS_MS);
        }
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("🎉 Sync Complete!");
    console.log("=".repeat(60));
    console.log(`📊 Final Statistics:`);
    console.log(`   Total items: ${totalItems}`);
    console.log(`   ✅ Successfully processed: ${processedCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log(`   📈 Success rate: ${((processedCount / totalItems) * 100).toFixed(1)}%`);
    console.log("=".repeat(60));
}

// Run the sync
if (require.main === module) {
    syncUsersAndGroups()
        .then(() => {
            console.log("\n✅ Script completed successfully");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n❌ Script failed:", error);
            process.exit(1);
        });
}

export { syncUsersAndGroups };
