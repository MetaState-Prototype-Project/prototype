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
 * one otherwise - by deleting and recreating rather than PATCHing when one
 * already exists, since PATCH silently ignores a changed secret (see the
 * comment above the delete-then-recreate call below).
 *
 * Uses FORGEJO_PROVISIONING_TOKEN, not FORGEJO_ADMIN_TOKEN - confirmed live,
 * not just from source: /admin/hooks requires AccessTokenScopeCategoryAdmin
 * (routers/api/v1/api.go:1415, "write:admin" for a create/update), which
 * FORGEJO_ADMIN_TOKEN deliberately does NOT carry - it only needs
 * read:user,read:repository for what the running service actually does
 * forever. Provisioning a webhook is a one-time operator action; the
 * always-on service should not sit on a credential that could also rewrite
 * every system webhook, when it never needs to. Falls back to
 * FORGEJO_ADMIN_TOKEN if the narrower token isn't set, so a single-token
 * setup still works - just with a wider blast radius than necessary.
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
    const adminToken =
        process.env.FORGEJO_PROVISIONING_TOKEN?.trim() ||
        required("FORGEJO_ADMIN_TOKEN");
    const webhookSecret = required("FORGEJO_WEBHOOK_SECRET");
    const publicUrl = required("FORGEJO_SYNC_PUBLIC_URL").replace(/\/+$/, "");
    const webhookUrl = `${publicUrl}/webhook`;

    const authHeaders = {
        Authorization: `token ${adminToken}`,
        "Content-Type": "application/json",
    };

    // Two traps in the same endpoint, both confirmed live against a running
    // GitW3, not just from source - neither produces an error, which is what
    // makes them dangerous.
    //
    // 1. `active` defaults to false (CreateHookOption.Active bool, zero
    //    value) if omitted. Omitting it still returns 201 with a real hook id
    //    - Site Administration shows it, GET /admin/hooks lists it - but it
    //    silently never delivers a single push.
    // 2. POST /admin/hooks creates a "default" webhook, NOT a system one,
    //    unless config.is_system_webhook is the *string* "true"
    //    (routers/api/v1/utils/hook.go's addHook: `isSystemWebhook` only
    //    becomes true when `form.Config["is_system_webhook"]` parses truthy;
    //    the field isn't in CreateHookOption's documented shape at all, it's
    //    read out of the free-form `config` map). A default webhook is only
    //    copied into repos created *after* it's added - it does not apply
    //    retroactively to existing repos, and GetSystemWebhooks
    //    (models/webhook/webhook_system.go) filters `is_system_webhook=true`,
    //    so it is invisible to GET /admin/hooks too. Confirmed by reproducing
    //    it: without this field, the create call returns 201, but the hook
    //    never appears in a follow-up GET /admin/hooks and would silently
    //    miss every already-existing repo - exactly the "sync every push"
    //    requirement this service exists to satisfy.
    //
    // Both are passed explicitly, every time, on both create and update.
    const body = {
        type: "forgejo",
        config: {
            url: webhookUrl,
            content_type: "json",
            secret: webhookSecret,
            is_system_webhook: "true",
        },
        events: ["push"],
        active: true,
    };

    const hooks = await listAllHooks(forgejoApiUrl, adminToken);
    const existing = hooks.find((h) => h.url === webhookUrl);

    // A fourth trap, found only by testing a secret rotation live, not by
    // re-reading source harder: `PATCH /admin/hooks/{id}` (editHook,
    // routers/api/v1/utils/hook.go) updates `url`, `content_type`, events,
    // branch_filter and the authorization header from `config` - but never
    // reads `config["secret"]` at all. Reproduced directly: PATCHing an
    // existing hook with a new FORGEJO_WEBHOOK_SECRET returns 200, and
    // GET /admin/hooks shows nothing wrong (secret is never echoed back by
    // any Forgejo API, by design) - but the hook keeps signing with
    // whatever secret it was *created* with, forever. The next real push's
    // delivery comes back 401 "invalid signature" against the new secret,
    // silently, exactly like the `active`/`is_system_webhook` traps above.
    // So a secret rotation is not a PATCH - it's delete-then-recreate,
    // since only `addHook` (the POST path) reads `config["secret"]`.
    if (existing) {
        console.log(
            `secret rotation: deleting + recreating system webhook (id ${existing.id}) -> ${webhookUrl} ` +
                "(PATCH /admin/hooks/{id} silently ignores config.secret - see comment above)",
        );
        const del = await fetch(
            `${forgejoApiUrl}/api/v1/admin/hooks/${existing.id}`,
            { method: "DELETE", headers: authHeaders },
        );
        if (!del.ok && del.status !== 404) {
            throw new Error(
                `DELETE /admin/hooks/${existing.id} failed: HTTP ${del.status}`,
            );
        }
    } else {
        console.log(`creating system webhook -> ${webhookUrl}`);
    }

    const res = await fetch(`${forgejoApiUrl}/api/v1/admin/hooks`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        throw new Error(`POST /admin/hooks failed: HTTP ${res.status}`);
    }

    console.log(
        "done - verify Active is on in Site Administration -> Webhooks, not just that the row exists.",
    );
}

main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});
