/**
 * Seed the local Firebase emulators with two dev users + a chat between
 * them (so the messaging UI is reachable), and mint a sign-in token for
 * the first user — no QR / eID-wallet flow needed. Local-dev only.
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
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import * as fs from "fs";

type SeedUser = { uid: string; username: string; displayName: string };

const USERS: SeedUser[] = [
    { uid: "devuser01", username: "devuser", displayName: "Dev User" },
    { uid: "devuser02", username: "devuser2", displayName: "Dev User Two" }
];
const SIGN_IN_AS = "devuser01";
const CHAT_ID = "devchat01";
const CHAT_NAME = "New1";

async function seedUser(auth: Auth, db: Firestore, { uid, username, displayName }: SeedUser): Promise<void> {
    // Auth user (idempotent)
    try {
        await auth.createUser({ uid, email: `${username}@example.com`, displayName });
        console.log(`Created auth user ${uid}`);
    } catch (e: any) {
        if (e.code === "auth/uid-already-exists" || e.code === "auth/email-already-exists") {
            console.log(`Auth user ${uid} already exists`);
        } else throw e;
    }

    // Firestore user doc — auth-context signs out any uid without one, and the
    // chat header reads the participants' docs.
    await db.collection("users").doc(uid).set({
        id: uid,
        bio: null,
        name: displayName,
        theme: null,
        accent: null,
        website: null,
        location: null,
        username,
        photoURL: "/assets/twitter-avatar.jpg",
        verified: false,
        following: [],
        followers: [],
        createdAt: Timestamp.now(),
        updatedAt: null,
        totalTweets: 0,
        totalPhotos: 0,
        pinnedTweet: null,
        coverPhotoURL: null
    });
    console.log(`Wrote users/${uid}`);
}

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

    for (const u of USERS) await seedUser(auth, db, u);

    // Chat between the two users so the messaging screen (and its input box)
    // is reachable. Idempotent via the fixed id. Left without messages to match
    // the "No messages yet" state in the report.
    const now = Timestamp.now();
    await db.collection("chats").doc(CHAT_ID).set({
        id: CHAT_ID,
        participants: USERS.map((u) => u.uid),
        name: CHAT_NAME,
        admins: [],
        createdAt: now,
        updatedAt: now
    });
    console.log(`Wrote chats/${CHAT_ID} (${USERS.map((u) => u.uid).join(", ")})`);

    const token = await auth.createCustomToken(SIGN_IN_AS);
    console.log(`\nCustom token for ${SIGN_IN_AS} (sign in at http://localhost:8079/dev-login?token=<token>):\n`);
    console.log(token);
}

main().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
});
