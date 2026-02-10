<script lang="ts">
  import {
    provision,
    syncPublicKeyToEvault,
    signPayload,
  } from "wallet-sdk";
  import { env } from "$env/dynamic/public";
  import { PersistingWebCryptoAdapter } from "$lib/PersistingWebCryptoAdapter";
  import {
    createRandomUserProfile,
    storeUserProfileInEvault,
  } from "$lib/userProfile";

  const config = {
    registryUrl: env.PUBLIC_REGISTRY_URL ?? "http://localhost:3001",
    provisionerUrl: env.PUBLIC_PROVISIONER_URL ?? "http://localhost:4321",
    platformName: env.PUBLIC_DEV_SANDBOX_PLATFORM_NAME ?? "dev-sandbox",
  };

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
      }
    );
    if (!res.ok) throw new Error(`Platform token failed: ${res.status}`);
    const data = (await res.json()) as { token: string; expiresAt?: number };
    const token = data.token;
    const expiresAt = data.expiresAt ?? now + 3600000;
    const idx = identities.indexOf(identity);
    if (idx >= 0) {
      const next = [...identities];
      next[idx] = { ...identity, bearerToken: token, tokenExpiresAt: expiresAt };
      identities = next;
      saveIdentities(next);
    }
    return token;
  }

  // Init: load identities from localStorage and hydrate adapter keys
  (async () => {
    const list = loadIdentities();
    identities = list;
    if (list.length > 0) {
      await adapter.hydrateFromStorage(list.map((i) => i.keyId));
    }
    hydrated = true;
  })();

  async function doProvision() {
    provisionBusy = true;
    provisionError = null;
    provisionSuccess = null;
    addLog("info", "Provisioning new eVault…");
    try {
      const result = await provision({
        cryptoAdapter: adapter,
        registryUrl: config.registryUrl,
        provisionerUrl: config.provisionerUrl,
      });
      const identity: Identity = {
        w3id: result.w3id,
        uri: result.uri,
        keyId: result.keyId,
      };
      identities = [...identities, identity];
      selectedIndex = identities.length - 1;
      saveIdentities(identities);
      provisionSuccess = identity;
      addLog("success", "Provisioned", `${result.w3id}`);
      try {
        const tokenRes = await fetch(
          new URL("/platforms/certification", config.registryUrl).toString(),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform: config.platformName }),
          }
        );
        if (tokenRes.ok) {
          const data = (await tokenRes.json()) as { token: string; expiresAt?: number };
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
        await syncPublicKeyToEvault({
          evaultUrl: identity.uri,
          eName: identity.w3id,
          cryptoAdapter: adapter,
          keyId: identity.keyId,
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
        await storeUserProfileInEvault(identity.uri, identity.w3id, profile);
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

  function parseW3dsUri(input: string): { type: "auth" | "sign"; url: URL } | null {
    const trimmed = input.trim();
    let parseable = trimmed;
    if (trimmed.startsWith("w3ds://")) {
      parseable = trimmed.replace("w3ds://", "https://w3ds.dummy/");
    }
    try {
      const url = new URL(parseable);
      if (trimmed.startsWith("w3ds://auth") || (trimmed.includes("/api/auth") && url.searchParams.has("session"))) {
        return { type: "auth", url };
      }
      if (trimmed.startsWith("w3ds://sign") || url.searchParams.has("redirect_uri")) {
        return { type: "sign", url };
      }
      return null;
    } catch {
      return null;
    }
  }

  async function performW3dsAction() {
    if (!selectedIdentity) {
      actionError = "Select or create an identity first.";
      return;
    }
    const parsed = parseW3dsUri(w3dsInput);
    if (!parsed) {
      actionError = "Paste a w3ds://auth or w3ds://sign URI (or HTTP URL with session/redirect_uri).";
      return;
    }
    actionBusy = true;
    actionError = null;
    actionSuccess = null;
    addLog("info", `Perform ${parsed.type}`, parsed.url.toString().slice(0, 60) + "…");
    try {
      const { type, url } = parsed;
      if (type === "auth") {
        const redirectUrl = url.searchParams.get("redirect") ?? "";
        const sessionId = url.searchParams.get("session") ?? "";
        const signature = await signPayload({
          cryptoAdapter: adapter,
          keyId: selectedIdentity.keyId,
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
          body: { ...body, signature: `${String(signature).slice(-8)}…` },
          keyId: selectedIdentity.keyId,
          w3id: selectedIdentity.w3id,
          responseStatus: res.status,
          responseBody,
        });
        if (!res.ok) throw new Error((responseBody as { error?: string })?.error ?? `HTTP ${res.status}`);
        actionSuccess = "Auth succeeded.";
        addLog("success", "Auth succeeded", String(res.status));
      } else {
        const sessionId = url.searchParams.get("session") ?? "";
        const redirectUri = url.searchParams.get("redirect_uri") ?? "";
        if (!sessionId || !redirectUri) {
          actionError = "w3ds://sign needs session and redirect_uri.";
          return;
        }
        const signature = await signPayload({
          cryptoAdapter: adapter,
          keyId: selectedIdentity.keyId,
          payload: sessionId,
        });
        const body = {
          sessionId,
          signature,
          w3id: selectedIdentity.w3id,
          message: sessionId,
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
          body: { ...body, signature: `${String(signature).slice(-8)}…` },
          keyId: selectedIdentity.keyId,
          w3id: selectedIdentity.w3id,
          responseStatus: res.status,
          responseBody,
        });
        if (!res.ok) throw new Error((responseBody as { error?: string })?.error ?? `HTTP ${res.status}`);
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
    addLog("info", "Sign payload", signPayloadInput.slice(0, 40) + (signPayloadInput.length > 40 ? "…" : ""));
    try {
      const sig = await signPayload({
        cryptoAdapter: adapter,
        keyId: selectedIdentity.keyId,
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
            <strong>W3ID:</strong> <code>{provisionSuccess.w3id}</code>
            <button type="button" onclick={() => copyToClipboard(provisionSuccess!.w3id)}>Copy</button>
          </p>
          <p>
            <strong>eVault URI:</strong> <code>{provisionSuccess.uri}</code>
            <button type="button" onclick={() => copyToClipboard(provisionSuccess!.uri)}>Copy</button>
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
        <p>Paste a <code>w3ds://auth</code> or <code>w3ds://sign</code> URI (or HTTP URL with session/redirect_uri).</p>
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
        <input type="text" bind:value={signPayloadInput} placeholder="Payload to sign" />
        <button disabled={signBusy} onclick={doSign}>
          {signBusy ? "Signing…" : "Sign"}
        </button>
        {#if signError}
          <p class="error">{signError}</p>
        {/if}
        {#if signResult}
          <p>
            <strong>Signature:</strong> <code class="signature">{signResult}</code>
            <button type="button" onclick={() => copyToClipboard(signResult!)}>Copy</button>
          </p>
        {/if}
      </section>

      {#if lastDebug}
        <section class="card debug">
          <h2>Last action debug</h2>
          <p><strong>Request:</strong> {lastDebug.method} {lastDebug.url}</p>
          <p><strong>Body:</strong></p>
          <pre>{JSON.stringify(lastDebug.body, null, 2)}</pre>
          <p><strong>Key used:</strong> keyId={lastDebug.keyId}, w3id={lastDebug.w3id}{#if lastDebug.publicKeyFingerprint} · fingerprint …{lastDebug.publicKeyFingerprint}{/if}</p>
          <p><strong>Response:</strong> {lastDebug.responseStatus}</p>
          <pre>{typeof lastDebug.responseBody === "object" ? JSON.stringify(lastDebug.responseBody, null, 2) : String(lastDebug.responseBody)}</pre>
        </section>
      {/if}
    {/if}
    </main>

    <aside class="sandbox-log">
      <div class="sandbox-log-header">
        <h2>Log</h2>
        <button type="button" class="btn-sm" onclick={() => (logEntries = [])}>Clear</button>
      </div>
      <div class="sandbox-log-entries">
        {#each logEntries as entry}
          <div class="log-line" class:log-error={entry.level === "error"} class:log-success={entry.level === "success"}>
            <span class="log-ts">{entry.ts.slice(11, 23)}</span>
            <span class="log-badge" class:badge-error={entry.level === "error"} class:badge-success={entry.level === "success"}>{entry.level}</span>
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

  .sandbox-layout {
    display: flex;
    height: 100vh;
    font-family: system-ui, -apple-system, sans-serif;
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
</style>
