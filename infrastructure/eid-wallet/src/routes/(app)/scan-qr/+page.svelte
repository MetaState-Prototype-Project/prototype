<script lang="ts">
    import { PUBLIC_PROVISIONER_URL } from "$env/static/public";
    import AppNav from "$lib/fragments/AppNav/AppNav.svelte";
    import { Drawer } from "$lib/ui";
    import * as Button from "$lib/ui/Button";
    import { QrCodeIcon } from "@hugeicons/core-free-icons";
    import { HugeiconsIcon } from "@hugeicons/svelte";
    import {
        Format,
        type PermissionState,
        type Scanned,
        cancel,
        checkPermissions,
        requestPermissions,
        scan,
    } from "@tauri-apps/plugin-barcode-scanner";
    import { getContext, onDestroy, onMount } from "svelte";
    import type { SVGAttributes } from "svelte/elements";
    import type { GlobalState } from "$lib/global";
    import axios from "axios";
    import { goto } from "$app/navigation";

    const globalState = getContext<() => GlobalState>("globalState")();
    const pathProps: SVGAttributes<SVGPathElement> = {
        stroke: "white",
        "stroke-width": 7,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
    };

    let platform = $state();
    let hostname = $state();
    let session = $state();
    let codeScannedDrawerOpen = $state(false);
    let loggedInDrawerOpen = $state(false);
    let scannedData: Scanned | undefined = $state(undefined);
    let scanning = false;
    let loading = false;
    let redirect = $state();
    let permissions_nullable: PermissionState | null;

    async function startScan() {
        let permissions = await checkPermissions()
            .then((permissions) => {
                return permissions;
            })
            .catch(() => {
                return null;
            });

        if (permissions === "prompt") {
            permissions = await requestPermissions();
        }

        permissions_nullable = permissions;

        if (permissions === "granted") {
            const formats = [Format.QRCode];
            const windowed = true;
            if (scanning) return;
            scanning = true;
            scan({ formats, windowed })
                .then((res) => {
                    scannedData = res;
                    const url = new URL(res.content);
                    platform = url.searchParams.get("platform");
                    const redirectUrl = new URL(
                        url.searchParams.get("redirect") || "",
                    );
                    redirect = url.searchParams.get("redirect");
                    session = url.searchParams.get("session");
                    hostname = redirectUrl.hostname;
                    codeScannedDrawerOpen = true;
                })
                .catch((error) => {
                    console.error("Scan error:", error);
                })
                .finally(() => {
                    scanning = false;
                });
        }
    }

    async function handleAuth() {
        const vault = await globalState.vaultController.vault;
        if (!vault || !redirect) return;
        await axios.post(redirect, { ename: vault.ename, session });
        codeScannedDrawerOpen = false;
        loggedInDrawerOpen = true;
        startScan();
    }

    async function cancelScan() {
        await cancel();
        scanning = false;
    }

    onMount(async () => {
        startScan();
    });

    onDestroy(async () => {
        await cancelScan();
    });
</script>

<AppNav title="Scan QR Code" titleClasses="text-white" iconColor="white" />

<svg
    class="mx-auto mt-48"
    width="204"
    height="215"
    viewBox="0 0 204 215"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
>
    <path d="M46 4H15C8.92487 4 4 8.92487 4 15V46" {...pathProps} />
    <path d="M158 4H189C195.075 4 200 8.92487 200 15V46" {...pathProps} />
    <path d="M46 211H15C8.92487 211 4 206.075 4 200V169" {...pathProps} />
    <path d="M158 211H189C195.075 211 200 206.075 200 200V169" {...pathProps} />
</svg>

<h4 class="text-white font-semibold text-center mt-20">
    Point the camera at the code
</h4>

<div
    class="fixed bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-8 justify-center items-center"
></div>

<!-- code scanned drawer -->
<Drawer
    title="Scan QR Code"
    bind:isPaneOpen={codeScannedDrawerOpen}
    class="flex flex-col gap-4 items-center justify-center"
>
    <div
        class="flex justify-center mb-4 relative items-center overflow-hidden bg-gray rounded-xl p-4 h-[72px] w-[72px]"
    >
        <div
            class="bg-white h-[16px] w-[200px] -rotate-45 absolute top-1"
        ></div>
        <div
            class="bg-white h-[16px] w-[200px] -rotate-45 absolute bottom-1"
        ></div>
        <HugeiconsIcon
            size={40}
            className="z-10"
            icon={QrCodeIcon}
            strokeWidth={1.5}
            color="var(--color-primary)"
        />
    </div>

    <h4>Code scanned!</h4>
    <p class="text-black-700">You're trying to access the following site</p>

    <div class="bg-gray rounded-2xl w-full p-4 mt-4">
        <h4 class="text-base text-black-700">Platform Name</h4>
        <p class="text-black-700 font-normal capitalize">
            {platform ?? "Unable to get name"}
        </p>
    </div>

    <div class="bg-gray rounded-2xl w-full p-4">
        <h4 class="text-base text-black-700">Website URL</h4>
        <p class="text-black-700 font-normal">
            {hostname ?? scannedData?.content}
        </p>
    </div>
    <div class="flex justify-center gap-3 items-center mt-4">
        <Button.Action
            variant="danger-soft"
            class="w-full"
            callback={() => {
                codeScannedDrawerOpen = false;
                startScan();
            }}
        >
            Decline
        </Button.Action>
        <Button.Action variant="solid" class="w-full" callback={handleAuth}>
            Confirm
        </Button.Action>
    </div>
</Drawer>

<!-- logged in drawer -->
<Drawer
    title="Scan QR Code"
    bind:isPaneOpen={loggedInDrawerOpen}
    class="flex flex-col gap-4 items-center justify-center"
>
    <div
        class="flex justify-center mb-4 relative items-center overflow-hidden bg-gray rounded-xl p-4 h-[72px] w-[72px]"
    >
        <div
            class="bg-white h-[16px] w-[200px] -rotate-45 absolute top-1"
        ></div>
        <div
            class="bg-white h-[16px] w-[200px] -rotate-45 absolute bottom-1"
        ></div>
        <HugeiconsIcon
            size={40}
            className="z-10"
            icon={QrCodeIcon}
            strokeWidth={1.5}
            color="var(--color-primary)"
        />
    </div>

    <h4>You're logged in!</h4>
    <p class="text-black-700">You're now connected to {platform}</p>

    <div class="flex justify-center items-center mt-4">
        <Button.Action
            variant="solid"
            class="w-full"
            callback={() => {
                loggedInDrawerOpen = false;
                goto("/main");
                startScan();
            }}
        >
            Close
        </Button.Action>
    </div>
</Drawer>
