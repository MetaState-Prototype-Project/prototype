<script lang="ts">
import { PUBLIC_EID_WALLET_TOKEN } from "$env/static/public";
import type { GlobalState } from "$lib/global";
import {
    getUnreadCount,
    subscribe as subscribeNotifications,
} from "$lib/stores/notifications";
import { Toast } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { getContext, onDestroy, onMount, tick } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import { fly } from "svelte/transition";
import AppsMarketplace from "./components/AppsMarketplace.svelte";
import BindingDocuments from "./components/BindingDocuments.svelte";
import ENameCard from "./components/ENameCard.svelte";
import EVaultCard from "./components/EVaultCard.svelte";
import Greeting from "./components/Greeting.svelte";
import Lasso from "./components/Lasso.svelte";
import type { LegalIdDoc } from "./components/LegalIdAccordion.svelte";
import ScanFAB from "./components/ScanFAB.svelte";
import WelcomeTour, {
    TOUR_ORDER,
    type TourStep,
} from "./components/WelcomeTour.svelte";
import KycUpgradeOverlay from "./legacy/KycUpgradeOverlay.svelte";

let userData: Record<string, unknown> | undefined = $state(undefined);
let greeting: string | undefined = $state(undefined);
let ename: string | undefined = $state(undefined);
let profileCreationStatus: "idle" | "loading" | "success" | "failed" =
    $state("idle");
let skipProfileSetupGate = $state(false);
const RECOVERY_SKIP_PROFILE_SETUP_KEY = "recoverySkipProfileSetup";

let notificationCount = $state(0);
let unsubNotifications: (() => void) | undefined;
let statusInterval: ReturnType<typeof setInterval> | undefined =
    $state(undefined);
let showToast = $state(false);
let toastMessage = $state("");

// ── Binding documents / KYC state ─────────────────────────────────────────────
// `isFake` is true while the user only has a self-declared identity. The KYC
// overlay flips it to false after a successful upgrade, but that in-memory
// write path is unreliable — fall back on the presence of an id_document
// binding doc as the authoritative signal.
let isFake = $state<boolean | undefined>(undefined);
let legalId = $state<LegalIdDoc | null>(null);
let kycOpen = $state(false);
const verified = $derived(isFake === false || legalId !== null);

function openKycFlow() {
    kycOpen = true;
}

function handleKycClose() {
    kycOpen = false;
}

async function handleKycUpgraded() {
    if (!globalState) return;
    isFake = await globalState.userController.isFake;
    await loadBindingDocuments();
}

// Pull the first id_document binding doc from the eVault and map it into the
// LegalIdDoc shape the accordion expects. The doc's `data` may carry fields
// directly or only a Didit `reference` — we fall back to userController.user
// (populated by the KYC upgrade) when the binding doc is sparse.
async function loadBindingDocuments(): Promise<void> {
    if (!globalState) return;
    const vault = await globalState.vaultController.vault;
    if (!vault?.uri || !vault?.ename) return;

    const enameHeader = vault.ename.startsWith("@")
        ? vault.ename
        : `@${vault.ename}`;
    const gqlUrl = new URL("/graphql", vault.uri).toString();

    try {
        const res = await fetch(gqlUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-ENAME": enameHeader,
                ...(PUBLIC_EID_WALLET_TOKEN
                    ? { Authorization: `Bearer ${PUBLIC_EID_WALLET_TOKEN}` }
                    : {}),
            },
            body: JSON.stringify({
                query: `query {
                    bindingDocuments(first: 50) {
                        edges { node { parsed } }
                    }
                }`,
            }),
        });

        const json = await res.json();
        const edges: { node: { parsed: ParsedBindingDoc | null } }[] =
            json?.data?.bindingDocuments?.edges ?? [];

        const idDoc = edges
            .map((e) => e.node.parsed)
            .find((p): p is ParsedBindingDoc => p?.type === "id_document");

        legalId = idDoc ? toLegalIdDoc(idDoc) : null;
    } catch (err) {
        console.warn("[main] Failed to load binding documents:", err);
    }
}

interface ParsedBindingDoc {
    type: string;
    data: Record<string, unknown>;
}

function asString(v: unknown): string | undefined {
    return typeof v === "string" && v.length > 0 ? v : undefined;
}

function formatDate(iso: string | undefined): string | undefined {
    if (!iso) return undefined;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toDateString();
}

// TODO: enrich the Legal ID card with document type, country, DOB and document
// number. The provisioner currently stores a sparse binding doc — only
// { vendor, reference, name } — see `createBindingDocumentForUser` in
// evault-core's ProvisioningService. Two options when revisiting:
//   (a) ask evault to embed the full Didit fields in `data` at provisioning
//       time (cleanest; binding doc self-contained).
//   (b) here in the wallet, fetch GET /verification/v2/decision/{reference}
//       on the provisioner when loading binding docs, and merge those fields
//       in. Works without touching evault but adds a network call.
// Until then, the accordion shows the verified name only.
function toLegalIdDoc(doc: ParsedBindingDoc): LegalIdDoc {
    const data = doc.data;
    const docType = asString(data.document_type) ?? asString(data.documentType);
    const country =
        asString(data.issuing_country) ??
        asString(data.issuing_state_name) ??
        asString(data.issuing_state) ??
        asString(data.country);
    const title = [docType, country].filter(Boolean).join(" - ");

    const name =
        asString(data.name) ??
        asString(data.full_name) ??
        (userData ? asString(userData.name) : undefined);
    const dob =
        formatDate(
            asString(data.date_of_birth) ?? asString(data.dateOfBirth),
        ) ?? (userData ? asString(userData["Date of Birth"]) : undefined);
    const documentNumber =
        asString(data.document_number) ??
        asString(data.documentNumber) ??
        (userData ? asString(userData["Document Number"]) : undefined);

    return {
        title: title || "Legal ID",
        name,
        dateOfBirth: dob,
        documentNumber,
    };
}

// ── Welcome-tour state ────────────────────────────────────────────────────────
// `null` once the tour has either been seen before or has just finished.
// Setting a value mounts the WelcomeTour panel and switches the page into
// guided mode (locked scroll, hidden later cards, etc.).
let tourStep = $state<TourStep | null>(null);
// Vertical offset (in px) applied to the page content wrapper via CSS
// translateY while the tour runs. We can't use scrollTo because the root
// layout wraps children in `absolute inset-0` inside `min-h-screen`, which
// makes the body unscrollable.
let tourOffset = $state(0);
// Cards don't mount until pageReady is true — avoids a flash of the full
// layout before the tour-seen flag resolves on first visit.
let pageReady = $state(false);
const tourActive = $derived(tourStep !== null);
const tourGreeting = $derived(tourActive ? "Hello" : (greeting ?? "Hi"));

function stepIndex(step: TourStep | null): number {
    return step === null ? Number.POSITIVE_INFINITY : TOUR_ORDER.indexOf(step);
}

function isCardRevealed(card: TourStep): boolean {
    // When the tour isn't active, all cards are visible normally.
    if (!tourActive) return true;
    return stepIndex(card) <= stepIndex(tourStep);
}

function isCardPassed(card: TourStep): boolean {
    if (!tourActive) return false;
    return stepIndex(card) < stepIndex(tourStep);
}

// Fraction of the viewport that the bottom tour panel covers — used when
// centering the focused card in the remaining space above it.
const TOUR_PANEL_VH_FRACTION = 0.38;
// Minimum space above the focused card so the previous card stays visible.
const TOUR_TOP_GUTTER_PX = 80;
// Minimum gap kept between the focused card's bottom and the panel.
const TOUR_BOTTOM_GUTTER_PX = 20;

// Approximate ScanFAB height (button + padding). Used to compute its
// in-tour centered Y and its resting position near the viewport bottom.
const SCAN_FAB_HEIGHT_PX = 56;
// Vertical inset of the Scan FAB from the viewport bottom in its default
// resting state (matches the `bottom-12` in ScanFAB's fixed class).
const SCAN_FAB_BOTTOM_INSET_PX = 48;

// Computed Y position (in px from viewport top) for the Scan FAB. Always
// fixed-positioned — top transitions smoothly between the in-tour spot and
// the resting bottom position so the FAB moves rather than disappearing.
let scanFABTop = $state(0);
const scanFABVisible = $derived(tourStep === null || tourStep === "scan");

// The scan-step value of scanFABTop is set imperatively inside
// handleTourNext (it depends on where Apps marketplace ended up after the
// apps step). This effect only handles the non-scan states — pre-tour,
// during earlier steps, and after FINISH.
$effect(() => {
    if (typeof window === "undefined") return;
    if (tourStep !== "scan") {
        scanFABTop =
            window.innerHeight - SCAN_FAB_HEIGHT_PX - SCAN_FAB_BOTTOM_INSET_PX;
    }
});

async function handleTourNext(next: TourStep | null) {
    if (next === null) {
        // Finishing — slide content back to its natural position, persist the
        // flag, then null out the step so the tour panel dismounts.
        tourOffset = 0;
        if (globalState) globalState.hasSeenWelcomeTour = true;
        tourStep = null;
        return;
    }
    tourStep = next;
    await tick();

    // Scan is special: we don't scroll the card stack further. Apps marketplace
    // stays in place (now passed/faded) and the Scan FAB drops into the empty
    // space below it.
    if (next === "scan") {
        const apps = document.getElementById("tour-target-apps");
        if (!apps) return;
        const appsBottomInViewport =
            apps.offsetTop + apps.offsetHeight - tourOffset;
        const panelTopInViewport =
            window.innerHeight * (1 - TOUR_PANEL_VH_FRACTION);
        const slotCenter = (appsBottomInViewport + panelTopInViewport) / 2;
        scanFABTop = Math.max(
            appsBottomInViewport + 16,
            slotCenter - SCAN_FAB_HEIGHT_PX / 2,
        );
        return;
    }

    const card = document.getElementById(`tour-target-${next}`);
    if (!card) return;

    // Center the focused card vertically in the area above the bottom panel.
    // The space above the card stays large enough for the previous card to
    // peek through (faded); everything before that translates off-screen.
    const viewportH = window.innerHeight;
    const cardAreaH = viewportH * (1 - TOUR_PANEL_VH_FRACTION);
    const cardH = card.offsetHeight;
    const centeredTop = (cardAreaH - cardH) / 2;
    const clampedTop = Math.min(
        cardAreaH - cardH - TOUR_BOTTOM_GUTTER_PX,
        Math.max(TOUR_TOP_GUTTER_PX, centeredTop),
    );
    // offsetTop on the wrapped card is relative to its offsetParent — the
    // translate container — so the math works regardless of where in the
    // outer layout we live.
    tourOffset = Math.max(0, card.offsetTop - clampedTop);
}

function handleToast(message: string) {
    toastMessage = message;
    showToast = true;
}

function handleToastClose() {
    showToast = false;
}

async function retryProfileCreation() {
    if (!globalState) return;
    try {
        await globalState.vaultController.retryProfileCreation();
    } catch (error) {
        console.error("Retry failed:", error);
    }
}

// Root +layout.svelte builds globalState in its own onMount, which runs
// AFTER child onMounts. On hard refresh that means the context's current
// value here is `undefined` — so we capture the getter and poll for it,
// mirroring what (app)/+layout.svelte already does.
const getGlobalState = getContext<() => GlobalState | undefined>("globalState");
let globalState: GlobalState | undefined = $state(undefined);

onMount(() => {
    notificationCount = getUnreadCount();
    unsubNotifications = subscribeNotifications(() => {
        notificationCount = getUnreadCount();
    });

    const shouldSkipProfileSetupGate =
        localStorage.getItem(RECOVERY_SKIP_PROFILE_SETUP_KEY) === "true";
    if (shouldSkipProfileSetupGate) {
        skipProfileSetupGate = true;
        localStorage.removeItem(RECOVERY_SKIP_PROFILE_SETUP_KEY);
    }

    const currentHour = new Date().getHours();
    greeting =
        currentHour > 17
            ? "Good Evening"
            : currentHour > 12
              ? "Good Afternoon"
              : "Good Morning";

    (async () => {
        let gs = getGlobalState();
        let retries = 0;
        while (!gs && retries < 50) {
            await new Promise((r) => setTimeout(r, 100));
            gs = getGlobalState();
            retries++;
        }
        if (!gs) {
            console.error("[main] globalState never became available");
            return;
        }
        globalState = gs;

        profileCreationStatus = gs.vaultController.profileCreationStatus;

        const userInfo = await gs.userController.user;
        const fake = await gs.userController.isFake;
        isFake = fake;
        userData = { ...userInfo, isFake: fake };
        const vaultData = await gs.vaultController.vault;
        ename = vaultData?.ename;

        await loadBindingDocuments();

        // Welcome-tour gate — local Tauri Store read, no network needed.
        const seen = await gs.hasSeenWelcomeTour;
        if (!seen) {
            tourStep = "ename";
        }
        pageReady = true;
    })();

    const checkStatus = () => {
        if (!globalState) return;
        profileCreationStatus =
            globalState.vaultController.profileCreationStatus;
    };
    statusInterval = setInterval(checkStatus, 1000);
});

onDestroy(() => {
    if (statusInterval) {
        clearInterval(statusInterval);
    }
    unsubNotifications?.();
});
</script>

{#if profileCreationStatus === "loading" && !skipProfileSetupGate}
    <div class="flex flex-col items-center justify-center min-h-screen gap-6">
        <Shadow size={40} color="rgb(142, 82, 255);" />
        <h3 class="text-xl font-semibold">Setting up your eVault profile</h3>
        <p class="text-black-700 text-center max-w-md">
            We're creating your profile in the eVault. This may take a few
            moments...
        </p>
    </div>
{:else if profileCreationStatus === "failed"}
    <div
        class="flex flex-col items-center justify-center min-h-screen gap-6 px-4"
    >
        <div class="text-center">
            <h3 class="text-xl font-semibold text-danger mb-2">
                Profile Setup Failed
            </h3>
            <p class="text-black-700 text-center max-w-md mb-6">
                We couldn't set up your eVault profile. This might be due to a
                network issue or temporary service unavailability.
            </p>
            <Button.Action
                variant="solid"
                callback={retryProfileCreation}
                class="w-full max-w-xs"
            >
                Try Again
            </Button.Action>
        </div>
    </div>
{:else}
    <div
        class="relative px-5 transition-transform duration-500 ease-out will-change-transform"
        style="padding-top: max(12px, env(safe-area-inset-top)); padding-bottom: max(16px, env(safe-area-inset-bottom)); transform: translateY(-{tourOffset}px);"
    >
        <Greeting
            greeting={tourGreeting}
            name={(userData?.name as string) ?? ""}
            {notificationCount}
        />

        <main class="mt-6 flex flex-col gap-3 pb-32">
            {#if pageReady && isCardRevealed("ename")}
                <div
                    id="tour-target-ename"
                    class="relative tour-card"
                    class:tour-card-passed={isCardPassed("ename")}
                    in:fly|global={{
                        y: 30,
                        duration: 300,
                        delay: tourActive ? 250 : 0,
                    }}
                >
                    <ENameCard {ename} {verified} ontoast={handleToast} />
                    <Lasso size="med" active={tourStep === "ename"} />
                </div>
            {/if}

            {#if pageReady && isCardRevealed("binding-docs")}
                <div
                    id="tour-target-binding-docs"
                    class="relative tour-card"
                    class:tour-card-passed={isCardPassed("binding-docs")}
                    in:fly|global={{ y: 30, duration: 300 }}
                >
                    <BindingDocuments
                        {legalId}
                        onlegalid={openKycFlow}
                    />
                    <Lasso size="xl" active={tourStep === "binding-docs"} />
                </div>
            {/if}

            {#if pageReady && isCardRevealed("evault")}
                <div
                    id="tour-target-evault"
                    class="relative tour-card"
                    class:tour-card-passed={isCardPassed("evault")}
                    in:fly|global={{ y: 30, duration: 300 }}
                >
                    <EVaultCard available="80 Gb" />
                    <Lasso size="med" active={tourStep === "evault"} />
                </div>
            {/if}

            {#if pageReady && isCardRevealed("apps")}
                <div
                    id="tour-target-apps"
                    class="relative tour-card"
                    class:tour-card-passed={isCardPassed("apps")}
                    in:fly|global={{ y: 30, duration: 300 }}
                >
                    <AppsMarketplace />
                    <Lasso size="lg" active={tourStep === "apps"} />
                </div>
            {/if}

        </main>
    </div>

    {#if pageReady}
        <!-- Single, always-mounted Scan button. `top` transitions between
             the in-tour centered position and the resting bottom-of-screen
             spot so the FAB moves smoothly instead of disappearing on the
             tour's last step → tour-done handover. -->
        <div
            class="fixed left-1/2 -translate-x-1/2 z-30 transition-[top,opacity] duration-500 ease-out"
            style="top: {scanFABTop}px; opacity: {scanFABVisible ? 1 : 0};"
        >
            <div class="relative">
                <ScanFAB fixed={false} />
                <Lasso size="sm" active={tourStep === "scan"} />
            </div>
        </div>
    {/if}

    {#if tourStep !== null}
        <WelcomeTour step={tourStep} onnext={handleTourNext} />
    {/if}
{/if}

{#if showToast}
    <Toast message={toastMessage} onClose={handleToastClose} />
{/if}

<KycUpgradeOverlay
    open={kycOpen}
    onupgraded={handleKycUpgraded}
    onclose={handleKycClose}
/>

<style>
.tour-card {
    transition: opacity 400ms ease;
}
.tour-card-passed {
    opacity: 0.35;
}
</style>
