/**
 * Seed script for eReputation database.
 * Creates mock users and signed eReferences for the visualizer.
 *
 * Usage (from platforms/ereputation/api):
 *   npx ts-node src/database/seed.ts
 */
import "reflect-metadata";
import path from "node:path";
import { config } from "dotenv";
import { DataSource } from "typeorm";
import { User } from "./entities/User";
import { Reference } from "./entities/Reference";
import { Vote } from "./entities/Vote";
import { Poll } from "./entities/Poll";
import { Wishlist } from "./entities/Wishlist";
import { VoteReputationResult } from "./entities/VoteReputationResult";
import { ReferenceSignature } from "./entities/ReferenceSignature";
import { Group } from "./entities/Group";
import { Calculation } from "./entities/Calculation";
import { Message } from "./entities/Message";

config({ path: path.resolve(__dirname, "../../../../.env") });

// Parse DB URL into explicit connection options (avoids SCRAM password parsing issues)
function parseDbUrl(url: string) {
    const parsed = new URL(url);
    return {
        host: parsed.hostname,
        port: parseInt(parsed.port || "5432", 10),
        username: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: parsed.pathname.replace(/^\//, ""),
    };
}

const dbConfig = parseDbUrl(process.env.EREPUTATION_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/ereputation");

// Standalone data source (no subscribers, no migrations)
const SeedDataSource = new DataSource({
    type: "postgres",
    ...dbConfig,
    synchronize: true, // create tables if missing
    entities: [User, Reference, Vote, Poll, Wishlist, VoteReputationResult, ReferenceSignature, Group, Calculation, Message],
    logging: false,
});

// ── Seed data ──────────────────────────────────────────────────────────

const USERS = [
    { handle: "alice", name: "Alice Dupont", ename: "alice.w3ds", email: "alice@example.com" },
    { handle: "bob", name: "Bob Martin", ename: "bob.w3ds", email: "bob@example.com" },
    { handle: "charlie", name: "Charlie Roux", ename: "charlie.w3ds", email: "charlie@example.com" },
    { handle: "diana", name: "Diana Chen", ename: "diana.w3ds", email: "diana@example.com" },
    { handle: "emile", name: "Emile Voss", ename: "emile.w3ds", email: "emile@example.com" },
    { handle: "fatima", name: "Fatima Nouri", ename: "fatima.w3ds", email: "fatima@example.com" },
    { handle: "gabriel", name: "Gabriel Leroy", ename: "gabriel.w3ds", email: "gabriel@example.com" },
    { handle: "hana", name: "Hana Takahashi", ename: "hana.w3ds", email: "hana@example.com" },
    { handle: "ivan", name: "Ivan Petrov", ename: "ivan.w3ds", email: "ivan@example.com" },
    { handle: "julia", name: "Julia Moreau", ename: "julia.w3ds", email: "julia@example.com" },
    { handle: "karl", name: "Karl Weber", ename: "karl.w3ds", email: "karl@example.com" },
    { handle: "lina", name: "Lina Alves", ename: "lina.w3ds", email: "lina@example.com" },
    { handle: "marco", name: "Marco Rossi", ename: "marco.w3ds", email: "marco@example.com" },
    { handle: "nadia", name: "Nadia Sergeeva", ename: "nadia.w3ds", email: "nadia@example.com" },
    { handle: "omar", name: "Omar Farah", ename: "omar.w3ds", email: "omar@example.com" },
];

const GROUPS = [
    { id: "g-core-team", name: "MetaState Core Team" },
    { id: "g-w3ds-wg", name: "W3DS Working Group" },
    { id: "g-dao-gov", name: "DAO Governance Board" },
    { id: "g-open-data", name: "Open Data Collective" },
];

const PLATFORMS = [
    { id: "p-blabsy", name: "Blabsy" },
    { id: "p-pictique", name: "Pictique" },
    { id: "p-evoting", name: "eVoting" },
    { id: "p-ecurrency", name: "eCurrency" },
    { id: "p-marketplace", name: "Marketplace" },
    { id: "p-esigner", name: "eSigner" },
];

const REF_TYPES = ["professional", "academic", "character", "skill", "leadership"];

const TEXTS: Record<string, string[]> = {
    professional: [
        "Outstanding work ethic and delivery quality. Consistently exceeded expectations on every project we collaborated on.",
        "A reliable professional who brings deep technical expertise to every project. I would hire them again without hesitation.",
        "Excellent collaborator — always willing to help and share knowledge with the team. Elevated everyone around them.",
        "Demonstrated exceptional project management skills and always delivered on time despite tight deadlines.",
    ],
    academic: [
        "Exceptional research capabilities and a talent for synthesizing complex information into actionable insights.",
        "Contributed groundbreaking insights during our joint research project on decentralized identity systems.",
        "A brilliant mind with a knack for breaking down complex cryptographic concepts for broader audiences.",
    ],
    character: [
        "Trustworthy and principled. A person of integrity in all interactions, both professional and personal.",
        "Genuinely kind and supportive, making every team better by being in it. Their positive energy is contagious.",
        "An exceptionally honest and transparent individual. You always know where you stand with them.",
    ],
    skill: [
        "Expert-level proficiency in distributed systems and cryptographic protocols. A true technical authority.",
        "Remarkable problem-solving skills and attention to detail. Finds solutions others wouldn't think of.",
        "Strong architectural thinking — designs systems that are both elegant and resilient at scale.",
        "Full-stack expertise with deep knowledge of both frontend UX and backend infrastructure.",
    ],
    leadership: [
        "Led our team through a challenging transition with empathy and clarity. Everyone felt supported.",
        "Inspires others through vision and by example. A natural leader who earns respect rather than demands it.",
        "Exceptional at mentoring junior team members. Several people on our team grew significantly under their guidance.",
    ],
};

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysBack: number): Date {
    return new Date(Date.now() - Math.floor(Math.random() * daysBack) * 86_400_000);
}

// ── Main ───────────────────────────────────────────────────────────────

async function seed() {
    console.log("Connecting to eReputation database...");
    await SeedDataSource.initialize();
    console.log("Connected.\n");

    const userRepo = SeedDataSource.getRepository(User);
    const refRepo = SeedDataSource.getRepository(Reference);

    // 1. Upsert users
    console.log(`Seeding ${USERS.length} users...`);
    const savedUsers: User[] = [];
    for (const u of USERS) {
        let existing = await userRepo.findOneBy({ ename: u.ename });
        if (!existing) {
            existing = userRepo.create(u);
            existing = await userRepo.save(existing);
            console.log(`  + Created user: ${u.name} (${u.ename})`);
        } else {
            console.log(`  · Exists: ${u.name} (${u.ename})`);
        }
        savedUsers.push(existing);
    }

    // 2. Clear old seed references (optional, idempotent re-runs)
    const existingRefCount = await refRepo.count();
    if (existingRefCount > 0) {
        console.log(`\nClearing ${existingRefCount} existing references...`);
        await refRepo.clear();
    }

    // 3. Generate references
    console.log("\nGenerating eReferences...");
    const references: Partial<Reference>[] = [];

    for (const author of savedUsers) {
        const numRefs = 2 + Math.floor(Math.random() * 4); // 2-5 references each

        for (let i = 0; i < numRefs; i++) {
            const roll = Math.random();
            let targetType: string;
            let targetId: string;
            let targetName: string;

            if (roll < 0.55) {
                // User target (not self)
                const candidates = savedUsers.filter((u) => u.id !== author.id);
                const target = pick(candidates);
                targetType = "user";
                targetId = target.id;
                targetName = target.name;
            } else if (roll < 0.80) {
                // Group target
                const target = pick(GROUPS);
                targetType = "group";
                targetId = target.id;
                targetName = target.name;
            } else {
                // Platform target
                const target = pick(PLATFORMS);
                targetType = "platform";
                targetId = target.id;
                targetName = target.name;
            }

            const refType = pick(REF_TYPES);
            const content = pick(TEXTS[refType]);
            const hasScore = Math.random() > 0.25;

            references.push({
                authorId: author.id,
                targetType,
                targetId,
                targetName,
                content,
                referenceType: refType,
                numericScore: hasScore ? Math.floor(Math.random() * 3) + 3 : undefined, // 3-5
                status: "signed",
                createdAt: randomDate(365),
            });
        }
    }

    // Bulk insert
    await refRepo.save(references as Reference[]);
    console.log(`  ✓ Created ${references.length} signed eReferences\n`);

    // 4. Summary
    const userCount = await userRepo.count();
    const refCount = await refRepo.count();
    console.log("── Seed complete ──");
    console.log(`  Users:      ${userCount}`);
    console.log(`  References: ${refCount}`);
    console.log("");

    await SeedDataSource.destroy();
    process.exit(0);
}

seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
