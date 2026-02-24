<script lang="ts">
    let eName = "";

    function goToUser() {
        const value = eName.trim();
        if (!value) return;
        const normalized = value.startsWith("@") ? value.slice(1) : value;
        window.location.href = `/user/${encodeURIComponent(normalized)}`;
    }
</script>

<main class="mx-auto max-w-3xl p-8">
    <h1 class="text-3xl font-semibold">eNotary</h1>
    <p class="mt-2 text-slate-600">
        Enter an eName to review binding documents and run recovery.
    </p>

    <div class="mt-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label class="mb-2 block text-sm font-medium text-slate-700" for="ename">
            eName
        </label>
        <input
            id="ename"
            class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            placeholder="@user.w3id"
            bind:value={eName}
            on:keydown={(event) => event.key === "Enter" && goToUser()}
        />
        <button
            class="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            on:click={goToUser}
        >
            Load binding documents
        </button>
    </div>
</main>
