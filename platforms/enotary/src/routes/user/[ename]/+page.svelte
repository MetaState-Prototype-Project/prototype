<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import QrCode from "svelte-qrcode";

    interface BindingDocumentSignature {
        signer: string;
        signature: string;
        timestamp: string;
    }

    interface BindingDocument {
        id: string;
        subject: string;
        type: "id_document" | "photograph" | "social_connection" | "self";
        data: Record<string, unknown>;
        signatures: BindingDocumentSignature[];
    }

    interface SocialConnection {
        id: string;
        name: string;
        witnessEName: string | null;
    }

    interface WitnessSession {
        id: string;
        status: "pending" | "witnessed" | "expired" | "rejected";
        witnessedBy?: string;
    }

    let eName = "";
    let loading = true;
    let error = "";
    let documents: BindingDocument[] = [];
    let socialConnections: SocialConnection[] = [];

    let activeWitnessSessionId = "";
    let qrData = "";
    let witnessStatus = "";
    let witnessedSessionIds: string[] = [];
    let verifiedWitnesses: string[] = [];

    let resetMessage = "";
    let resetting = false;
    let recoveredPassphrase = "";
    let passphraseModalOpen = false;
    let modalCopied = false;
    let witnessPollTimer: ReturnType<typeof setInterval> | null = null;

    $: idDocuments = documents.filter((doc) => doc.type === "id_document");
    $: selfDocuments = documents.filter((doc) => doc.type === "self");
    $: photoDocuments = documents.filter((doc) => doc.type === "photograph");

    function normalizePathEName(pathValue: string): string {
        const decoded = decodeURIComponent(pathValue);
        return decoded.startsWith("@") ? decoded : `@${decoded}`;
    }

    function normalizeEName(value: string): string {
        return value.startsWith("@") ? value : `@${value}`;
    }

    async function loadUser() {
        loading = true;
        error = "";
        try {
            const pathParts = window.location.pathname.split("/");
            const routeEName = pathParts[pathParts.length - 1] || "";
            eName = normalizePathEName(routeEName);
            const response = await fetch(`/api/user/${encodeURIComponent(eName)}`);
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Failed to load user");
            documents = payload.documents || [];
            socialConnections = payload.socialConnections || [];
        } catch (err) {
            error = err instanceof Error ? err.message : "Unknown error";
        } finally {
            loading = false;
        }
    }

    async function requestWitness(witnessEName: string) {
        resetMessage = "";
        witnessStatus = "Creating witness session...";
        const response = await fetch("/api/witness/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetEName: eName, witnessEName }),
        });
        const payload = await response.json();
        if (!response.ok) {
            witnessStatus = payload.error || "Failed to create witness session";
            return;
        }

        activeWitnessSessionId = payload.session.id;
        qrData = payload.qrData;
        witnessStatus = "QR generated. Ask the friend to scan and sign.";
        await refreshWitnessStatus();
    }

    function randomChars(length: number): string {
        const chars =
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+";
        return Array.from(
            { length },
            () => chars[Math.floor(Math.random() * chars.length)],
        ).join("");
    }

    async function copyRecoveredPassphrase() {
        if (!recoveredPassphrase) return;
        await navigator.clipboard.writeText(recoveredPassphrase);
        modalCopied = true;
    }

    function getDataValue(data: Record<string, unknown>, key: string): string {
        const value = data[key];
        return typeof value === "string" ? value : "N/A";
    }

    function isWitnessVerified(witnessEName: string | null): boolean {
        if (!witnessEName) return false;
        return verifiedWitnesses.includes(normalizeEName(witnessEName));
    }

    async function refreshWitnessStatus() {
        if (!activeWitnessSessionId) return;
        const response = await fetch(
            `/api/witness/session/${encodeURIComponent(activeWitnessSessionId)}`,
        );
        const payload = await response.json();
        if (!response.ok) {
            witnessStatus = payload.error || "Failed to fetch witness status";
            return;
        }
        const session = payload.session as WitnessSession;
        witnessStatus = `Witness status: ${session.status}`;
        if (session.status === "witnessed" && !witnessedSessionIds.includes(session.id)) {
            witnessedSessionIds = [...witnessedSessionIds, session.id];
            if (
                session.witnessedBy &&
                !verifiedWitnesses.includes(normalizeEName(session.witnessedBy))
            ) {
                verifiedWitnesses = [
                    ...verifiedWitnesses,
                    normalizeEName(session.witnessedBy),
                ];
            }
            stopWitnessPolling();
        }
    }

    function stopWitnessPolling() {
        if (witnessPollTimer) {
            clearInterval(witnessPollTimer);
            witnessPollTimer = null;
        }
    }

    function startWitnessPolling() {
        stopWitnessPolling();
        if (!activeWitnessSessionId) return;
        witnessPollTimer = setInterval(() => {
            void refreshWitnessStatus();
        }, 3000);
    }

    async function generateAndResetPassphrase() {
        resetMessage = "";
        if (witnessedSessionIds.length === 0) {
            resetMessage = "At least one witness must be verified first.";
            return;
        }

        const generatedPassphrase = `${randomChars(6)}-${randomChars(6)}-${randomChars(6)}-${randomChars(6)}`;
        resetting = true;
        try {
            const response = await fetch("/api/passphrase/reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetEName: eName,
                    newPassphrase: generatedPassphrase,
                    witnessSessionIds: witnessedSessionIds,
                }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Reset failed");
            recoveredPassphrase = generatedPassphrase;
            modalCopied = false;
            passphraseModalOpen = true;
            resetMessage = "";
        } catch (err) {
            resetMessage = err instanceof Error ? err.message : "Failed to reset passphrase";
        } finally {
            resetting = false;
        }
    }

    $: if (activeWitnessSessionId) {
        startWitnessPolling();
    } else {
        stopWitnessPolling();
    }

    onMount(loadUser);
    onDestroy(stopWitnessPolling);
</script>

<main class="mx-auto max-w-6xl p-8">
    <a class="text-sm text-blue-700 hover:underline" href="/">Back</a>
    <h1 class="mt-2 text-3xl font-semibold">Recovery for {eName}</h1>

    {#if loading}
        <p class="mt-6 text-slate-600">Loading binding documents...</p>
    {:else if error}
        <p class="mt-6 rounded-md bg-red-50 p-3 text-red-700">{error}</p>
    {:else}
        <section class="mt-6 grid gap-4 lg:grid-cols-3">
            <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 class="text-lg font-semibold">Photographs</h2>
                {#if photoDocuments.length === 0}
                    <p class="mt-2 text-sm text-slate-500">No photograph binding documents.</p>
                {:else}
                    <div class="mt-4 space-y-4">
                        {#each photoDocuments as doc}
                            <div class="rounded-md border border-slate-200 p-3">
                                <p class="text-xs text-slate-500">ID: {doc.id}</p>
                                <img
                                    class="mt-2 max-h-[100px] w-full rounded object-contain"
                                    src={getDataValue(doc.data, "photoBlob")}
                                    alt="Binding"
                                />
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 class="text-lg font-semibold">ID Document</h2>
                {#if idDocuments.length === 0}
                    <p class="mt-2 text-sm text-slate-500">No id_document binding documents.</p>
                {:else}
                    <table class="mt-4 w-full text-left text-sm">
                        <thead class="bg-slate-50 text-slate-600">
                            <tr>
                                <th class="px-3 py-2">Vendor</th>
                                <th class="px-3 py-2">Reference</th>
                                <th class="px-3 py-2">Name</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each idDocuments as doc}
                                <tr class="border-t border-slate-200">
                                    <td class="px-3 py-2">{getDataValue(doc.data, "vendor")}</td>
                                    <td class="px-3 py-2">{getDataValue(doc.data, "reference")}</td>
                                    <td class="px-3 py-2">{getDataValue(doc.data, "name")}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                {/if}
            </div>

            <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 class="text-lg font-semibold">Self Binding</h2>
                {#if selfDocuments.length === 0}
                    <p class="mt-2 text-sm text-slate-500">No self binding documents.</p>
                {:else}
                    <table class="mt-4 w-full text-left text-sm">
                        <thead class="bg-slate-50 text-slate-600">
                            <tr>
                                <th class="px-3 py-2">Name</th>
                                <th class="px-3 py-2">Subject</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each selfDocuments as doc}
                                <tr class="border-t border-slate-200">
                                    <td class="px-3 py-2">{getDataValue(doc.data, "name")}</td>
                                    <td class="px-3 py-2">{doc.subject}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                {/if}
            </div>
        </section>

        <section class="mt-6 grid gap-4 md:grid-cols-2">
            <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 class="text-lg font-semibold">Social Connections (Witnesses)</h2>
                {#if socialConnections.length === 0}
                    <p class="mt-2 text-sm text-slate-500">No social connections found.</p>
                {:else}
                    <div class="mt-4 space-y-3">
                        {#each socialConnections as connection}
                            <div
                                class={`rounded-md border p-3 ${
                                    isWitnessVerified(connection.witnessEName)
                                        ? "border-emerald-500 bg-emerald-100"
                                        : "border-slate-200"
                                }`}
                            >
                                <div class="flex items-center justify-between gap-2">
                                    <p
                                        class={`font-medium ${
                                            isWitnessVerified(connection.witnessEName)
                                                ? "text-emerald-800"
                                                : ""
                                        }`}
                                    >
                                        {connection.name}
                                    </p>
                                    {#if isWitnessVerified(connection.witnessEName)}
                                        <span
                                            class="rounded-full bg-emerald-600 px-2 py-1 text-xs font-semibold text-white"
                                        >
                                            ✓ Verified
                                        </span>
                                    {/if}
                                </div>
                                <p
                                    class={`text-sm ${
                                        isWitnessVerified(connection.witnessEName)
                                            ? "text-emerald-700"
                                            : "text-slate-600"
                                    }`}
                                >
                                    Witness eName: {connection.witnessEName || "Unknown"}
                                </p>
                                {#if connection.witnessEName}
                                    <button
                                        class="mt-3 rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700"
                                        on:click={() => requestWitness(connection.witnessEName!)}
                                    >
                                        Request witness
                                    </button>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 class="text-lg font-semibold">Witness QR</h2>
                {#if qrData}
                    <div class="mt-4 flex justify-center rounded-lg bg-slate-50 p-4">
                        <QrCode value={qrData} size={240} />
                    </div>
                {:else}
                    <p class="mt-2 text-sm text-slate-500">Create a witness session to show QR.</p>
                {/if}
                {#if witnessStatus}
                    <p class="mt-3 text-sm text-slate-700">{witnessStatus}</p>
                {/if}
            </div>
        </section>

        <section class="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 class="text-lg font-semibold">Reset Passphrase</h2>
            <p class="mt-2 text-sm text-slate-500">At least one witnessed session is required.</p>
            <p class="mt-1 text-xs text-slate-500">
                Witness sessions ready: {witnessedSessionIds.length}
            </p>
            <button
                class="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={resetting || witnessedSessionIds.length === 0}
                on:click={generateAndResetPassphrase}
            >
                {resetting ? "Generating and setting..." : "Generate recovery passphrase"}
            </button>

            {#if resetMessage}
                <p class="mt-3 text-sm text-slate-700">{resetMessage}</p>
            {/if}
        </section>

        {#if passphraseModalOpen}
            <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div class="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
                    <h3 class="text-lg font-semibold">Recovery passphrase generated</h3>
                    <p class="mt-2 text-sm text-slate-600">
                        Save this passphrase now. It will be shown only for this recovery action.
                    </p>

                    <button
                        class="mt-4 w-full rounded-md bg-slate-50 px-3 py-3 text-left font-mono text-sm ring-1 ring-slate-200 hover:bg-slate-100"
                        on:click={copyRecoveredPassphrase}
                    >
                        {recoveredPassphrase}
                    </button>

                    <div class="mt-4 flex items-center justify-end gap-2">
                        <button
                            class="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                            on:click={copyRecoveredPassphrase}
                        >
                            {modalCopied ? "Copied" : "Click to copy"}
                        </button>
                        <button
                            class="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"
                            on:click={() => (passphraseModalOpen = false)}
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        {/if}
    {/if}
</main>
