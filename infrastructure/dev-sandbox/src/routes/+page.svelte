<script lang="ts">
import { browser } from "$app/environment";
import { env } from "$env/dynamic/public";
import { PersistingWebCryptoAdapter } from "$lib/PersistingWebCryptoAdapter";
import {
    createRandomUserProfile,
    storeUserProfileInEvault,
} from "$lib/userProfile";
import jsQR from "jsqr";
import { onMount } from "svelte";
import {
    provision,
    signPayload,
    syncPublicKeyToEvaultWithOptions,
} from "wallet-sdk";

// Ontology explorer: runtime server URL config
const ONTOLOGY_URL_STORAGE_KEY = "dev-sandbox-ontology-url";
let ontologyUrl: string = $state(env.PUBLIC_ONTOLOGY_URL ?? "https://ontology.w3ds.metastate.foundation");
let ontologies: { id: string; title: string }[] = $state([]);
let selectedOntologyId: string | null = $state(null);
let inspectorEName: string = $state("");
let schemasLoading = $state(false);
let schemasError: string | null = $state(null);

const config = {
    registryUrl: env.PUBLIC_REGISTRY_URL ?? "http://localhost:3001",
    provisionerUrl: env.PUBLIC_PROVISIONER_URL ?? "http://localhost:4321",
    platformName: env.PUBLIC_DEV_SANDBOX_PLATFORM_NAME ?? "dev-sandbox",
};

/** Demo verification code accepted by evault-core when DEMO_CODE_W3DS is set. */
const DEMO_VERIFICATION_ID = "d66b7138-538a-465f-a6ce-f6985854c3f4";

const IDENTITIES_STORAGE_KEY = "dev-sandbox-identities";
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

interface Identity {
    w3id: string;
    uri: string;
    keyId: string;
    bearerToken?: string;
    tokenExpiresAt?: number;
}

interface DebugInfo {
    method: string;
    url: string;
    body: Record<string, unknown>;
    keyId: string;
    w3id: string;
    publicKeyFingerprint?: string;
    responseStatus: number;
    responseBody: unknown;
}

type LogLevel = "info" | "success" | "error";
interface LogEntry {
    id: number;
    ts: string;
    level: LogLevel;
    message: string;
    detail?: string;
}

const adapter = new PersistingWebCryptoAdapter();
let logId = 0;
const MAX_LOG_ENTRIES = 300;
let logEntries: LogEntry[] = $state([]);

function addLog(level: LogLevel, message: string, detail?: string) {
    const entry: LogEntry = {
        id: ++logId,
        ts: new Date().toISOString(),
        level,
        message,
        detail,
    };
    logEntries = [...logEntries.slice(-(MAX_LOG_ENTRIES - 1)), entry];
}

let identities: Identity[] = $state<Identity[]>([]);
let selectedIndex = $state(0);
let hydrated = $state(false);

let provisionBusy = $state(false);
let provisionError = $state<string | null>(null);
let provisionSuccess = $state<Identity | null>(null);

let w3dsInput = $state("");
let actionBusy = $state(false);
let actionError = $state<string | null>(null);
let actionSuccess = $state<string | null>(null);

let qrDecodeBusy = $state(false);
let qrDecodeError = $state<string | null>(null);
let qrFileInputEl: HTMLInputElement | null = $state(null);

let signPayloadInput = $state("");
let signBusy = $state(false);
let signResult = $state<string | null>(null);
let signError = $state<string | null>(null);

let lastDebug = $state<DebugInfo | null>(null);

const selectedIdentity = $derived(identities[selectedIndex] ?? null);

function loadIdentities(): Identity[] {
    try {
        const raw = localStorage.getItem(IDENTITIES_STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as Identity[];
    } catch {
        return [];
    }
}

function saveIdentities(list: Identity[]): void {
    localStorage.setItem(IDENTITIES_STORAGE_KEY, JSON.stringify(list));
}

function setDebug(info: DebugInfo): void {
    lastDebug = info;
}

async function ensurePlatformToken(identity: Identity): Promise<string> {
    const now = Date.now();
    if (
        identity.bearerToken &&
        identity.tokenExpiresAt &&
        identity.tokenExpiresAt - now > TOKEN_REFRESH_THRESHOLD_MS
    ) {
        return identity.bearerToken;
    }
    const res = await fetch(
        new URL("/platforms/certification", config.registryUrl).toString(),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform: config.platformName }),
        },
    );
    if (!res.ok) throw new Error(`Platform token failed: ${res.status}`);
    const data = (await res.json()) as {
        token: string;
        expiresAt?: number;
    };
    const token = data.token;
    const expiresAt = data.expiresAt ?? now + 3600000;
    const idx = identities.indexOf(identity);
    if (idx >= 0) {
        const next = [...identities];
        next[idx] = {
            ...identity,
            bearerToken: token,
            tokenExpiresAt: expiresAt,
        };
        identities = next;
        saveIdentities(next);
    }
    return token;
}

// Init on client: load identities and restore ontology URL
onMount(async () => {
    const list = loadIdentities();
    identities = list;
    if (list.length > 0) {
        await adapter.hydrateFromStorage(list.map((i) => i.keyId));
    }
    if (browser) {
        const saved = localStorage.getItem(ONTOLOGY_URL_STORAGE_KEY);
        if (saved) {
            ontologyUrl = saved;
            await loadOntologies();
        }
    }
    hydrated = true;
});

// persist ontology URL explicitly when changed via input
function saveOntologyUrl(): void {
    localStorage.setItem(ONTOLOGY_URL_STORAGE_KEY, ontologyUrl);
}
// Debounce schema reload when ontologyUrl changes
let urlDebounce: ReturnType<typeof setTimeout>;
$effect(() => {
    if (browser && hydrated && ontologyUrl) {
        saveOntologyUrl();
        clearTimeout(urlDebounce);
        urlDebounce = setTimeout(() => loadOntologies(), 500);
    }
});
async function loadOntologies(): Promise<void> {
    if (!ontologyUrl) {
        schemasError = "Enter a valid ontology URL";
        return;
    }
    schemasLoading = true;
    schemasError = null;
    try {
        const url = `${ontologyUrl.replace(/\/+$/, "")}/schemas`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { id: string; title: string }[];
        ontologies = data;
    } catch (e) {
        schemasError = e instanceof Error ? e.message : String(e);
    } finally {
        schemasLoading = false;
    }
}

// MetaEnvelope list state and pagination
let envelopes: { id: string; ontology: string; parsed: unknown }[] = $state([]);
let pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
    endCursor: string;
} = $state({
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: "",
    endCursor: "",
});
let totalCount: number = $state(0);
let pageLoading = $state(false);
let pageError: string | null = $state(null);
let pageSize = 10;
let afterCursor: string | null = $state(null);
let beforeCursor: string | null = $state(null);
let pageOffset: number = $state(0);
let currentTab = $state<string>("sandbox");

// Expanded envelope IDs set
let expandedIds = $state(new Set<string>());
function toggleExpand(id: string) {
    const next = new Set(expandedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    expandedIds = next;
}

function highlightJson(json: string): string {
    return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
        (match) => {
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    const key = match.slice(0, -1);
                    return `<span class="json-key">${key}</span>:`;
                }
                return `<span class="json-string">${match}</span>`;
            }
            if (/true|false/.test(match)) {
                return `<span class="json-bool">${match}</span>`;
            }
            if (/null/.test(match)) {
                return `<span class="json-null">${match}</span>`;
            }
            return `<span class="json-num">${match}</span>`;
        },
    );
}

async function loadMetaEnvelopes(): Promise<void> {
    if (!selectedOntologyId || !selectedIdentity) return;
    pageLoading = true;
    pageError = null;
    try {
        const token = await ensurePlatformToken(selectedIdentity);
        const gqlUrl = `${selectedIdentity.uri.replace(/\/+$/, "")}/graphql`;
        const useBefore = beforeCursor !== null;
        const query = useBefore
            ? "query ($ontologyId: ID!, $last: Int, $before: String) {\n  metaEnvelopes(filter: {ontologyId: $ontologyId}, last: $last, before: $before) {\n    edges { cursor node { id ontology parsed } }\n    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }\n    totalCount\n  }\n}"
            : "query ($ontologyId: ID!, $first: Int, $after: String) {\n  metaEnvelopes(filter: {ontologyId: $ontologyId}, first: $first, after: $after) {\n    edges { cursor node { id ontology parsed } }\n    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }\n    totalCount\n  }\n}";
        const variables = useBefore
            ? { ontologyId: selectedOntologyId, last: pageSize, before: beforeCursor }
            : { ontologyId: selectedOntologyId, first: pageSize, after: afterCursor };
        const res = await fetch(gqlUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-ENAME": inspectorEName || selectedIdentity.w3id,
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ query, variables }),
        });
        const json = await res.json();
        const data = json.data.metaEnvelopes;
        envelopes = data.edges.map(
            (e: {
                node: { id: string; ontology: string; parsed: unknown };
            }) => e.node,
        );
        pageInfo = data.pageInfo;
        totalCount = data.totalCount;
        expandedIds = new Set<string>();
    } catch (e) {
        pageError = e instanceof Error ? e.message : String(e);
    } finally {
        pageLoading = false;
    }
}

function goNextPage() {
    beforeCursor = null;
    afterCursor = pageInfo.endCursor;
    pageOffset += envelopes.length;
    loadMetaEnvelopes();
}

function goPrevPage() {
    afterCursor = null;
    beforeCursor = pageInfo.startCursor;
    pageOffset = Math.max(0, pageOffset - pageSize);
    loadMetaEnvelopes();
}

function loadEnvelopes() {
    afterCursor = null;
    beforeCursor = null;
    pageOffset = 0;
    envelopes = [];
    totalCount = 0;
    pageInfo = { hasNextPage: false, hasPreviousPage: false, startCursor: "", endCursor: "" };
    loadMetaEnvelopes();
}

async function doProvision() {
    provisionBusy = true;
    provisionError = null;
    provisionSuccess = null;
    addLog("info", "Provisioning new eVault…");
    try {
        const { keyId } = await adapter.generateKeyPair();
        const result = await provision(adapter, {
            registryUrl: config.registryUrl,
            provisionerUrl: config.provisionerUrl,
            namespace: crypto.randomUUID(),
            verificationId: DEMO_VERIFICATION_ID,
            keyId,
            context: "onboarding",
        });
        const identity: Identity = {
            w3id: result.w3id,
            uri: result.uri,
            keyId,
        };
        identities = [...identities, identity];
        selectedIndex = identities.length - 1;
        saveIdentities(identities);
        provisionSuccess = identity;
        addLog("success", "Provisioned", `${result.w3id}`);
        try {
            const tokenRes = await fetch(
                new URL(
                    "/platforms/certification",
                    config.registryUrl,
                ).toString(),
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ platform: config.platformName }),
                },
            );
            if (tokenRes.ok) {
                const data = (await tokenRes.json()) as {
                    token: string;
                    expiresAt?: number;
                };
                const now = Date.now();
                const next = [...identities];
                next[next.length - 1] = {
                    ...next[next.length - 1],
                    bearerToken: data.token,
                    tokenExpiresAt: data.expiresAt ?? now + 3600000,
                };
                identities = next;
                saveIdentities(next);
            }
        } catch {
            // Token optional; sync will request it later
        }

        // Auto-sync public key (same as eID: sync by default)
        addLog("info", "Syncing public key…");
        try {
            const token = await ensurePlatformToken(identity);
            await syncPublicKeyToEvaultWithOptions({
                evaultUrl: identity.uri,
                eName: identity.w3id,
                cryptoAdapter: adapter,
                keyId: identity.keyId,
                context: "onboarding",
                token,
            });
            addLog("success", "Public key synced");
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            addLog("error", "Public key sync failed", msg);
        }

        // Auto-create UserProfile with falso random data (username = ename.replace("@", "") like eID)
        addLog("info", "Creating UserProfile…");
        try {
            const profile = await createRandomUserProfile(identity.w3id);
            await storeUserProfileInEvault(
                identity.uri,
                identity.w3id,
                profile,
            );
            addLog("success", "UserProfile created", profile.displayName);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            addLog("error", "UserProfile failed", msg);
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        provisionError = msg;
        addLog("error", "Provision failed", msg);
    } finally {
        provisionBusy = false;
    }
}

function parseW3dsUri(
    input: string,
): { type: "auth" | "sign"; url: URL } | null {
    const trimmed = input.trim();
    let parseable = trimmed;
    if (trimmed.startsWith("w3ds://")) {
        parseable = trimmed.replace("w3ds://", "https://w3ds.dummy/");
    }
    try {
        const url = new URL(parseable);
        if (
            trimmed.startsWith("w3ds://auth") ||
            (trimmed.includes("/api/auth") && url.searchParams.has("session"))
        ) {
            return { type: "auth", url };
        }
        if (
            trimmed.startsWith("w3ds://sign") ||
            url.searchParams.has("redirect_uri")
        ) {
            return { type: "sign", url };
        }
        return null;
    } catch {
        return null;
    }
}

/** Decode QR code from image blob; returns decoded text or null. */
function decodeQrFromImageBlob(blob: Blob): Promise<string | null> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                resolve(null);
                return;
            }
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            );
            const code = jsQR(
                imageData.data,
                imageData.width,
                imageData.height,
            );
            resolve(code?.data ?? null);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };
        img.src = url;
    });
}

async function handleQrImageFromBlob(blob: Blob) {
    qrDecodeBusy = true;
    qrDecodeError = null;
    try {
        const text = await decodeQrFromImageBlob(blob);
        if (text) {
            w3dsInput = text.trim();
            actionError = null;
            addLog(
                "info",
                "Decoded QR",
                text.slice(0, 50) + (text.length > 50 ? "…" : ""),
            );
        } else {
            qrDecodeError = "No QR code found in image.";
        }
    } catch {
        qrDecodeError = "Failed to decode image.";
    } finally {
        qrDecodeBusy = false;
    }
}

function handleQrFileSelect(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file?.type.startsWith("image/")) {
        handleQrImageFromBlob(file);
    } else if (file) {
        qrDecodeError = "Please choose an image file.";
    }
    input.value = "";
}

function handlePaste(e: ClipboardEvent) {
    const item = Array.from(e.clipboardData?.items ?? []).find((it) =>
        it.type.startsWith("image/"),
    );
    const file = item?.getAsFile();
    if (file) {
        e.preventDefault();
        handleQrImageFromBlob(file);
    }
}

async function performW3dsAction() {
    if (!selectedIdentity) {
        actionError = "Select or create an identity first.";
        return;
    }
    const parsed = parseW3dsUri(w3dsInput);
    if (!parsed) {
        actionError =
            "Paste a w3ds://auth or w3ds://sign URI (or HTTP URL with session/redirect_uri).";
        return;
    }
    actionBusy = true;
    actionError = null;
    actionSuccess = null;
    addLog(
        "info",
        `Perform ${parsed.type}`,
        `${parsed.url.toString().slice(0, 60)}…`,
    );
    try {
        const { type, url } = parsed;
        if (type === "auth") {
            const redirectUrl = url.searchParams.get("redirect") ?? "";
            const sessionId = url.searchParams.get("session") ?? "";
            const signature = await signPayload({
                cryptoAdapter: adapter,
                keyId: selectedIdentity.keyId,
                context: "onboarding",
                payload: sessionId,
            });
            const body = {
                ename: selectedIdentity.w3id,
                session: sessionId,
                signature,
                appVersion: "1.0.0",
            };
            const res = await fetch(redirectUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const responseBody = await res.json().catch(() => ({}));
            setDebug({
                method: "POST",
                url: redirectUrl,
                body: {
                    ...body,
                    signature: `${String(signature).slice(-8)}…`,
                },
                keyId: selectedIdentity.keyId,
                w3id: selectedIdentity.w3id,
                responseStatus: res.status,
                responseBody,
            });
            if (!res.ok)
                throw new Error(
                    (responseBody as { error?: string })?.error ??
                        `HTTP ${res.status}`,
                );
            actionSuccess = "Auth succeeded.";
            addLog("success", "Auth succeeded", String(res.status));
        } else {
            const sessionId = url.searchParams.get("session") ?? "";
            const redirectUri = url.searchParams.get("redirect_uri") ?? "";
            const dataParam = url.searchParams.get("data") ?? "";
            if (!sessionId || !redirectUri) {
                actionError = "w3ds://sign needs session and redirect_uri.";
                return;
            }
            // Decode base64 data if present, otherwise fallback to sessionId
            let messageToSign = sessionId;
            if (dataParam) {
                try {
                    messageToSign = atob(dataParam);
                } catch {
                    messageToSign = dataParam;
                }
            }
            const signature = await signPayload({
                cryptoAdapter: adapter,
                keyId: selectedIdentity.keyId,
                context: "onboarding",
                payload: messageToSign,
            });
            const body = {
                sessionId,
                signature,
                w3id: selectedIdentity.w3id,
                message: messageToSign,
            };
            const res = await fetch(redirectUri, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const responseBody = await res.json().catch(() => ({}));
            setDebug({
                method: "POST",
                url: redirectUri,
                body: {
                    ...body,
                    signature: `${String(signature).slice(-8)}…`,
                },
                keyId: selectedIdentity.keyId,
                w3id: selectedIdentity.w3id,
                responseStatus: res.status,
                responseBody,
            });
            if (!res.ok)
                throw new Error(
                    (responseBody as { error?: string })?.error ??
                        `HTTP ${res.status}`,
                );
            actionSuccess = "Sign callback succeeded.";
            addLog("success", "Sign callback succeeded", String(res.status));
        }
    } catch (e) {
        actionError = e instanceof Error ? e.message : String(e);
        addLog("error", "Action failed", actionError);
    } finally {
        actionBusy = false;
    }
}

async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
}

async function doSign() {
    if (!selectedIdentity) return;
    signBusy = true;
    signError = null;
    signResult = null;
    addLog(
        "info",
        "Sign payload",
        signPayloadInput.slice(0, 40) +
            (signPayloadInput.length > 40 ? "…" : ""),
    );
    try {
        const sig = await signPayload({
            cryptoAdapter: adapter,
            keyId: selectedIdentity.keyId,
            context: "onboarding",
            payload: signPayloadInput,
        });
        signResult = sig;
        addLog("success", "Signed");
    } catch (e) {
        signError = e instanceof Error ? e.message : String(e);
        addLog("error", "Sign failed", signError);
    } finally {
        signBusy = false;
    }
}
</script>

<svelte:window onpaste={handlePaste} />
{#if !hydrated}
    <p class="loading">Loading…</p>
{:else}
    <div class="sandbox-layout">
        <main class="sandbox-main">
            <header class="sandbox-header">
                <h1>W3DS Dev Sandbox</h1>
                <p class="config">
                    Registry: <code>{config.registryUrl}</code> · Provisioner:
                    <code>{config.provisionerUrl}</code>
                </p>
            </header>
            <nav class="tab-bar">
                <button
                    class:active={currentTab === "sandbox"}
                    type="button"
                    onclick={() => (currentTab = "sandbox")}
                >
                    Wallet Sandbox
                </button>
                <button
                    class:active={currentTab === "inspector"}
                    type="button"
                    onclick={() => (currentTab = "inspector")}
                >
                    eVault Inspector
                </button>
            </nav>

            <div class="view view-sandbox" class:hidden={currentTab !== 'sandbox'}>
                <section class="card">
                    <h2>Provision new eVault</h2>
                    <button disabled={provisionBusy} onclick={doProvision}>
                        {provisionBusy ? "Provisioning…" : "Provision new eVault"}
                    </button>
                    {#if provisionError}
                        <p class="error">{provisionError}</p>
                    {/if}
                    {#if provisionSuccess}
                        <div class="result">
                            <p>
                                <strong>W3ID:</strong>
                                <code>{provisionSuccess.w3id}</code>
                                <button
                                    type="button"
                                    onclick={() =>
                                        copyToClipboard(provisionSuccess!.w3id)}
                                    >Copy</button
                                >
                            </p>
                            <p>
                                <strong>eVault URI:</strong>
                                <code>{provisionSuccess.uri}</code>
                                <button
                                    type="button"
                                    onclick={() =>
                                        copyToClipboard(provisionSuccess!.uri)}
                                    >Copy</button
                                >
                            </p>
                        </div>
                    {/if}
                </section>

                {#if identities.length > 0}
                    <section class="card">
                        <h2>Selected identity</h2>
                        <select bind:value={selectedIndex}>
                            {#each identities as id, i}
                                <option value={i}>{id.w3id}</option>
                            {/each}
                        </select>
                    </section>

                    <section class="card">
                        <h2>Paste any w3ds URI (auth, sign, voting)</h2>
                        <p>
                            Paste a <code>w3ds://auth</code> or
                            <code>w3ds://sign</code> URI (or HTTP URL with session/redirect_uri).
                            You can also upload or paste an image of a QR code to decode
                            the request.
                        </p>
                        <div class="w3ds-qr-actions">
                            <input
                                type="file"
                                accept="image/*"
                                onchange={handleQrFileSelect}
                                bind:this={qrFileInputEl}
                                class="sr-only"
                                id="qr-file-input"
                                aria-label="Upload QR image"
                            />
                            <button
                                type="button"
                                class="btn-link"
                                disabled={qrDecodeBusy}
                                onclick={() => qrFileInputEl?.click()}
                            >
                                {qrDecodeBusy ? "Decoding…" : "Upload QR image"}
                            </button>
                            <span class="muted">or paste an image (Ctrl+V)</span>
                        </div>
                        {#if qrDecodeError}
                            <p class="error">{qrDecodeError}</p>
                        {/if}
                        <textarea
                            bind:value={w3dsInput}
                            placeholder="w3ds://auth?redirect=...&session=... or w3ds://sign?session=...&data=...&redirect_uri=..."
                            rows="3"
                        ></textarea>
                        <button disabled={actionBusy} onclick={performW3dsAction}>
                            {actionBusy ? "Performing…" : "Perform"}
                        </button>
                        {#if actionError}
                            <p class="error">{actionError}</p>
                        {/if}
                        {#if actionSuccess}
                            <p class="success">{actionSuccess}</p>
                        {/if}
                    </section>

                    <section class="card">
                        <h2>Sign payload</h2>
                        <p>Sign a string with the selected identity's key.</p>
                        <input
                            type="text"
                            bind:value={signPayloadInput}
                            placeholder="Payload to sign"
                        />
                        <button disabled={signBusy} onclick={doSign}>
                            {signBusy ? "Signing…" : "Sign"}
                        </button>
                        {#if signError}
                            <p class="error">{signError}</p>
                        {/if}
                        {#if signResult}
                            <p>
                                <strong>Signature:</strong>
                                <code class="signature">{signResult}</code>
                                <button
                                    type="button"
                                    onclick={() => copyToClipboard(signResult!)}
                                    >Copy</button
                                >
                            </p>
                        {/if}
                    </section>

                    {#if lastDebug}
                        <section class="card debug">
                            <h2>Last action debug</h2>
                            <p>
                                <strong>Request:</strong>
                                {lastDebug.method}
                                {lastDebug.url}
                            </p>
                            <p><strong>Body:</strong></p>
                            <pre>{JSON.stringify(lastDebug.body, null, 2)}</pre>
                            <p>
                                <strong>Key used:</strong> keyId={lastDebug.keyId},
                                w3id={lastDebug.w3id}{#if lastDebug.publicKeyFingerprint}
                                    · fingerprint …{lastDebug.publicKeyFingerprint}{/if}
                            </p>
                            <p>
                                <strong>Response:</strong>
                                {lastDebug.responseStatus}
                            </p>
                            <pre>{typeof lastDebug.responseBody === "object"
                                    ? JSON.stringify(
                                          lastDebug.responseBody,
                                          null,
                                          2,
                                      )
                                    : String(lastDebug.responseBody)}</pre>
                        </section>
                    {/if}
                {/if}
            </div>

            <div class="view view-inspector" class:hidden={currentTab !== 'inspector'}>
                <section class="card">
                    <h2>MetaEnvelope Explorer</h2>
                    <div class="field">
                        <label for="inspectorEName"
                            ><strong>eName (X-ENAME):</strong></label
                        >
                        <input
                            id="inspectorEName"
                            type="text"
                            bind:value={inspectorEName}
                            placeholder="Enter any eName"
                        />
                    </div>
                    <div class="field">
                        <label for="ontologyUrl"
                            ><strong>Ontology server URL:</strong></label
                        >
                        <input
                            id="ontologyUrl"
                            type="text"
                            bind:value={ontologyUrl}
                            onchange={saveOntologyUrl}
                            placeholder="https://..."
                        />
                    </div>
                    <div class="field" style="margin-top: 10px;">
                        <label for="ontologySelect"
                            ><strong>Select ontology:</strong></label
                        >
                        <select id="ontologySelect" bind:value={selectedOntologyId}>
                            <option disabled value="">-- pick schema --</option>
                            {#each ontologies as o}
                                <option value={o.id}>{o.title || o.id}</option>
                            {/each}
                        </select>
                    </div>
                    {#if schemasError}
                        <p class="error">{schemasError}</p>
                    {/if}
                    <div class="inspector-actions">
                        <button class="btn-secondary" disabled={schemasLoading} onclick={loadOntologies}>
                            {schemasLoading ? "Loading schemas…" : "Refresh schemas"}
                        </button>
                        <button disabled={pageLoading || !selectedOntologyId} onclick={loadEnvelopes}>
                            {pageLoading ? "Loading…" : "Load MetaEnvelopes"}
                        </button>
                    </div>
                </section>
            {#if selectedOntologyId}
                <div class="envelope-list-header">
                    <span class="envelope-count">
                        {#if pageLoading}
                            Loading…
                        {:else}
                            {pageOffset + 1}–{pageOffset + envelopes.length} of {totalCount}
                        {/if}
                    </span>
                    <div class="pagination-controls">
                        <button
                            class="btn-sm"
                            disabled={pageLoading || !pageInfo.hasPreviousPage}
                            onclick={goPrevPage}
                        >← Prev</button>
                        <button
                            class="btn-sm"
                            disabled={pageLoading || !pageInfo.hasNextPage}
                            onclick={goNextPage}
                        >Next →</button>
                    </div>
                </div>

                {#if pageError}
                    <p class="error">{pageError}</p>
                {/if}

                {#if pageLoading}
                    <div class="envelope-loading">Loading metaenvelopes…</div>
                {:else if envelopes.length === 0}
                    <div class="envelope-empty">No envelopes found for this ontology.</div>
                {:else}
                    {#each envelopes as env (env.id)}
                        {@const isExpanded = expandedIds.has(env.id)}
                        {@const jsonStr = JSON.stringify(env.parsed, null, 2)}
                        <div class="envelope-row">
                            <div
                                class="envelope-header"
                                role="button"
                                tabindex="0"
                                onclick={() => toggleExpand(env.id)}
                                onkeydown={(e) => e.key === "Enter" && toggleExpand(env.id)}
                            >
                                <div class="envelope-meta">
                                    <span class="envelope-id">{env.id}</span>
                                    <span class="envelope-onto">{env.ontology}</span>
                                </div>
                                <button
                                    class="btn-expand"
                                    type="button"
                                    onclick={(e) => { e.stopPropagation(); toggleExpand(env.id); }}
                                >{isExpanded ? "Collapse ▲" : "Expand ▼"}</button>
                            </div>
                            <div class="envelope-body" class:expanded={isExpanded}>
                                <div class="json-preview">
                                    <pre class="json-pre">{@html highlightJson(jsonStr)}</pre>
                                    {#if !isExpanded}
                                        <div class="fade-overlay"></div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/each}

                    <div class="pagination-footer">
                        <button
                            class="btn-sm"
                            disabled={!pageInfo.hasPreviousPage}
                            onclick={goPrevPage}
                        >← Prev</button>
                        <span class="muted">{pageOffset + 1}–{pageOffset + envelopes.length} of {totalCount}</span>
                        <button
                            class="btn-sm"
                            disabled={!pageInfo.hasNextPage}
                            onclick={goNextPage}
                        >Next →</button>
                    </div>
                {/if}
            {/if}
            </div>
        </main>

        <aside class="sandbox-log">
            <div class="sandbox-log-header">
                <h2>Log</h2>
                <button
                    type="button"
                    class="btn-sm"
                    onclick={() => (logEntries = [])}>Clear</button
                >
            </div>
            <div class="sandbox-log-entries">
                {#each logEntries as entry}
                    <div
                        class="log-line"
                        class:log-error={entry.level === "error"}
                        class:log-success={entry.level === "success"}
                    >
                        <span class="log-ts">{entry.ts.slice(11, 23)}</span>
                        <span
                            class="log-badge"
                            class:badge-error={entry.level === "error"}
                            class:badge-success={entry.level === "success"}
                            >{entry.level}</span
                        >
                        <span class="log-msg">{entry.message}</span>
                        {#if entry.detail}
                            <span class="log-detail">{entry.detail}</span>
                        {/if}
                    </div>
                {/each}
            </div>
        </aside>
    </div>
{/if}

<style>
    .loading {
        padding: 2rem;
        font-family: system-ui, sans-serif;
        text-align: center;
        color: var(--muted, #666);
    }

    /* Tab strip for sandbox/inspector */
    .tab-bar {
        display: flex;
        border-bottom: 2px solid var(--border, #e2e8f0);
        margin-bottom: 1rem;
    }
    .tab-bar button {
        all: unset;
        padding: 0.5rem 1rem;
        cursor: pointer;
        border: 1px solid var(--border, #e2e8f0);
        border-bottom: 2px solid transparent;
        border-radius: 0.5rem 0.5rem 0 0;
        background: var(--bg-card, #fff);
        margin-right: 0.5rem;
    }
    .tab-bar button:hover:not(.active) {
        background: var(--btn-bg, #334155);
        color: #fff;
        border-color: var(--btn-bg, #334155);
    }
    .tab-bar button.active {
        border-bottom-color: var(--btn-hover, #475569);
        background: var(--bg-page, #f0f2f5);
        color: var(--fg, #1a1a1a);
        font-weight: 600;
    }
    .tab-bar button.active:hover {
        background: var(--bg-page, #f0f2f5);
        color: var(--fg, #1a1a1a);
    }

    .sandbox-layout {
        display: flex;
        height: 100vh;
        font-family:
            system-ui,
            -apple-system,
            sans-serif;
        background: var(--bg-page, #f0f2f5);
    }

    .sandbox-main {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem 2rem 2rem;
        min-width: 0;
    }

    .sandbox-header {
        margin-bottom: 1.5rem;
    }

    .sandbox-header h1 {
        margin: 0 0 0.25rem;
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--fg, #1a1a1a);
    }

    .config {
        font-size: 0.8rem;
        color: var(--muted, #64748b);
    }

    .config code {
        background: var(--bg-code, #e2e8f0);
        padding: 0.15em 0.4em;
        border-radius: 4px;
        font-size: 0.9em;
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    .w3ds-qr-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .btn-link {
        cursor: pointer;
        color: var(--link, #2563eb);
        text-decoration: underline;
        font-size: 0.9rem;
        background: none;
        border: none;
        padding: 0;
    }

    .btn-link:hover:not(:disabled) {
        color: var(--link-hover, #1d4ed8);
    }

    .btn-link:disabled {
        cursor: default;
        opacity: 0.7;
    }

    .muted {
        font-size: 0.85rem;
        color: var(--muted, #64748b);
    }

    .card {
        margin-bottom: 1rem;
        padding: 1.25rem;
        background: var(--bg-card, #fff);
        border-radius: 10px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
        border: 1px solid var(--border, #e2e8f0);
    }

    .card h2 {
        margin: 0 0 0.75rem;
        font-size: 1rem;
        font-weight: 600;
        color: var(--fg, #1a1a1a);
    }

    code {
        background: var(--bg-code, #e2e8f0);
        padding: 0.2em 0.4em;
        border-radius: 4px;
        font-size: 0.88em;
    }

    .debug {
        background: var(--bg-debug, #f8fafc);
    }

    .debug pre {
        margin: 0.25rem 0;
        font-size: 0.8em;
        overflow-x: auto;
        padding: 0.5rem;
        background: var(--bg-code, #e2e8f0);
        border-radius: 6px;
    }

    button {
        margin: 0 0.35rem 0.35rem 0;
        padding: 0.5em 1em;
        font-size: 0.9rem;
        cursor: pointer;
        background: var(--btn-bg, #334155);
        color: var(--btn-fg, #fff);
        border: none;
        border-radius: 6px;
    }

    button:hover:not(:disabled) {
        background: var(--btn-hover, #475569);
    }

    button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }

    .btn-sm {
        padding: 0.3em 0.6em;
        font-size: 0.8rem;
    }

    input[type="text"],
    textarea {
        display: block;
        width: 100%;
        margin: 0.5rem 0;
        padding: 0.5rem 0.65rem;
        box-sizing: border-box;
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 6px;
        font-size: 0.9rem;
    }

    input:focus,
    textarea:focus {
        outline: none;
        border-color: var(--focus, #3b82f6);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }

    textarea {
        resize: vertical;
        min-height: 4em;
    }

    select {
        padding: 0.4em 0.6em;
        border-radius: 6px;
        border: 1px solid var(--border, #e2e8f0);
        font-size: 0.9rem;
    }

    .error {
        color: var(--error, #b91c1c);
        margin: 0.5rem 0;
        font-size: 0.9rem;
    }

    .success {
        color: var(--success, #15803d);
        margin: 0.5rem 0;
        font-size: 0.9rem;
    }

    .result p {
        margin: 0.5rem 0;
    }

    .signature {
        word-break: break-all;
        font-size: 0.8em;
    }

    /* Split-screen log */
    .sandbox-log {
        width: 380px;
        min-width: 320px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        background: var(--log-bg, #1e293b);
        border-left: 1px solid var(--log-border, #334155);
    }

    .sandbox-log-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--log-border, #334155);
        background: var(--log-header-bg, #0f172a);
    }

    .sandbox-log-header h2 {
        margin: 0;
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--log-fg, #e2e8f0);
    }

    .sandbox-log-header .btn-sm {
        background: #475569;
        color: #e2e8f0;
    }

    .sandbox-log-header .btn-sm:hover {
        background: #64748b;
    }

    .sandbox-log-entries {
        flex: 1;
        overflow-y: auto;
        padding: 0.5rem;
        font-family: ui-monospace, "Cascadia Code", "SF Mono", monospace;
        font-size: 0.75rem;
        line-height: 1.5;
    }

    .log-line {
        display: grid;
        grid-template-columns: auto auto 1fr;
        gap: 0.5rem;
        align-items: baseline;
        padding: 0.2rem 0.4rem;
        margin-bottom: 0.15rem;
        border-radius: 4px;
        color: var(--log-fg, #cbd5e1);
        word-break: break-word;
    }

    .log-line:hover {
        background: rgba(255, 255, 255, 0.05);
    }

    .log-line.log-error {
        color: #fca5a5;
    }

    .log-line.log-success {
        color: #86efac;
    }

    .log-ts {
        color: var(--log-muted, #94a3b8);
        flex-shrink: 0;
    }

    .log-badge {
        flex-shrink: 0;
        padding: 0.1em 0.35em;
        border-radius: 4px;
        font-size: 0.7rem;
        text-transform: uppercase;
        background: #475569;
        color: #e2e8f0;
    }

    .log-badge.badge-error {
        background: #b91c1c;
        color: #fff;
    }

    .log-badge.badge-success {
        background: #15803d;
        color: #fff;
    }

    .log-msg {
        min-width: 0;
    }

    .log-detail {
        grid-column: 1 / -1;
        padding-left: 0.5rem;
        font-size: 0.7rem;
        color: var(--log-muted, #94a3b8);
    }
    .hidden {
        display: none;
    }
    .json-viewer {
        background: var(--bg-code, #e2e8f0);
        padding: 1rem;
        border-radius: 6px;
        overflow-x: auto;
        font-family: ui-monospace, 'Cascadia Code', 'SF Mono', monospace;
        font-size: 0.85rem;
        line-height: 1.4;
        max-height: 60vh;
    }
    .inspector-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 20px;
    }

    .btn-secondary {
        background: var(--bg-page, #f0f2f5);
        color: var(--fg, #334155);
        border: 1px solid var(--border, #e2e8f0);
    }
    .btn-secondary:hover:not(:disabled) {
        background: var(--border, #e2e8f0);
        color: var(--fg, #1a1a1a);
    }

    .field-select-refresh {
        display: flex;
        align-items: center;
    }
    .field-select-refresh select {
        flex: 1;
    }
    .btn-icon {
        all: unset;
        cursor: pointer;
        font-size: 1.2rem;
        margin-left: 0.5rem;
    }
    .btn-icon:disabled {
        opacity: 0.5;
        cursor: default;
    }

    /* Envelope list */
    .envelope-list-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
    }
    .envelope-count {
        font-size: 0.85rem;
        color: var(--muted, #64748b);
    }
    .pagination-controls {
        display: flex;
        gap: 0.4rem;
    }
    .envelope-loading,
    .envelope-empty {
        padding: 1.5rem;
        text-align: center;
        color: var(--muted, #64748b);
        font-size: 0.9rem;
        background: var(--bg-card, #fff);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 10px;
    }

    .envelope-row {
        background: var(--bg-card, #fff);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 10px;
        margin-bottom: 0.6rem;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .envelope-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.65rem 1rem;
        cursor: pointer;
        background: var(--bg-card, #fff);
        border-bottom: 1px solid var(--border, #e2e8f0);
        gap: 0.75rem;
        user-select: none;
    }
    .envelope-header:hover {
        background: var(--bg-page, #f0f2f5);
    }

    .envelope-meta {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        min-width: 0;
    }
    .envelope-id {
        font-family: ui-monospace, "Cascadia Code", "SF Mono", monospace;
        font-size: 0.78rem;
        color: var(--fg, #1a1a1a);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 55ch;
    }
    .envelope-onto {
        font-size: 0.72rem;
        color: var(--muted, #64748b);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 55ch;
    }

    .btn-expand {
        all: unset;
        flex-shrink: 0;
        cursor: pointer;
        font-size: 0.75rem;
        padding: 0.25em 0.65em;
        border-radius: 5px;
        border: 1px solid var(--border, #e2e8f0);
        background: var(--bg-page, #f0f2f5);
        color: var(--fg, #334155);
        white-space: nowrap;
    }
    .btn-expand:hover {
        background: var(--btn-bg, #334155);
        color: var(--btn-fg, #fff);
    }

    .envelope-body {
        position: relative;
        overflow: hidden;
        max-height: 7.5em;
        transition: max-height 0.25s ease;
    }
    .envelope-body.expanded {
        max-height: 600px;
        overflow-y: auto;
    }

    .json-preview {
        position: relative;
    }

    .json-pre {
        margin: 0;
        padding: 0.75rem 1rem;
        font-family: ui-monospace, "Cascadia Code", "SF Mono", monospace;
        font-size: 0.78rem;
        line-height: 1.55;
        background: #1e1e2e;
        color: #cdd6f4;
        overflow-x: auto;
        white-space: pre;
    }

    .fade-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(
            to bottom,
            transparent 5%,
            rgba(0, 0, 0, 0.8) 35%,
            rgba(0, 0, 0, 1) 60%,
            rgba(0, 0, 0, 1) 100%
        );
        pointer-events: none;
    }

    /* JSON syntax token colors (dark theme matching json-pre bg) */
    :global(.json-key)    { color: #89b4fa; }
    :global(.json-string) { color: #a6e3a1; }
    :global(.json-num)    { color: #fab387; }
    :global(.json-bool)   { color: #cba6f7; }
    :global(.json-null)   { color: #f38ba8; }

    .pagination-footer {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        margin-top: 0.5rem;
        padding: 0.5rem 0;
    }
</style>
