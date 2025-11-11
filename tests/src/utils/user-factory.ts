import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { config } from '../config/env';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import * as falso from '@ngneat/falso';
import axios from 'axios';

let firebaseApp: App | null = null;
let firestore: any = null;

export interface TestUser {
  id: string;
  ename: string;
  email: string;
  username: string;
  name: string;
  firebaseUid: string;
}

/**
 * Initialize Firebase Admin SDK
 */
export function initializeFirebase(): void {
  if (getApps().length > 0) {
    firebaseApp = getApps()[0];
    firestore = getFirestore(firebaseApp);
    return;
  }

  let credential;
  
  if (config.googleApplicationCredentials) {
    // Resolve path relative to project root (where .env file is)
    // When running from staging-load-tests directory, go up one level to project root
    const credentialsPath = path.resolve(process.cwd(), '..', config.googleApplicationCredentials);
    
    // Set environment variable for Firebase Admin SDK
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
    
    if (fs.existsSync(credentialsPath)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const serviceAccount = require(credentialsPath);
      credential = cert(serviceAccount);
    } else {
      throw new Error(`Firebase credentials file not found at: ${credentialsPath}`);
    }
  } else {
    // Try using application default credentials (for environments like GCP)
    credential = undefined;
  }

  firebaseApp = initializeApp({
    credential: credential,
    projectId: config.firebaseProjectId,
  });

  firestore = getFirestore(firebaseApp);
}

/**
 * Provision an eName using evault-core
 */
async function provisionEName(): Promise<string> {
  if (!config.registryUrl) {
    throw new Error('PUBLIC_REGISTRY_URL is not set in environment variables');
  }
  if (!config.provisionerUrl) {
    throw new Error('PUBLIC_PROVISIONER_URL is not set in environment variables');
  }

  // Step 1: Get entropy token from registry
  const entropyResponse = await axios.get(`${config.registryUrl}/entropy`);
  if (!entropyResponse.data?.token) {
    throw new Error('Failed to get entropy token from registry');
  }
  const registryEntropy = entropyResponse.data.token;

  // Step 2: Generate random namespace (UUID)
  const namespace = uuidv4();

  // Step 3: Provision eName via evault-core
  const provisionResponse = await axios.post(
    `${config.provisionerUrl}/provision`,
    {
      registryEntropy,
      namespace,
      verificationId: config.demoCodeW3DS,
      publicKey: '0x0000000000000000000000000000000000000000', // Dummy public key for testing
    }
  );

  if (!provisionResponse.data?.success || !provisionResponse.data?.w3id) {
    throw new Error(
      `Failed to provision eName: ${provisionResponse.data?.error || provisionResponse.data?.message || 'Unknown error'}`
    );
  }

  // Return the w3id (eName) - it should already be in @ format
  const w3id = provisionResponse.data.w3id;
  // Ensure it starts with @
  return w3id.startsWith('@') ? w3id : `@${w3id}`;
}

/**
 * Create a test user in Firebase
 * Users created in Firebase will automatically sync to pictique
 * eName is provisioned via evault-core before creating the Firebase user
 */
export async function createTestUser(index: number): Promise<TestUser> {
  if (!firestore) {
    initializeFirebase();
  }
  if (!firestore) {
    throw new Error('Failed to initialize Firestore');
  }

  const auth = getAuth(firebaseApp!);
  
  // Provision eName via evault-core
  const ename = await provisionEName();
  
  // Username should be ename without the @ prefix
  const username = ename.startsWith('@') ? ename.slice(1) : ename;
  
  // Make email unique with UUID to avoid conflicts from previous test runs
  const email = `${falso.randEmail({ domain: 'staging-load-test.local' })}-${username}`;
  const name = `${falso.randFirstName()} ${falso.randLastName()}`;

  // Create user in Firebase Auth
  const userRecord = await auth.createUser({
    email,
    displayName: name,
    uid: ename, // Use ename as UID
  });

  // Create user document in Firestore
  const userRef = firestore.collection('users').doc(ename);
  await userRef.set({
    id: ename,
    ename: ename,
    name: name,
    username: username,
    bio: falso.randBoolean() ? falso.randSentence() : null,
    photoURL: '/assets/twitter-avatar.jpg',
    coverPhotoURL: falso.randBoolean() ? falso.randUrl() : null,
    verified: falso.randBoolean({ probability: 0.1 }), // 10% chance of being verified
    following: [],
    followers: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    totalTweets: 0,
    totalPhotos: 0,
    pinnedTweet: null,
    theme: falso.randBoolean() ? falso.rand(['light', 'dark', 'dim']) : null,
    accent: falso.randBoolean() ? falso.rand(['blue', 'yellow', 'pink', 'purple', 'orange', 'green']) : null,
    website: falso.randBoolean() ? falso.randUrl() : null,
    location: falso.randBoolean() ? `${falso.randCity()}, ${falso.randCountry()}` : null,
  });

  return {
    id: ename,
    ename,
    email,
    username,
    name,
    firebaseUid: userRecord.uid,
  };
}

/**
 * Create multiple test users (with caching support)
 * Users are created in parallel batches for better performance
 */
export async function createTestUsers(count: number, useCache: boolean = true): Promise<TestUser[]> {
  // Check cache first if enabled
  if (useCache) {
    const { getCachedUsers, isCacheValid } = await import('./user-cache');
    if (isCacheValid(count)) {
      const cached = getCachedUsers(count);
      if (cached) {
        console.log(`Using ${cached.length} cached test users`);
        return cached;
      }
    }
  }
  
  initializeFirebase();
  
  console.log(`Creating ${count} test users in parallel batches...`);
  
  // Create users in parallel batches to speed up creation
  const BATCH_SIZE = 5; // Create 5 users at a time
  const users: TestUser[] = [];
  const batches: number[][] = [];
  
  for (let i = 1; i <= count; i += BATCH_SIZE) {
    batches.push(
      Array.from({ length: Math.min(BATCH_SIZE, count - i + 1) }, (_, idx) => i + idx)
    );
  }
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`Creating batch ${batchIndex + 1}/${batches.length} (${batch.length} users)...`);
    
    const batchPromises = batch.map(async (index) => {
      try {
        return await createTestUser(index);
      } catch (error: any) {
        // If email already exists, try again with a new UUID
        if (error.code === 'auth/email-already-exists') {
          console.warn(`Email conflict for user ${index}, retrying...`);
          return await createTestUser(index);
        } else {
          console.error(`Failed to create user ${index}:`, error);
          throw error;
        }
      }
    });
    
    const batchUsers = await Promise.all(batchPromises);
    users.push(...batchUsers);
    
    // Small delay between batches to avoid overwhelming the system
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Save to cache if enabled
  if (useCache) {
    const { saveCachedUsers } = await import('./user-cache');
    saveCachedUsers(users);
  }
  
  return users;
}

/**
 * Cleanup test users
 * NOTE: We don't delete users as deletion is not supported for sync.
 * This function is kept for API compatibility but does nothing.
 */
export async function cleanupTestUsers(users: TestUser[]): Promise<void> {
  // No-op: Deletion is not supported for sync, so we don't clean up test users
  console.log(`Note: Skipping cleanup of ${users.length} test users (deletion not supported for sync)`);
}

/**
 * Wait for user to sync to pictique
 */
export async function waitForUserSync(ename: string, maxWaitMs: number = 60000): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const axios = require('axios');
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      // Try to find user in pictique by ename
      const response = await axios.get(
        `${config.pictiqueBaseUri}/api/users/search/ename-name`,
        {
          params: { q: ename },
        }
      );
      
      if (response.data && response.data.length > 0) {
        const user = response.data.find((u: any) => u.ename === ename);
        if (user) {
          return true;
        }
      }
    } catch (error) {
      // User might not exist yet, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
  }
  
  return false;
}

