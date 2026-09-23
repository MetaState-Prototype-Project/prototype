#!/usr/bin/env node
/**
 * Generates the catalog served at PUBLIC_TRANSLATIONS_URL from the message
 * files. Keys the app refuses are left out, or every launch logs rejections.
 *
 *   node scripts/build-translations-catalog.mjs            write the file
 *   node scripts/build-translations-catalog.mjs --check    fail if it is stale
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const walletRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(walletRoot, "../..");
const OUTPUT = resolve(repoRoot, "docs/static/translations.json");

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const policy = readJson(resolve(walletRoot, "src/lib/i18n/policy.json"));
const { locales } = readJson(
    resolve(walletRoot, "project.inlang/settings.json"),
);

const isProtected = (key) =>
    policy.protectedPrefixes.some((prefix) => key.startsWith(prefix));

function build() {
    const base = readJson(resolve(walletRoot, "messages/en.json"));
    const skipped = { protected: 0, plural: 0 };
    const messages = {};

    for (const locale of locales) {
        const translations = readJson(
            resolve(walletRoot, `messages/${locale}.json`),
        );
        const entries = {};

        // Driven by the English file so ordering is stable across locales.
        for (const [key, value] of Object.entries(base)) {
            if (key === "$schema") continue;
            if (Array.isArray(value)) {
                skipped.plural++;
                continue;
            }
            if (isProtected(key)) {
                skipped.protected++;
                continue;
            }
            // Absent here: the compiled message already falls back to English.
            if (typeof translations[key] === "string") {
                entries[key] = translations[key];
            }
        }
        messages[locale] = entries;
    }

    const perLocale = locales.length;
    return {
        json: `${JSON.stringify({ version: policy.formatVersion, messages }, null, 2)}\n`,
        counts: {
            published: Object.values(messages).map(
                (m) => Object.keys(m).length,
            ),
            protected: skipped.protected / perLocale,
            plural: skipped.plural / perLocale,
        },
    };
}

const { json, counts } = build();
const where = relative(repoRoot, OUTPUT);

if (process.argv.includes("--check")) {
    let current = null;
    try {
        current = readFileSync(OUTPUT, "utf8");
    } catch {
    }
    if (current !== json) {
        console.error(
            `${where} is out of date. Run \`pnpm translations:build\` and commit the result.`,
        );
        process.exit(1);
    }
    console.log(`${where} is up to date.`);
} else {
    writeFileSync(OUTPUT, json);
    console.log(
        `${where}: ${counts.published.join("/")} keys for ${locales.join("/")}` +
            ` (${counts.protected} protected and ${counts.plural} plural keys excluded)`,
    );
}
