import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env file

const envPath = path.resolve(__dirname, "../../../.env")
dotenv.config({ path: envPath });

export interface TestConfig {
    pictiqueBaseUri: string;
    blabsyBaseUri: string;
    firebaseProjectId?: string;
    googleApplicationCredentials?: string;
    jwtSecret?: string;
    syncWaitTime: number; // Expected sync time in ms
    syncBufferTime: number; // Buffer time in ms
    preventionWindow: number; // Prevention window in ms (15 seconds)
    userCount: number; // Number of users for load tests
    registryUrl?: string; // Registry URL for entropy generation
    provisionerUrl?: string; // Provisioner URL (evault-core) for eName provisioning
    demoCodeW3DS?: string; // Demo code for W3DS verification
}

const requiredEnvVars = ['PUBLIC_PICTIQUE_BASE_URL', 'PUBLIC_BLABSY_BASE_URL'];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}, ${envPath}`);
    }
}

export const config: TestConfig = {
    pictiqueBaseUri: process.env.PUBLIC_PICTIQUE_BASE_URL!,
    blabsyBaseUri: process.env.PUBLIC_BLABSY_BASE_URL!,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    syncWaitTime: 15000, // 15 seconds expected sync time
    syncBufferTime: 30000, // 30 seconds buffer
    preventionWindow: 15000, // 15 seconds prevention window
    userCount: parseInt(process.env.LOAD_TEST_USER_COUNT || '2', 10), // Default to 2 users
    registryUrl: process.env.PUBLIC_REGISTRY_URL,
    provisionerUrl: process.env.PUBLIC_PROVISIONER_URL,
    demoCodeW3DS: process.env.DEMO_CODE_W3DS || 'd66b7138-538a-465f-a6ce-f6985854c3f4',
};

export default config;

