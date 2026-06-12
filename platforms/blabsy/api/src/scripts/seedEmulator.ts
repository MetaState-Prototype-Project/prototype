/**
 * Seed the local Firebase emulators with a dev user so you can sign in
 * without the QR / eID-wallet flow. Local-dev only.
 *
 * Prereqs: emulators running (auth :9099, firestore :8080).
 * Run from platforms/blabsy/api:
 *
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   GOOGLE_APPLICATION_CREDENTIALS=<repo>/secrets/w3ds-staging-firebase-adminsdk.json \
 *   pnpm exec ts-node src/scripts/seedEmulator.ts
 *
 * Prints a Firebase custom token. Sign in via:
 *   http://localhost:8079/dev-login?token=<token>
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as fs from "fs";

const UID = "devuser01";
const USERNAME = "devuser";

async function main(): Promise<void> {
    if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
        throw new Error(
            "Refusing to run: FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST must be set " +
                "so this only ever touches the emulators, never staging/prod."
        );
    }

    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPath || !fs.existsSync(credentialsPath)) {
        throw new Error("GOOGLE_APPLICATION_CREDENTIALS must point to the service-account JSON (used only to sign the custom token).");
    }
    const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));

    if (getApps().length === 0) {
        initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
    }

    const auth = getAuth();
    const db = getFirestore();

    // Auth user (idempotent)
    try {
        await auth.createUser({ uid: UID, email: `${USERNAME}@example.com`, displayName: "Dev User" });
        console.log(`Created auth user ${UID}`);
    } catch (e: any) {
        if (e.code === "auth/uid-already-exists" || e.code === "auth/email-already-exists") {
            console.log(`Auth user ${UID} already exists`);
        } else throw e;
    }

    // Firestore user doc — auth-context signs out any uid without one.
    const now = Timestamp.now();
    await db.collection("users").doc(UID).set({
        id: UID,
        bio: null,
        name: "Dev User",
        theme: null,
        accent: null,
        website: null,
        location: null,
        username: USERNAME,
        photoURL: "/assets/twitter-avatar.jpg",
        verified: false,
        following: [],
        followers: [],
        createdAt: now,
        updatedAt: null,
        totalTweets: 0,
        totalPhotos: 0,
        pinnedTweet: null,
        coverPhotoURL: null
    });
    console.log(`Wrote users/${UID}`);

    const token = await auth.createCustomToken(UID);
    console.log("\nCustom token (sign in at http://localhost:8079/dev-login?token=<token>):\n");
    console.log(token);
}

main().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
});
