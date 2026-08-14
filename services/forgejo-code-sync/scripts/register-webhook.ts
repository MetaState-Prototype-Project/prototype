#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
/**
 * Registers - or updates - the system webhook GitW3 sends every push to.
 *
 * Unlike the bridge's authentication source (registered via the `gitea` CLI
 * against the shared data volume, see docker/gitw3-register-auth-source.sh),
 * there is no CLI subcommand for webhooks at all - checked directly against
 * GitW3's `cmd/` source, nothing matches. This is why the mechanism here is
 * the Admin REST API (`POST /api/v1/admin/hooks`,
 * routers/api/v1/admin/hooks.go's `CreateHook`) instead: a "system webhook",
 * scoped instance-wide, exactly what Site Administration's UI would create by
 * hand. Idempotent, so it can run on every deploy: it updates the existing
 * hook when one already points at this service's /webhook URL, and creates
 * one otherwise.
 *
 * Run from the repository root:
 *   pnpm --filter forgejo-code-sync register-webhook
 */
import { config as loadEnv } from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../../../.env") });

function required(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

interface Hook {
    id: number;
    url: string;
    active: boolean;
}

/**
 * Pages through every system webhook. `GET /admin/hooks` is paginated
 * (`page`/`limit` query params, routers/api/v1/admin/hooks.go's `ListHooks`)
 * - a naive single-page fetch would miss an existing hook past the default
 * page size and register a duplicate instead of updating it.
 */
async function listAllHooks(
    forgejoApiUrl: string,
    adminToken: string,
): Promise<Hook[]> {
    const hooks: Hook[] = [];
    for (let page = 1; ; page++) {
        const res = await fetch(
            `${forgejoApiUrl}/api/v1/admin/hooks?page=${page}&limit=50`,
            { headers: { Authorization: `token ${adminToken}` } },
        );
        if (!res.ok) {
            throw new Error(`GET /admin/hooks failed: HTTP ${res.status}`);
        }
        const page_ = (await res.json()) as Hook[];
        if (page_.length === 0) break;
        hooks.push(...page_);
    }
    return hooks;
}

async function main(): Promise<void> {
    const forgejoApiUrl = required("FORGEJO_API_URL").replace(/\/+$/, "");
    const adminToken = required("FORGEJO_ADMIN_TOKEN");
    const webhookSecret = required("FORGEJO_WEBHOOK_SECRET");
    const publicUrl = required("FORGEJO_SYNC_PUBLIC_URL").replace(/\/+$/, "");
    const webhookUrl = `${publicUrl}/webhook`;

    const authHeaders = {
        Authorization: `token ${adminToken}`,
        "Content-Type": "application/json",
    };

    // The trap this whole script exists to avoid: `active` defaults to false
    // (CreateHookOption.Active bool, zero value) if omitted. A request that
    // omits it still returns 201 with a real hook id - Site Administration
    // shows it, GET /admin/hooks lists it - but it silently never delivers a
    // single push. Passed explicitly, every time, on both create and update.
    const body = {
        type: "forgejo",
        config: {
            url: webhookUrl,
            content_type: "json",
            secret: webhookSecret,
        },
        events: ["push"],
        active: true,
    };

    const hooks = await listAllHooks(forgejoApiUrl, adminToken);
    const existing = hooks.find((h) => h.url === webhookUrl);

    if (existing) {
        console.log(
            `updating system webhook (id ${existing.id}) -> ${webhookUrl}`,
        );
        const res = await fetch(
            `${forgejoApiUrl}/api/v1/admin/hooks/${existing.id}`,
            {
                method: "PATCH",
                headers: authHeaders,
                body: JSON.stringify(body),
            },
        );
        if (!res.ok) {
            throw new Error(
                `PATCH /admin/hooks/${existing.id} failed: HTTP ${res.status}`,
            );
        }
    } else {
        console.log(`creating system webhook -> ${webhookUrl}`);
        const res = await fetch(`${forgejoApiUrl}/api/v1/admin/hooks`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            throw new Error(`POST /admin/hooks failed: HTTP ${res.status}`);
        }
    }

    console.log(
        "done - verify Active is on in Site Administration -> Webhooks, not just that the row exists.",
    );
}

main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});
