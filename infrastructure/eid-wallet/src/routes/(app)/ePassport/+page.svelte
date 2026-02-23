<script lang="ts">
import { goto } from "$app/navigation";
import { PUBLIC_EID_WALLET_TOKEN } from "$env/static/public";
import { AppNav, IdentityCard } from "$lib/fragments";
import type { GlobalState } from "$lib/global";
import { ButtonAction } from "$lib/ui";
import { getContext, onMount } from "svelte";

const globalState = getContext<() => GlobalState>("globalState")();

let userData: Record<string, string | boolean | undefined>;
let docData: Record<string, unknown> = {};
let hasOnlySelfDocs = $state(false);
let bindingDocsLoaded = $state(false);

async function loadBindingDocuments(): Promise<void> {
    const vault = await globalState.vaultController.vault;
    if (!vault?.uri || !vault?.ename) {
        bindingDocsLoaded = true;
        return;
    }

    const ename = vault.ename.startsWith("@") ? vault.ename : `@${vault.ename}`;
    const gqlUrl = new URL("/graphql", vault.uri).toString();

    try {
        const res = await fetch(gqlUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-ENAME": ename,
                ...(PUBLIC_EID_WALLET_TOKEN
                    ? { Authorization: `Bearer ${PUBLIC_EID_WALLET_TOKEN}` }
                    : {}),
            },
            body: JSON.stringify({
                query: `query {
                    bindingDocuments(first: 50) {
                        edges {
                            node {
                                parsed
                            }
                        }
                    }
                }`,
            }),
        });

        const json = await res.json();
        const edges: { node: { parsed: { type: string } | null } }[] =
            json?.data?.bindingDocuments?.edges ?? [];

        if (edges.length === 0) {
            // No binding docs at all — treat same as self-only (anonymous user)
            hasOnlySelfDocs = true;
        } else {
            hasOnlySelfDocs = edges.every(
                (e) => e.node.parsed?.type === "self",
            );
        }
    } catch (err) {
        console.warn("[ePassport] Failed to load binding documents:", err);
    } finally {
        bindingDocsLoaded = true;
    }
}

onMount(async () => {
    const userInfo = await globalState.userController.user;
    const isFake = await globalState.userController.isFake;
    docData = (await globalState.userController.document) ?? {};
    userData = { ...userInfo, isFake };

    await loadBindingDocuments();
});
</script>

<AppNav title="ePassport" class="mb-8" />

<div>
    {#if userData}
        <IdentityCard variant="ePassport" {userData} class="shadow-lg" />
    {/if}
    {#if docData}
        <div class="p-6 pt-12 bg-gray w-full rounded-2xl -mt-8 flex flex-col gap-2">
            {#each Object.entries(docData) as [fieldName, value]}
                <div class="flex justify-between">
                    <p class="text-black-700 font-normal">{fieldName}</p>
                    <p class="text-black-500 font-medium">{value}</p>
                </div>
            {/each}
        </div>
    {/if}

    {#if bindingDocsLoaded && hasOnlySelfDocs}
        <div class="mt-6 px-1">
            <div class="mb-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p class="text-sm text-amber-800 leading-relaxed">
                    Your eVault only contains a self-declared binding document.
                    Verify your identity to increase your trust level.
                </p>
            </div>
            <ButtonAction
                class="w-full"
                callback={() => goto("/onboarding")}
            >
                Enhance Trust Level
            </ButtonAction>
        </div>
    {/if}
</div>
