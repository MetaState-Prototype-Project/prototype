#!/usr/bin/env node
/**
 * Seed N social bindings onto an existing eVault, for testing the Social
 * Bindings screens (issues #1080 / #1086) without scanning N QR codes.
 *
 * Each seeded binding mirrors exactly what a real scan produces, so the
 * screens hit the same code paths (including the per-binding reconcile that
 * makes the Full List slow):
 *
 *   1. a real anonymous eVault is provisioned for the counterparty, so the
 *      registry resolves it and cross-vault reads actually go over the wire;
 *   2. a `self` doc gives it a display name, and a `photograph` doc gives it a
 *      photo blob — the Full List drags those blobs across the network because
 *      it calls fetchNameFromVault without { nameOnly: true }, so a seed with
 *      no photos would under-report the latency badly;
 *   3. the primary `social_connection` doc lands in the counterparty's vault
 *      (subject=@them, signed by you), then they counter-sign it -> confirmed;
 *   4. a single-signature mirror lands in your vault (subject=@you, signed by
 *      you) -> role "sent", which is what triggers the remote reconcile.
 *
 * Signatures use the SHA-256-of-canonical-form path that the server accepts as
 * a legacy signature (BindingDocumentService.ts:271), so no keypair is needed.
 *
 * Usage:
 *   node scripts/seed-social-bindings.mjs --ename @your-ename [--count 8]
 *                                         [--photo-kb 250] [--no-photos]
 *
 * Reads PUBLIC_REGISTRY_URL / PUBLIC_PROVISIONER_URL / PUBLIC_EID_WALLET_TOKEN
 * from the repo-root .env; each can be overridden by a real env var.
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

// Skips the whole KYC block server-side (ProvisioningService.ts:474).
const DEMO_VERIFICATION_CODE = "d66b7138-538a-465f-a6ce-f6985854c3f4";

const FAKE_NAMES = [
    "Ada Lovelace",
    "Grace Hopper",
    "Alan Turing",
    "Katherine Johnson",
    "Linus Torvalds",
    "Margaret Hamilton",
    "Dennis Ritchie",
    "Barbara Liskov",
    "Ken Thompson",
    "Radia Perlman",
    "Tim Berners-Lee",
    "Anita Borg",
];

const RELATIONS = [
    "Met at a conference",
    "Colleague",
    "Friend",
    "Met at a meetup",
    "Family",
    "Business contact",
];

// --- env ----------------------------------------------------------------

function loadDotEnv(path) {
    const out = {};
    let raw;
    try {
        raw = readFileSync(path, "utf8");
    } catch {
        return out;
    }
    for (const line of raw.split("\n")) {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
        if (!m) continue;
        let v = m[2];
        if (
            (v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))
        ) {
            v = v.slice(1, -1);
        }
        out[m[1]] = v;
    }
    return out;
}

const dotEnv = loadDotEnv(resolvePath(ROOT, ".env"));
const env = (key, fallback) => process.env[key] || dotEnv[key] || fallback;

const REGISTRY_URL = env("PUBLIC_REGISTRY_URL", "http://localhost:4321");
const PROVISIONER_URL = env("PUBLIC_PROVISIONER_URL", "http://localhost:3001");
const TOKEN = env("PUBLIC_EID_WALLET_TOKEN", "");

// --- args ---------------------------------------------------------------

const argv = process.argv.slice(2);
function arg(name, fallback) {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

const rawEname = arg("ename");
const count = Number.parseInt(arg("count", "8"), 10);
const withPhotos = !argv.includes("--no-photos");
const photoKb = Number.parseInt(arg("photo-kb", "250"), 10);

if (!rawEname) {
    console.error(
        "Usage: node scripts/seed-social-bindings.mjs --ename @your-ename [--count 8]\n\n" +
            "Find your eName in the wallet (eName card), or in the Safari Web Inspector\n" +
            "console — it looks like @a56dfc50-a3ba-5828-ab64-47194a27f1e6.",
    );
    process.exit(1);
}
if (!Number.isInteger(count) || count < 1) {
    console.error(`--count must be a positive integer, got: ${arg("count")}`);
    process.exit(1);
}
if (withPhotos && (!Number.isInteger(photoKb) || photoKb < 1)) {
    console.error(`--photo-kb must be a positive integer, got: ${arg("photo-kb")}`);
    process.exit(1);
}

const at = (e) => (e.startsWith("@") ? e : `@${e}`);
const SELF = at(rawEname);

// --- primitives ---------------------------------------------------------

/** Mirror of evault-core's stableStringify (binding-document-hash.ts:7). */
function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    const keys = Object.keys(value).sort();
    return `{${keys
        .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
        .join(",")}}`;
}

/**
 * The server recomputes this over the *validated* data and accepts an exact
 * match as a valid signature, so the payload must carry exactly the keys
 * validateBindingDocumentData returns — no more, no less.
 */
function docHash(subject, type, data) {
    return createHash("sha256")
        .update(Buffer.from(stableStringify({ subject, type, data }), "utf8"))
        .digest("hex");
}

async function gql(gqlUrl, eName, query, variables) {
    const res = await fetch(gqlUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-ENAME": eName,
            ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
        },
        body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error(`${gqlUrl} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    if (json.errors?.length) {
        throw new Error(json.errors.map((e) => e.message).join("; "));
    }
    return json.data;
}

const CREATE_BINDING_DOC = `
    mutation CreateBindingDoc($input: CreateBindingDocumentInput!) {
        createBindingDocument(input: $input) {
            metaEnvelopeId
            errors { message code }
        }
    }
`;

const ADD_SIGNATURE = `
    mutation AddSignature($input: CreateBindingDocumentSignatureInput!) {
        createBindingDocumentSignature(input: $input) {
            bindingDocument { subject signatures { signer } }
            errors { message code }
        }
    }
`;

async function createBindingDoc(gqlUrl, vaultEname, subject, type, data, signer) {
    const payload = await gql(gqlUrl, vaultEname, CREATE_BINDING_DOC, {
        input: {
            subject,
            type,
            data,
            ownerSignature: {
                signer,
                signature: docHash(subject, type, data),
                timestamp: new Date().toISOString(),
            },
        },
    });
    const result = payload.createBindingDocument;
    if (result.errors?.length) {
        throw new Error(result.errors.map((e) => e.message).join("; "));
    }
    if (!result.metaEnvelopeId) {
        throw new Error(`createBindingDocument(${type}) returned no metaEnvelopeId`);
    }
    return result.metaEnvelopeId;
}

async function counterSign(gqlUrl, vaultEname, docId, subject, type, data, signer) {
    const payload = await gql(gqlUrl, vaultEname, ADD_SIGNATURE, {
        input: {
            bindingDocumentId: docId,
            signature: {
                signer,
                signature: docHash(subject, type, data),
                timestamp: new Date().toISOString(),
            },
        },
    });
    const result = payload.createBindingDocumentSignature;
    if (result.errors?.length) {
        throw new Error(result.errors.map((e) => e.message).join("; "));
    }
}

async function resolveVaultUri(ename) {
    const url = new URL(
        `resolve?w3id=${encodeURIComponent(ename)}`,
        REGISTRY_URL,
    ).toString();
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(
            `registry resolve ${ename} -> HTTP ${res.status} (${url})`,
        );
    }
    const json = await res.json();
    if (!json?.uri) throw new Error(`registry returned no uri for ${ename}`);
    return json.uri;
}

async function provisionVault() {
    const entropyRes = await fetch(new URL("/entropy", REGISTRY_URL).toString());
    if (!entropyRes.ok) {
        throw new Error(`registry /entropy -> HTTP ${entropyRes.status}`);
    }
    const { token: registryEntropy } = await entropyRes.json();
    if (!registryEntropy) throw new Error("registry /entropy returned no token");

    const res = await fetch(new URL("/provision", PROVISIONER_URL).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            registryEntropy,
            namespace: randomUUID(),
            verificationId: DEMO_VERIFICATION_CODE,
        }),
    });
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error(`provisioner -> HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    if (!json.success || !json.w3id || !json.uri) {
        throw new Error(`provision failed: ${text.slice(0, 300)}`);
    }
    return { ename: at(json.w3id), uri: json.uri };
}

// --- main ---------------------------------------------------------------

async function seedOne(index, selfGqlUrl) {
    const name = FAKE_NAMES[index % FAKE_NAMES.length];
    const suffix = index >= FAKE_NAMES.length ? ` ${Math.floor(index / FAKE_NAMES.length) + 1}` : "";
    const displayName = `${name}${suffix}`;
    const relation = RELATIONS[index % RELATIONS.length];

    const peer = await provisionVault();
    const peerGqlUrl = new URL("/graphql", peer.uri).toString();

    // Display name, so the list shows a person instead of a raw eName.
    const selfData = { kind: "self", name: displayName };
    await createBindingDoc(
        peerGqlUrl,
        peer.ename,
        peer.ename,
        "self",
        selfData,
        peer.ename,
    );

    // A photo blob, because the Full List pulls every doc type from each
    // counterparty vault. Random bytes: incompressible, like a real JPEG.
    if (withPhotos) {
        const photoData = {
            photoBlob: randomBytes(Math.ceil((photoKb * 1024 * 3) / 4)).toString(
                "base64",
            ),
            description: "Seeded portrait",
        };
        await createBindingDoc(
            peerGqlUrl,
            peer.ename,
            peer.ename,
            "photograph",
            photoData,
            peer.ename,
        );
    }

    // Primary doc: lives in the counterparty's vault, signed by us first.
    const primaryData = {
        kind: "social_connection",
        name: displayName,
        parties: [SELF, peer.ename],
        relation_description: relation,
    };
    const primaryId = await createBindingDoc(
        peerGqlUrl,
        peer.ename,
        peer.ename,
        "social_connection",
        primaryData,
        SELF,
    );

    // They counter-sign -> 2 signatures -> the binding reads as confirmed.
    await counterSign(
        peerGqlUrl,
        peer.ename,
        primaryId,
        peer.ename,
        "social_connection",
        primaryData,
        peer.ename,
    );

    // Our single-signature mirror. This is what puts the binding in our list,
    // with role "sent" -> reconciled against their vault on every load.
    const mirrorData = {
        kind: "social_connection",
        name: displayName,
        parties: [SELF, peer.ename],
        relation_description: relation,
    };
    await createBindingDoc(
        selfGqlUrl,
        SELF,
        SELF,
        "social_connection",
        mirrorData,
        SELF,
    );

    return { displayName, ename: peer.ename };
}

async function main() {
    console.log(`registry:    ${REGISTRY_URL}`);
    console.log(`provisioner: ${PROVISIONER_URL}`);
    console.log(`token:       ${TOKEN ? "present" : "MISSING (writes will fail)"}`);
    console.log(`target:      ${SELF}`);
    console.log(`count:       ${count}`);
    console.log(
        `photos:      ${withPhotos ? `${photoKb} KB per counterparty` : "disabled"}\n`,
    );

    const selfUri = await resolveVaultUri(SELF);
    const selfGqlUrl = new URL("/graphql", selfUri).toString();
    console.log(`Resolved your vault -> ${selfUri}\n`);

    const seeded = [];
    for (let i = 0; i < count; i++) {
        const label = `[${i + 1}/${count}]`;
        try {
            const { displayName, ename } = await seedOne(i, selfGqlUrl);
            seeded.push({ displayName, ename });
            console.log(`${label} ${displayName.padEnd(20)} ${ename}`);
        } catch (err) {
            console.error(`${label} FAILED: ${err.message}`);
        }
    }

    console.log(
        `\nSeeded ${seeded.length}/${count} social bindings onto ${SELF}.`,
    );
    if (seeded.length) {
        console.log(
            "Open the wallet -> Social Bindings -> Full List. Each contact costs a\n" +
                "registry resolve + a paginated read of their vault + a name lookup.",
        );
    }
}

main().catch((err) => {
    console.error(`\nFatal: ${err.message}`);
    process.exit(1);
});
