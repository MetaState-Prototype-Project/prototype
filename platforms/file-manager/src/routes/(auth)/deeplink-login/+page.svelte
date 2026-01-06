<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { apiClient } from "$lib/utils/axios";
    import { login } from "$lib/stores/auth";

    let isLoading = $state(true);
    let error = $state<string | null>(null);

    onMount(() => {
        const handleDeeplinkLogin = async () => {
            try {
                // Try parsing from search string first
                let params: URLSearchParams;
                let searchString = window.location.search;

                // If search is empty, try parsing from hash or full URL
                if (!searchString || searchString === "") {
                    const hash = window.location.hash;
                    if (hash && hash.includes("?")) {
                        searchString = hash.substring(hash.indexOf("?"));
                    } else {
                        try {
                            const fullUrl = new URL(window.location.href);
                            searchString = fullUrl.search;
                        } catch (e) {
                            // Ignore parsing errors
                        }
                    }
                }

                // Remove leading ? if present
                if (searchString.startsWith("?")) {
                    searchString = searchString.substring(1);
                }

                // Parse the search string
                params = new URLSearchParams(searchString);

                let ename = params.get("ename");
                let session = params.get("session");
                let signature = params.get("signature");
                const appVersion = params.get("appVersion");

                if (!ename || !session || !signature) {
                    // Add a small delay to allow URL to fully parse before showing error
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    // Re-check one more time after delay
                    const finalParams = new URLSearchParams(
                        window.location.search ||
                            (window.location.hash.includes("?")
                                ? window.location.hash.substring(
                                      window.location.hash.indexOf("?") + 1,
                                  )
                                : "") ||
                            "",
                    );
                    ename = finalParams.get("ename") || ename;
                    session = finalParams.get("session") || session;
                    signature = finalParams.get("signature") || signature;

                    if (!ename || !session || !signature) {
                        error = "Missing required authentication parameters";
                        isLoading = false;
                        return;
                    }
                }

                // Clean up URL
                window.history.replaceState({}, "", window.location.pathname);

                // Make POST request to login endpoint using apiClient
                const requestBody = {
                    ename,
                    session,
                    signature,
                    appVersion: appVersion || "0.4.0",
                };

                const response = await apiClient.post("/api/auth", requestBody);

                if (response.data.token && response.data.user) {
                    login(response.data.token, response.data.user);
                    goto("/files");
                } else {
                    error = "Invalid response from server";
                    isLoading = false;
                }
            } catch (err: any) {
                console.error("Login request failed:", err);
                if (err.response?.data?.error) {
                    error = err.response.data.error;
                } else if (err.response?.status) {
                    error = `Server error: ${err.response.status}`;
                } else {
                    error = "Failed to connect to server";
                }
                isLoading = false;
            }
        };

        handleDeeplinkLogin();
    });
</script>

{#if isLoading}
    <div class="flex h-screen items-center justify-center">
        <div class="text-center">
            <div
                class="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"
            ></div>
            <p class="text-lg text-gray-600">Authenticating...</p>
        </div>
    </div>
{:else if error}
    <div class="flex h-screen items-center justify-center">
        <div class="text-center">
            <div class="text-red-600 mb-4">{error}</div>
            <button
                onclick={() => (window.location.href = "/")}
                class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
                Go to Login
            </button>
        </div>
    </div>
{/if}
