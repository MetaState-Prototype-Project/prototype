<script lang="ts">
import { goto } from "$app/navigation";
import {
    PUBLIC_EID_WALLET_TOKEN,
    PUBLIC_PROVISIONER_URL,
    PUBLIC_REGISTRY_URL,
} from "$env/static/public";
import { Hero } from "$lib/fragments";
import { GlobalState } from "$lib/global";
import { ButtonAction } from "$lib/ui";
import axios from "axios";
import { GraphQLClient } from "graphql-request";
import { getContext, onMount } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import { v4 as uuidv4 } from "uuid";
import { provision } from "wallet-sdk";

/**
 * Pure-JS MD5 (no Node crypto dependency — safe in browser).
 * Returns lowercase hex digest.
 */
function md5(str: string): string {
    const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));
    const safeAdd = (x: number, y: number) => {
        const lsw = (x & 0xffff) + (y & 0xffff);
        return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xffff);
    };
    const F = (x: number, y: number, z: number) => (x & y) | (~x & z);
    const G = (x: number, y: number, z: number) => (x & z) | (y & ~z);
    const H = (x: number, y: number, z: number) => x ^ y ^ z;
    const I = (x: number, y: number, z: number) => y ^ (x | ~z);
    const step = (fn: (x: number, y: number, z: number) => number, a: number, b: number, c: number, d: number, x: number, t: number, s: number) =>
        safeAdd(rotl(safeAdd(safeAdd(a, fn(b, c, d)), safeAdd(x, t)), s), b);

    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c < 128) { bytes.push(c); }
        else if (c < 2048) { bytes.push((c >> 6) | 192, (c & 63) | 128); }
        else { bytes.push((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128); }
    }
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    bytes.push(bitLen & 0xff, (bitLen >> 8) & 0xff, (bitLen >> 16) & 0xff, (bitLen >> 24) & 0xff, 0, 0, 0, 0);

    const m: number[] = [];
    for (let i = 0; i < bytes.length; i += 4)
        m.push(bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24));

    let [a, b, c, d] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
    const T = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0);

    for (let i = 0; i < m.length; i += 16) {
        const [aa, bb, cc, dd] = [a, b, c, d];
        const s1 = [7, 12, 17, 22], s2 = [5, 9, 14, 20], s3 = [4, 11, 16, 23], s4 = [6, 10, 15, 21];
        for (let j = 0; j < 16; j++) { const s = s1[j % 4]; [a, b, c, d] = [d, step(F, a, b, c, d, m[i + j], T[j], s), b, c]; }
        for (let j = 0; j < 16; j++) { const s = s2[j % 4]; [a, b, c, d] = [d, step(G, a, b, c, d, m[i + (5 * j + 1) % 16], T[16 + j], s), b, c]; }
        for (let j = 0; j < 16; j++) { const s = s3[j % 4]; [a, b, c, d] = [d, step(H, a, b, c, d, m[i + (3 * j + 5) % 16], T[32 + j], s), b, c]; }
        for (let j = 0; j < 16; j++) { const s = s4[j % 4]; [a, b, c, d] = [d, step(I, a, b, c, d, m[i + (7 * j) % 16], T[48 + j], s), b, c]; }
        a = safeAdd(a, aa); b = safeAdd(b, bb); c = safeAdd(c, cc); d = safeAdd(d, dd);
    }

    return [a, b, c, d]
        .flatMap(v => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff])
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

function computeBindingDocumentHash(doc: {
    subject: string;
    type: string;
    data: Record<string, unknown>;
}): string {
    return md5(JSON.stringify({ subject: doc.subject, type: doc.type, data: doc.data }));
}

// Demo code accepted by the provisioner without a real verification record
const ANONYMOUS_VERIFICATION_CODE = "d66b7138-538a-465f-a6ce-f6985854c3f4";
const KEY_ID = "default";

type Step =
    | "home"           // Screen 1: Make a new eVault / Already have an eVault
    | "new-evault"     // Screen 2: Linked to identity / Anonymously
    | "already-have"   // TBI placeholder
    | "kyc-panel"      // Full-screen overlay: hardware check → /verify
    | "anonymous-form" // Name + DOB inputs for anonymous path
    | "loading";       // Spinner while provisioning + binding doc creation

let step = $state<Step>("home");
let error = $state<string | null>(null);
let loading = $state(false);

// KYC panel sub-state
let checkingHardware = $state(false);
let showHardwareError = $state(false);

// Anonymous form inputs
let anonName = $state("");
let anonDob = $state("");

let globalState: GlobalState;

function generatePassportNumber() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const randomLetters = () =>
        letters.charAt(Math.floor(Math.random() * letters.length)) +
        letters.charAt(Math.floor(Math.random() * letters.length));
    const randomDigits = () =>
        String(Math.floor(1000000 + Math.random() * 9000000));
    return randomLetters() + randomDigits();
}

// ── Identity / KYC path ───────────────────────────────────────────────────────

const handleIdentityPath = async () => {
    step = "kyc-panel";
    checkingHardware = true;
    showHardwareError = false;
    error = null;

    try {
        globalState.userController.isFake = false;
        const testKeyId = `hardware-test-${Date.now()}`;
        try {
            const { manager } = await globalState.keyService.ensureKey(
                testKeyId,
                "onboarding",
            );
            if (manager.getType() !== "hardware") {
                throw new Error("Got software fallback instead of hardware");
            }
            checkingHardware = false;
        } catch (keyError) {
            console.error("Hardware key test failed:", keyError);
            showHardwareError = true;
            checkingHardware = false;
        }
    } catch (err) {
        console.error("Error checking hardware:", err);
        showHardwareError = true;
        checkingHardware = false;
    }
};

const handleKycNext = async () => {
    try {
        loading = true;
        await globalState.walletSdkAdapter.ensureKey(KEY_ID, "onboarding");
        loading = false;
        goto("/verify");
    } catch (err) {
        console.error("Failed to initialize keys for onboarding:", err);
        error = "Failed to initialize security keys. Please try again.";
        loading = false;
        setTimeout(() => { error = null; }, 5000);
    }
};

// ── Anonymous path ────────────────────────────────────────────────────────────

const handleAnonymousSubmit = async () => {
    if (!anonName.trim()) {
        error = "Please enter your name.";
        setTimeout(() => { error = null; }, 4000);
        return;
    }

    step = "loading";
    error = null;

    try {
        globalState.userController.isFake = true;
        await globalState.walletSdkAdapter.ensureKey(KEY_ID, "onboarding");

        const provisionResult = await provision(globalState.walletSdkAdapter, {
            registryUrl: PUBLIC_REGISTRY_URL,
            provisionerUrl: PUBLIC_PROVISIONER_URL,
            namespace: uuidv4(),
            verificationId: ANONYMOUS_VERIFICATION_CODE,
            keyId: KEY_ID,
            context: "onboarding",
            isPreVerification: true,
        });

        const ename = provisionResult.w3id;
        const uri = provisionResult.uri;

        // Resolve eVault GraphQL endpoint from registry
        const resolveResp = await axios.get(
            new URL(`resolve?w3id=${ename}`, PUBLIC_REGISTRY_URL).toString(),
        );
        const evaultUri = resolveResp.data.uri as string;
        const graphqlEndpoint = new URL("/graphql", evaultUri).toString();

        // Compute the MD5 hash of the canonical binding document (subject + type + data, no signatures)
        // This hash IS the signature field stored in the binding document
        const timestamp = new Date().toISOString();
        const subject = ename.startsWith("@") ? ename : `@${ename}`;
        const bindingData = { kind: "self", name: anonName.trim() };
        const signature = computeBindingDocumentHash({ subject, type: "self", data: bindingData });

        // Create the self-signed binding document in eVault
        const gqlClient = new GraphQLClient(graphqlEndpoint, {
            headers: {
                "X-ENAME": ename,
                ...(PUBLIC_EID_WALLET_TOKEN
                    ? { Authorization: `Bearer ${PUBLIC_EID_WALLET_TOKEN}` }
                    : {}),
            },
        });

        const bdResult = await gqlClient.request<{
            createBindingDocument: {
                metaEnvelopeId: string | null;
                errors: { message: string; code: string }[] | null;
            };
        }>(
            `mutation CreateBindingDocument($input: CreateBindingDocumentInput!) {
                createBindingDocument(input: $input) {
                    metaEnvelopeId
                    errors { message code }
                }
            }`,
            {
                input: {
                    subject,
                    type: "self",
                    data: bindingData,
                    ownerSignature: { signer: subject, signature, timestamp },
                },
            },
        );

        const bdErrors = bdResult.createBindingDocument.errors;
        if (bdErrors?.length) {
            throw new Error(`Binding document error: ${bdErrors[0].message}`);
        }

        // Store user data locally — DOB is local-only, not in the binding doc
        const tenYearsLater = new Date();
        tenYearsLater.setFullYear(tenYearsLater.getFullYear() + 10);
        globalState.userController.user = {
            name: anonName.trim(),
            "Date of Birth": anonDob
                ? new Date(anonDob).toDateString()
                : new Date().toDateString(),
            "ID submitted": "Anonymous — Self Declaration",
            "Passport Number": generatePassportNumber(),
        };
        globalState.userController.document = {
            "Valid From": new Date().toDateString(),
            "Valid Until": tenYearsLater.toDateString(),
            "Verified On": new Date().toDateString(),
        };

        globalState.vaultController.vault = { uri, ename };

        setTimeout(() => { goto("/register"); }, 10_000);
    } catch (err) {
        console.error("Anonymous provisioning failed:", err);
        error = "Something went wrong. Please try again.";
        step = "anonymous-form";
        setTimeout(() => { error = null; }, 6000);
    }
};

onMount(() => {
    globalState = getContext<() => GlobalState>("globalState")();
});
</script>

<main class="h-full pt-[4svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between">
    <article class="flex justify-center mb-4">
        <img
            class="w-[88vw] h-[39svh]"
            src="/images/Onboarding.svg"
            alt="Infographic card"
        />
    </article>

    <!-- ── Screen 1: home ─────────────────────────────────────────────────── -->
    {#if step === "home"}
        <section>
            <Hero class="mb-4" titleClasses="text-[42px]/[1.1] font-medium">
                {#snippet subtitle()}
                    Your Digital Self consists of three core elements: <br />
                    <strong>– eName</strong> – your digital identifier, a number
                    <br />
                    <strong>– ePassport</strong> – your cryptographic keys, enabling
                    your agency and control
                    <br />
                    <strong>– eVault</strong> – the secure repository of all your
                    personal data. You will decide who can access it, and how. You
                    are going to get them now.
                    <br />
                {/snippet}
                Your Digital Self<br />
                <h4>in Web 3.0 Data Space</h4>
            </Hero>
        </section>
        <section>
            <p class="text-center small text-black-500">
                By continuing you agree to our <br />
                <a
                    href="https://metastate.foundation/"
                    rel="noopener noreferrer"
                    class="text-primary underline underline-offset-4"
                    target="_blank">Terms & Conditions</a
                >
                and
                <a
                    href="https://metastate.foundation/"
                    rel="noopener noreferrer"
                    target="_blank"
                    class="text-primary underline underline-offset-4">Privacy Policy.</a
                >
            </p>
            <div class="flex flex-col gap-3 mt-3">
                <ButtonAction
                    class="w-full"
                    callback={() => { step = "new-evault"; }}
                >
                    Make a new eVault
                </ButtonAction>
                <ButtonAction
                    variant="soft"
                    class="w-full"
                    callback={() => { step = "already-have"; }}
                >
                    Already have an eVault
                </ButtonAction>
            </div>
        </section>

    <!-- ── Screen: already have (TBI) ────────────────────────────────────── -->
    {:else if step === "already-have"}
        <section class="grow flex flex-col justify-center items-center gap-4 text-center px-2">
            <h4 class="text-xl font-bold">Already have an eVault?</h4>
            <p class="text-black-700">
                Restoring an existing eVault will be supported in a future
                update.<br /><br />
                <strong>TO BE IMPLEMENTED</strong>
            </p>
        </section>
        <ButtonAction variant="soft" class="w-full" callback={() => { step = "home"; }}>
            Back
        </ButtonAction>

    <!-- ── Screen 2: new-evault ───────────────────────────────────────────── -->
    {:else if step === "new-evault"}
        <section class="grow flex flex-col justify-center gap-6">
            <div>
                <h4 class="text-xl font-bold mb-1">Create a new eVault</h4>
                <p class="text-black-700 text-sm">
                    Choose how you want to establish your digital identity.
                </p>
            </div>
            <div class="flex flex-col gap-3">
                <button
                    onclick={handleIdentityPath}
                    class="w-full rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left hover:bg-gray-100 transition-colors active:bg-gray-200"
                >
                    <p class="font-semibold text-base mb-1">Linked to your identity</p>
                    <p class="text-sm text-black-500">
                        Verify your real-world passport. Your eVault will be
                        cryptographically bound to your identity document.
                    </p>
                </button>
                <button
                    onclick={() => { step = "anonymous-form"; }}
                    class="w-full rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left hover:bg-gray-100 transition-colors active:bg-gray-200"
                >
                    <p class="font-semibold text-base mb-1">Anonymously</p>
                    <p class="text-sm text-black-500">
                        Self-declare your name. No ID document required. A
                        self-signed binding document will be created.
                    </p>
                </button>
            </div>
        </section>
        <ButtonAction variant="soft" class="w-full mt-4" callback={() => { step = "home"; }}>
            Back
        </ButtonAction>

    <!-- ── Screen: anonymous form ─────────────────────────────────────────── -->
    {:else if step === "anonymous-form"}
        <section class="grow flex flex-col justify-start gap-4 pt-2">
            <div>
                <h4 class="text-xl font-bold mb-1">Self-declare your identity</h4>
                <p class="text-black-700 text-sm">
                    You are creating a self-signed binding document that
                    certifies your name. No ID verification is required.
                </p>
            </div>

            {#if error}
                <div class="bg-[#ff3300] rounded-md p-2 w-full text-center text-white text-sm">
                    {error}
                </div>
            {/if}

            <div class="flex flex-col gap-1">
                <label class="text-black-700 font-medium text-sm" for="anonName">
                    Your Name <span class="text-danger">*</span>
                </label>
                <input
                    id="anonName"
                    type="text"
                    bind:value={anonName}
                    class="border border-gray-200 w-full rounded-md font-medium my-1 p-3 bg-gray-50 focus:bg-white transition-colors"
                    placeholder="Enter your full name"
                />
            </div>

            <div class="flex flex-col gap-1">
                <label class="text-black-700 font-medium text-sm" for="anonDob">
                    Date of Birth
                    <span class="text-black-400 font-normal">(optional)</span>
                </label>
                <input
                    id="anonDob"
                    type="date"
                    bind:value={anonDob}
                    class="border border-gray-200 w-full rounded-md font-medium my-1 p-3 bg-gray-50 focus:bg-white transition-colors"
                />
                <p class="text-xs text-black-400">
                    Stored on your device only — not included in your binding document.
                </p>
            </div>

            <div class="rounded-xl bg-primary-50 border border-primary-100 p-4">
                <p class="text-xs text-primary-700 leading-relaxed">
                    By continuing, I declare that the name I have provided is
                    my own and that I am the sole owner of this eVault. This
                    declaration will be cryptographically signed and stored as a
                    self-certification binding document.
                </p>
            </div>
        </section>

        <div class="flex flex-col gap-3 pt-4 pb-12">
            <ButtonAction
                variant={anonName.trim().length === 0 ? "soft" : "solid"}
                disabled={anonName.trim().length === 0}
                class="w-full"
                callback={handleAnonymousSubmit}
            >
                Confirm & Create
            </ButtonAction>
            <ButtonAction
                variant="soft"
                class="w-full"
                callback={() => { step = "new-evault"; error = null; }}
            >
                Back
            </ButtonAction>
        </div>

    <!-- ── Screen: loading ────────────────────────────────────────────────── -->
    {:else if step === "loading"}
        <section class="grow flex flex-col items-center justify-center gap-6">
            <Shadow size={40} color="rgb(142, 82, 255)" />
            <h4 class="text-center">Generating your eName</h4>
            <p class="text-center text-black-500 text-sm">
                Creating your eVault and signing your binding document…
            </p>
        </section>
    {/if}
</main>

<!-- ── KYC / Identity full-screen overlay ──────────────────────────────────── -->
{#if step === "kyc-panel"}
    <div class="fixed inset-0 z-50 bg-white overflow-y-auto">
        <div class="min-h-full flex flex-col p-6">
            <article class="grow flex flex-col items-start w-full">
                <img
                    src="/images/GetStarted.svg"
                    alt="get-started"
                    class="w-full mb-4"
                />

                {#if error}
                    <div class="bg-[#ff3300] rounded-md p-2 w-full text-center text-white mb-4">
                        {error}
                    </div>
                {/if}

                {#if loading}
                    <div class="w-full py-20 flex flex-col items-center justify-center gap-6">
                        <Shadow size={40} color="rgb(142, 82, 255)" />
                        <h4 class="text-center">Generating your eName</h4>
                    </div>
                {:else if checkingHardware}
                    <div class="w-full py-20 flex flex-col items-center justify-center gap-6">
                        <Shadow size={40} color="rgb(142, 82, 255)" />
                        <h4 class="text-center">Checking device capabilities...</h4>
                    </div>
                {:else if showHardwareError}
                    <h4 class="mt-2 mb-2 text-red-600 text-left">
                        Hardware Security Not Available
                    </h4>
                    <p class="text-black-700 mb-4">
                        Your phone doesn't support hardware crypto keys, which
                        is a requirement for verified IDs.
                    </p>
                    <p class="text-black-700">
                        Please use the anonymous option to create an eVault instead.
                    </p>
                {:else}
                    <h4 class="mt-2 mb-4 text-left">
                        Your Digital Self begins with the Real You
                    </h4>
                    <p class="text-black-700 leading-relaxed">
                        In the Web 3.0 Data Space, identity is linked to
                        reality. We begin by verifying your real-world passport,
                        which serves as the foundation for issuing your secure
                        ePassport. At the same time, we generate your eName – a
                        unique digital identifier – and create your eVault to
                        store and protect your personal data.
                    </p>
                {/if}
            </article>

            <div class="flex-none pt-8 pb-12">
                {#if !loading && !checkingHardware}
                    <div class="flex flex-col w-full gap-3">
                        {#if showHardwareError}
                            <ButtonAction
                                class="w-full"
                                callback={() => { step = "anonymous-form"; error = null; }}
                            >
                                Go Anonymous
                            </ButtonAction>
                        {:else}
                            <ButtonAction
                                class="w-full"
                                callback={handleKycNext}
                            >
                                Next
                            </ButtonAction>
                        {/if}
                        <ButtonAction
                            variant="soft"
                            class="w-full"
                            callback={() => { step = "new-evault"; error = null; }}
                        >
                            Back
                        </ButtonAction>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}
