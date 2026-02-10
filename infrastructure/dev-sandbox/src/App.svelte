<script lang="ts">
  import { getConfig } from "./config";

  const config = getConfig();
</script>

<main>
  <h1>W3DS Dev Sandbox</h1>
  <p>
    Registry: <code>{config.registryUrl}</code> · Provisioner: <code>{config.provisionerUrl}</code> ·
    Platform: <code>{config.platformBaseUrl}</code>
  </p>
  <p>Use this app to test provisioning, auth, sync key, and sign payload.</p>
</main>

<style>
  main {
    font-family: system-ui, sans-serif;
    max-width: 640px;
    margin: 2rem auto;
    padding: 0 1rem;
  }
  code {
    background: #eee;
    padding: 0.2em 0.4em;
    border-radius: 4px;
    font-size: 0.9em;
  }
</style>
