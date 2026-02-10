<script lang="ts">
  import {
    provision,
    authenticateToPlatform,
    syncPublicKeyToEvault,
    signPayload,
  } from "wallet-sdk";
  import { env } from "$env/dynamic/public";
  import { WebCryptoAdapter } from "$lib/WebCryptoAdapter";

  const config = {
    registryUrl: env.PUBLIC_REGISTRY_URL ?? "http://localhost:3001",
    provisionerUrl: env.PUBLIC_PROVISIONER_URL ?? "http://localhost:4321",
  };
  const adapter = new WebCryptoAdapter();

  interface Identity {
    w3id: string;
    uri: string;
    keyId: string;
  }

  let identities: Identity[] = $state([]);
  let selectedIndex = $state(0);
  let provisionBusy = $state(false);
  let provisionError = $state<string | null>(null);
  let provisionSuccess = $state<Identity | null>(null);

  let authInput = $state("");
  let authBusy = $state(false);
  let authError = $state<string | null>(null);
  let authSuccess = $state<string | null>(null);

  let syncToken = $state("");
  let syncBusy = $state(false);
  let syncError = $state<string | null>(null);
  let syncSuccess = $state(false);

  let signPayloadInput = $state("");
  let signBusy = $state(false);
  let signResult = $state<string | null>(null);
  let signError = $state<string | null>(null);

  const selectedIdentity = $derived(identities[selectedIndex] ?? null);

  async function doProvision() {
    provisionBusy = true;
    provisionError = null;
    provisionSuccess = null;
    try {
      const result = await provision({
        cryptoAdapter: adapter,
        registryUrl: config.registryUrl,
        provisionerUrl: config.provisionerUrl,
      });
      identities = [
        ...identities,
        { w3id: result.w3id, uri: result.uri, keyId: result.keyId },
      ];
      selectedIndex = identities.length - 1;
      provisionSuccess = identities[identities.length - 1];
    } catch (e) {
      provisionError = e instanceof Error ? e.message : String(e);
    } finally {
      provisionBusy = false;
    }
  }

  async function doAuth() {
    if (!selectedIdentity) {
      authError = "Provision an identity first.";
      return;
    }
    const uri = authInput.trim();
    if (!uri.startsWith("w3ds://")) {
      authError = "Paste a w3ds://auth URI.";
      return;
    }
    authBusy = true;
    authError = null;
    authSuccess = null;
    try {
      await authenticateToPlatform({
        cryptoAdapter: adapter,
        keyId: selectedIdentity.keyId,
        w3id: selectedIdentity.w3id,
        authUri: uri,
      });
      authSuccess = "Logged in successfully.";
    } catch (e) {
      authError = e instanceof Error ? e.message : String(e);
    } finally {
      authBusy = false;
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
  }

  async function doSync() {
    if (!selectedIdentity || !syncToken.trim()) return;
    syncBusy = true;
    syncError = null;
    syncSuccess = false;
    try {
      await syncPublicKeyToEvault({
        evaultUrl: selectedIdentity.uri,
        eName: selectedIdentity.w3id,
        cryptoAdapter: adapter,
        keyId: selectedIdentity.keyId,
        token: syncToken.trim(),
      });
      syncSuccess = true;
    } catch (e) {
      syncError = e instanceof Error ? e.message : String(e);
    } finally {
      syncBusy = false;
    }
  }

  async function doSign() {
    if (!selectedIdentity) return;
    signBusy = true;
    signError = null;
    signResult = null;
    try {
      const sig = await signPayload({
        cryptoAdapter: adapter,
        keyId: selectedIdentity.keyId,
        payload: signPayloadInput,
      });
      signResult = sig;
    } catch (e) {
      signError = e instanceof Error ? e.message : String(e);
    } finally {
      signBusy = false;
    }
  }
</script>

<main>
  <h1>W3DS Dev Sandbox</h1>
  <p class="config">
    Registry: <code>{config.registryUrl}</code> · Provisioner:
    <code>{config.provisionerUrl}</code>
  </p>

  <section>
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
          <button
            type="button"
            onclick={() => copyToClipboard(provisionSuccess!.w3id)}
            >Copy</button
          >
        </p>
        <p>
          <strong>eVault URI:</strong>
          <code>{provisionSuccess.uri}</code>
          <button
            type="button"
            onclick={() => copyToClipboard(provisionSuccess!.uri)}
            >Copy</button
          >
        </p>
      </div>
    {/if}
  </section>

  {#if identities.length > 0}
    <section>
      <h2>Selected identity</h2>
      <select bind:value={selectedIndex}>
        {#each identities as id, i}
          <option value={i}>{id.w3id}</option>
        {/each}
      </select>
    </section>

    <section>
      <h2>Sync public key</h2>
      <p>
        PATCH the selected identity's public key to its eVault. Enter a
        Bearer token (eVault PATCH /public-key requires auth).
      </p>
      <input
        type="text"
        bind:value={syncToken}
        placeholder="Bearer token"
      />
      <button disabled={syncBusy || !syncToken.trim()} onclick={doSync}>
        {syncBusy ? "Syncing…" : "Sync public key"}
      </button>
      {#if syncError}
        <p class="error">{syncError}</p>
      {/if}
      {#if syncSuccess}
        <p class="success">Public key synced.</p>
      {/if}
    </section>

    <section>
      <h2>Sign payload</h2>
      <p>
        Sign a string (e.g. session ID or message) with the selected
        identity's key.
      </p>
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

    <section>
      <h2>Authenticate to platform</h2>
      <p>
        Paste a <code>w3ds://auth</code> URI (redirect, session, platform
        params).
      </p>
      <input
        type="text"
        bind:value={authInput}
        placeholder="w3ds://auth?redirect=...&session=...&platform=..."
      />
      <button disabled={authBusy} onclick={doAuth}>
        {authBusy ? "Authenticating…" : "Authenticate"}
      </button>
      {#if authError}
        <p class="error">{authError}</p>
      {/if}
      {#if authSuccess}
        <p class="success">{authSuccess}</p>
      {/if}
    </section>
  {/if}
</main>

<style>
  main {
    font-family: system-ui, sans-serif;
    max-width: 640px;
    margin: 2rem auto;
    padding: 0 1rem;
  }
  .config {
    font-size: 0.85rem;
    color: #666;
  }
  code {
    background: #eee;
    padding: 0.2em 0.4em;
    border-radius: 4px;
    font-size: 0.9em;
  }
  section {
    margin: 1.5rem 0;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
  }
  h2 {
    margin-top: 0;
    font-size: 1.1rem;
  }
  button {
    margin: 0 0.25rem;
    padding: 0.4em 0.8em;
    cursor: pointer;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
  input[type="text"] {
    display: block;
    width: 100%;
    margin: 0.5rem 0;
    padding: 0.5rem;
    box-sizing: border-box;
  }
  .error {
    color: #c00;
    margin: 0.5rem 0;
  }
  .success {
    color: #060;
    margin: 0.5rem 0;
  }
  .result p {
    margin: 0.5rem 0;
  }
  .signature {
    word-break: break-all;
    font-size: 0.8em;
  }
</style>
