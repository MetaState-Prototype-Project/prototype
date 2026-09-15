#!/usr/bin/env node
/**
 * Seed an `id_document` binding doc onto an existing eVault, so the home screen
 * renders a Legal ID and a VERIFIED badge without a real KYC run.
 *
 * Why this exists: on the iOS Simulator you can't complete Didit verification
 * (no camera), so an anonymous-onboarded account has `isFake = true` and no
 * id_document. The home derives `verified = isFake === false || legalId !== null`
 * (main/+page.svelte), so the badge is permanently UNVERIFIED — and the #1086
 * "loses its verified state" bug has nothing to lose. This gives it something.
 *
 * The payload is exactly what ProvisioningService.createBindingDocumentForUser
 * writes in the real flow (ProvisioningService.ts:154): { vendor, reference,
 * name }. Nothing else — validateBindingDocumentData drops unknown keys
 * silently (BindingDocumentService.ts:42-53), and the legacy-signature hash is
 * computed over the VALIDATED data, so an extra key (e.g. a `kind`, which this
 * type does NOT take) would make the hash mismatch and surface as the very
 * misleading "Invalid owner signature".
 *
 * Usage:
 *   node scripts/seed-legal-id.mjs --ename @your-ename [--name "Julien Connault"]
 *
 * Reads PUBLIC_REGISTRY_URL / PUBLIC_EID_WALLET_TOKEN from the repo-root .env.
 */

import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

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
const TOKEN = env("PUBLIC_EID_WALLET_TOKEN", "");

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const rawEname = arg("ename");
const fullName = arg("name", "Julien Connault");

if (!rawEname) {
    console.error(
        "Usage: node scripts/seed-legal-id.mjs --ename @your-ename [--name \"Full Name\"]",
    );
    process.exit(1);
}

const at = (e) => (e.startsWith("@") ? e : `@${e}`);
const SELF = at(rawEname);

/** Mirror of evault-core's stableStringify (binding-document-hash.ts:7). */
function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    const keys = Object.keys(value).sort();
    return `{${keys
        .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
        .join(",")}}`;
}

function docHash(subject, type, data) {
    return createHash("sha256")
        .update(Buffer.from(stableStringify({ subject, type, data }), "utf8"))
        .digest("hex");
}

const CREATE_BINDING_DOC = `
    mutation CreateBindingDoc($input: CreateBindingDocumentInput!) {
        createBindingDocument(input: $input) {
            metaEnvelopeId
            errors { message code }
        }
    }
`;

async function main() {
    const resolveUrl = new URL(
        `resolve?w3id=${encodeURIComponent(SELF)}`,
        REGISTRY_URL,
    ).toString();
    const resolveRes = await fetch(resolveUrl);
    if (!resolveRes.ok) {
        throw new Error(`registry resolve -> HTTP ${resolveRes.status}`);
    }
    const { uri } = await resolveRes.json();
    if (!uri) throw new Error(`registry returned no uri for ${SELF}`);
    const gqlUrl = new URL("/graphql", uri).toString();

    console.log(`registry: ${REGISTRY_URL}`);
    console.log(`vault:    ${uri}`);
    console.log(`target:   ${SELF}`);
    console.log(`name:     ${fullName}\n`);

    // Exactly the three keys validateBindingDocumentData keeps. No `kind`.
    const data = {
        vendor: "didit",
        reference: randomUUID(),
        name: fullName,
    };

    const res = await fetch(gqlUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-ENAME": SELF,
            ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
        },
        body: JSON.stringify({
            query: CREATE_BINDING_DOC,
            variables: {
                input: {
                    subject: SELF,
                    type: "id_document",
                    data,
                    ownerSignature: {
                        signer: SELF,
                        signature: docHash(SELF, "id_document", data),
                        timestamp: new Date().toISOString(),
                    },
                },
            },
        }),
    });

    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    if (json.errors?.length) {
        throw new Error(json.errors.map((e) => e.message).join("; "));
    }
    const result = json.data?.createBindingDocument;
    if (result?.errors?.length) {
        throw new Error(result.errors.map((e) => e.message).join("; "));
    }
    if (!result?.metaEnvelopeId) {
        throw new Error(`no metaEnvelopeId returned: ${text.slice(0, 300)}`);
    }

    console.log(`Created id_document ${result.metaEnvelopeId}`);
    console.log(
        "\nReload the wallet home: Legal ID should populate and the eName badge\n" +
            "should read VERIFIED (legalId !== null is enough — isFake stays true).",
    );
}

main().catch((err) => {
    console.error(`\nFatal: ${err.message}`);
    process.exit(1);
});
