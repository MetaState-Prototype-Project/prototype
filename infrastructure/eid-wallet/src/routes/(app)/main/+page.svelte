<script module lang="ts">
// Module-scope: persists across navigations within the same app session
// because SvelteKit doesn't re-evaluate the module on client-side nav. The
// entrance fly-in should only play on the very first /main mount; coming
// back from /notifications, /settings, etc. should just snap into place.
// MUST live in `<script module>` — a regular `<script>` runs per instance.
let hasMountedBefore = false;

// Render cache. Stashing the last-known values up here means re-entering
// /main (e.g. back from /settings) paints cards instantly with stale data
// instead of flashing the white loading splash. The component still kicks
// off a fresh fetch on mount; the loaders write back into both the
// component state and these slots so the next visit is also instant.
import type { LegalIdDoc } from "./components/LegalIdAccordion.svelte";
import type { SocialBindingDisplay } from "./components/SocialBindingAccordion.svelte";

let cachedUserData: Record<string, unknown> | undefined;
let cachedEname: string | undefined;
let cachedIsFake: boolean | undefined;
let cachedLegalId: LegalIdDoc | null = null;
let cachedDisplayName: string | undefined;
let cachedSelfDocId: string | undefined;
let cachedSocialBindingCount = 0;
let cachedSocialBindingPreview: SocialBindingDisplay[] = [];
let hasEverLoaded = false;
</script>

<script lang="ts">
import { goto } from "$app/navigation";
import { PUBLIC_EID_WALLET_TOKEN } from "$env/static/public";
import type { GlobalState } from "$lib/global";
import {
    getUnreadCount,
    subscribe as subscribeNotifications,
} from "$lib/stores/notifications";
import NotificationService from "$lib/services/NotificationService";
import { BottomSheet, ButtonAction, Toast } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { isPermissionGranted } from "@choochmeque/tauri-plugin-notifications-api";
import { openAppSettings } from "@tauri-apps/plugin-barcode-scanner";
import {
    fetchNameFromVault,
    fetchSocialBindings,
    resolveVaultUri,
} from "$lib/utils";
import { getCanonicalBindingDocString } from "$lib/utils/bindingDocHash";
import { replaceAll as replaceAllPersonal } from "$lib/stores/personalBinding";
import {
    createSelfBindingDoc,
    deletePersonalBinding,
    loadPersonalBindings,
} from "$lib/utils/personalBinding";
import { getContext, onDestroy, onMount, tick } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import { fly } from "svelte/transition";
import AppsMarketplace from "./components/AppsMarketplace.svelte";
import BindingDocuments from "./components/BindingDocuments.svelte";
import EditNameSheet from "./components/EditNameSheet.svelte";
import ENameCard from "./components/ENameCard.svelte";
import EVaultCard from "./components/EVaultCard.svelte";
import Greeting from "./components/Greeting.svelte";
import InfoDrawer from "./components/InfoDrawer.svelte";
import Lasso from "./components/Lasso.svelte";
import ScanFAB from "./components/ScanFAB.svelte";
import SocialBindingDrawer from "./components/SocialBindingDrawer.svelte";
import WelcomeTour, {
    TOUR_ORDER,
    type TourStep,
} from "./components/WelcomeTour.svelte";
import KycUpgradeOverlay from "./legacy/KycUpgradeOverlay.svelte";

// Seed component state from the module-scope cache so re-entry paints
// instantly; loaders below refresh in-place.
let userData: Record<string, unknown> | undefined = $state(cachedUserData);
let greeting: string | undefined = $state(undefined);
let ename: string | undefined = $state(cachedEname);
let profileCreationStatus: "idle" | "loading" | "success" | "failed" =
    $state("idle");
let skipProfileSetupGate = $state(false);
const RECOVERY_SKIP_PROFILE_SETUP_KEY = "recoverySkipProfileSetup";

let notificationCount = $state(0);
let unsubNotifications: (() => void) | undefined;
let showNotifPrompt = $state(false);
let notifBusy = $state(false);
const NOTIF_PROMPT_KEY = "notifPromptShown";
let statusInterval: ReturnType<typeof setInterval> | undefined =
    $state(undefined);
let showToast = $state(false);
let toastMessage = $state("");

// ── Binding documents / KYC state ─────────────────────────────────────────────
// `isFake` is true while the user only has a self-declared identity. The KYC
// overlay flips it to false after a successful upgrade, but that in-memory
// write path is unreliable — fall back on the presence of an id_document
// binding doc as the authoritative signal.
let isFake = $state<boolean | undefined>(cachedIsFake);
let legalId = $state<LegalIdDoc | null>(cachedLegalId);
// Display name from the self-binding doc — the one the user typed at
// registration. Never gets overwritten by KYC the way userController.user.name
// does, so this stays as the user's chosen handle on the home greeting.
let displayName = $state<string | undefined>(cachedDisplayName);
// MetaEnvelope id of the current self-binding doc. Captured at load so the
// edit flow can delete the old doc after writing a new one — evault-core has
// no update mutation, so the only way to "rename" is create-then-delete.
let selfDocId = $state<string | undefined>(cachedSelfDocId);
let editNameOpen = $state(false);
let editNameSaving = $state(false);
let editNameError = $state<string | null>(null);
let kycOpen = $state(false);
let eVaultInfoOpen = $state(false);
let bindingDocsInfoOpen = $state(false);
let socialDrawerOpen = $state(false);

// Accordion shows N resolved names; total comes from the full count.
const SOCIAL_PREVIEW_COUNT = 5;
let socialBindingCount = $state(cachedSocialBindingCount);
let socialBindingPreview = $state<SocialBindingDisplay[]>(
    cachedSocialBindingPreview,
);
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
                        edges { node { id parsed } }
                    }
                }`,
            }),
        });

        const json = await res.json();
        const edges: {
            node: { id: string; parsed: ParsedBindingDoc | null };
        }[] = json?.data?.bindingDocuments?.edges ?? [];

        const docs = edges
            .map((e) => ({ id: e.node.id, parsed: e.node.parsed }))
            .filter(
                (d): d is { id: string; parsed: ParsedBindingDoc } =>
                    d.parsed !== null,
            );

        const idDocEntry = docs.find((d) => d.parsed.type === "id_document");
        legalId = idDocEntry ? toLegalIdDoc(idDocEntry.parsed) : null;
        cachedLegalId = legalId;

        const selfDocEntry = docs.find((d) => d.parsed.type === "self");
        const selfName = selfDocEntry?.parsed.data?.name;
        if (typeof selfName === "string" && selfName.trim()) {
            displayName = selfName.trim();
            cachedDisplayName = displayName;
        }
        selfDocId = selfDocEntry?.id;
        cachedSelfDocId = selfDocId;
    } catch (err) {
        console.warn("[main] Failed to load binding documents:", err);
    }

    await loadSocialBindings();
}

// Edit the display name by writing a new self-binding doc and deleting the
// old one. evault-core exposes no update mutation, so this create+delete
// pair is the only path. If the delete fails we leave the orphan in place —
// the next load picks the most-recent self doc by timestamp anyway.
async function handleEditNameSave(newName: string): Promise<void> {
    if (!globalState) {
        editNameError = "Wallet not ready.";
        return;
    }
    const trimmed = newName.trim();
    if (!trimmed) {
        editNameError = "Please enter a name.";
        return;
    }
    if (trimmed === displayName) {
        editNameOpen = false;
        return;
    }

    editNameSaving = true;
    editNameError = null;

    try {
        const vault = await globalState.vaultController.vault;
        if (!vault?.uri || !vault?.ename) {
            throw new Error("No eVault available");
        }
        const ownerEname = vault.ename.startsWith("@")
            ? vault.ename
            : `@${vault.ename}`;
        const gqlUrl = new URL("/graphql", vault.uri).toString();

        const data = { kind: "self", name: trimmed };
        const canonical = getCanonicalBindingDocString({
            subject: ownerEname,
            type: "self",
            data,
        });
        const signature = await globalState.keyService.sign(canonical);
        const ownerSignature = {
            signer: ownerEname,
            signature,
            timestamp: new Date().toISOString(),
        };

        const newId = await createSelfBindingDoc(
            gqlUrl,
            ownerEname,
            ownerSignature,
            trimmed,
        );

        const oldId = selfDocId;
        displayName = trimmed;
        cachedDisplayName = trimmed;
        selfDocId = newId;
        cachedSelfDocId = newId;

        // Mirror to userController so accordions/cards that still read from
        // there stay consistent until their own loaders re-run.
        if (userData) {
            userData = { ...userData, name: trimmed };
            cachedUserData = userData;
            globalState.userController.user = userData as Record<string, string>;
        }

        if (oldId && oldId !== newId) {
            try {
                await deletePersonalBinding(gqlUrl, ownerEname, oldId);
            } catch (err) {
                console.warn(
                    "[main] Couldn't delete old self-binding; load dedupe will handle it",
                    err,
                );
            }
        }

        editNameOpen = false;
    } catch (err) {
        console.error("[main] Edit name failed:", err);
        editNameError =
            err instanceof Error
                ? err.message
                : "Couldn't save your new name. Please try again.";
    } finally {
        editNameSaving = false;
    }
}

// Hydrate the personalBinding store from the caller's vault so the
// /main accordion reflects the user's marks on a cold reload — without
// this they only appear after a round trip through /personal.
async function loadPersonalIntoStore(): Promise<void> {
    if (!globalState) return;
    const vault = await globalState.vaultController.vault;
    if (!vault?.uri || !vault?.ename) return;
    const callerEname = vault.ename.startsWith("@")
        ? vault.ename
        : `@${vault.ename}`;
    const gqlUrl = new URL("/graphql", vault.uri).toString();
    try {
        const loaded = await loadPersonalBindings(gqlUrl, callerEname);
        replaceAllPersonal({
            photos: loaded.photographs.map((p, i) => ({
                id: `${p.metaEnvelopeId}-${i}`,
                metaEnvelopeId: p.metaEnvelopeId,
                dataUrl: p.photoBlob,
                description: p.description,
                source: "camera" as const,
            })),
            parameters: loaded.parameters
                ? {
                      metaEnvelopeId: loaded.parameters.metaEnvelopeId,
                      text: loaded.parameters.text,
                  }
                : null,
            knowledge: loaded.securityQuestion
                ? {
                      metaEnvelopeId: loaded.securityQuestion.metaEnvelopeId,
                      question: loaded.securityQuestion.question,
                  }
                : null,
        });
    } catch (err) {
        console.warn("[main] Failed to load personal bindings:", err);
    }
}

async function loadSocialBindings(): Promise<void> {
    if (!globalState) return;
    const vault = await globalState.vaultController.vault;
    if (!vault?.uri || !vault?.ename) return;
    const callerEname = vault.ename.startsWith("@")
        ? vault.ename
        : `@${vault.ename}`;
    const gqlUrl = new URL("/graphql", vault.uri).toString();

    try {
        const bindings = await fetchSocialBindings(gqlUrl, callerEname);

        // Group by counterparty. The same person can show up across multiple
        // docs (one for each direction the binding was scanned in); we want
        // one row per contact with a combined role.
        const byContact = new Map<string, typeof bindings>();
        for (const b of bindings) {
            const list = byContact.get(b.counterpartyEname);
            if (list) list.push(b);
            else byContact.set(b.counterpartyEname, [b]);
        }

        socialBindingCount = byContact.size;
        cachedSocialBindingCount = socialBindingCount;

        const groupedSlice = Array.from(byContact.values()).slice(
            0,
            SOCIAL_PREVIEW_COUNT,
        );
        const preview = await Promise.all(
            groupedSlice.map(async (group): Promise<SocialBindingDisplay> => {
                const counterpartyEname = group[0].counterpartyEname;
                const hasSent = group.some((b) => b.role === "sent");
                const hasReceived = group.some((b) => b.role === "received");
                const role: SocialBindingDisplay["role"] =
                    hasSent && hasReceived
                        ? "both"
                        : hasSent
                          ? "sent"
                          : "received";

                let name = counterpartyEname;
                try {
                    const counterVaultUri =
                        await resolveVaultUri(counterpartyEname);
                    name = await fetchNameFromVault(
                        counterVaultUri,
                        counterpartyEname,
                        counterpartyEname,
                    );
                } catch {
                    // Resolution failed — fall through with eName as label.
                }

                return {
                    counterpartyEname,
                    counterpartyName: name,
                    role,
                    bindings: group,
                };
            }),
        );
        socialBindingPreview = preview;
        cachedSocialBindingPreview = preview;
    } catch (err) {
        console.warn("[main] Failed to load social bindings:", err);
    }
}

function openSocialDrawer() {
    socialDrawerOpen = true;
}

async function handleSocialBound() {
    await loadSocialBindings();
}

function openSocialFullList() {
    goto("/social-bindings");
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
// Cards don't mount until pageReady is true on the FIRST ever load — avoids
// a flash of the full layout before the tour-seen flag resolves on the very
// first visit. On every subsequent re-entry we seed from the module cache
// (hasEverLoaded === true), so the splash never fires and the cards paint
// instantly with last-known values while the background refresh runs.
let pageReady = $state(hasEverLoaded);
const tourActive = $derived(tourStep !== null);
const tourGreeting = $derived(tourActive ? "Hello" : (greeting ?? "Hi"));

// Captured once on component init. Stays true for the lifetime of this
// component instance; the module-scope flag flips immediately so any later
// remount (i.e. coming back from another route) sees `false`.
const isFirstMount = !hasMountedBefore;
hasMountedBefore = true;
// Cards animate in on the first /main visit and on each tour-driven reveal,
// but stay still on subsequent re-entries. Sliding up every time the user
// taps back into /main felt jittery.
const animateCardEntrance = $derived(isFirstMount || tourActive);

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
// Seed synchronously from the viewport so the FAB renders at the bottom on
// first paint; otherwise it lands at top=0 for one tick and the CSS
// transition slides it down — visible every time you come back to /main.
function restingScanFABTop(): number {
    if (typeof window === "undefined") return 0;
    return window.innerHeight - SCAN_FAB_HEIGHT_PX - SCAN_FAB_BOTTOM_INSET_PX;
}
let scanFABTop = $state(restingScanFABTop());
const scanFABVisible = $derived(tourStep === null || tourStep === "scan");

// The scan-step value of scanFABTop is set imperatively inside
// handleTourNext (it depends on where Apps marketplace ended up after the
// apps step). This effect only handles the non-scan states — pre-tour,
// during earlier steps, and after FINISH.
$effect(() => {
    if (typeof window === "undefined") return;
    if (tourStep !== "scan") {
        scanFABTop = restingScanFABTop();
    }
    // Attach listeners for both orientation change and general window resize
    window.addEventListener("orientationchange", () => scanFABTop = restingScanFABTop());
    window.addEventListener("resize", () => scanFABTop = restingScanFABTop());

    // Clean up event listeners when the component is unmounted
    return () => {
      window.removeEventListener("orientationchange", () => scanFABTop = restingScanFABTop());
      window.removeEventListener("resize", () => scanFABTop = restingScanFABTop());
    };
});

async function maybeShowNotifPrompt(welcomeTourSeen: boolean) {
    if (localStorage.getItem(NOTIF_PROMPT_KEY) === "true") return;
    try {
        if (await isPermissionGranted()) {
            // Already granted (e.g. previous install) — silently mark as
            // shown so we don't ask again.
            localStorage.setItem(NOTIF_PROMPT_KEY, "true");
            return;
        }
    } catch {
        return;
    }
    // Defer behind the welcome tour: if it's about to play, let it finish
    // first so the sheet doesn't stack on top of the spotlight.
    if (!welcomeTourSeen) return;
    showNotifPrompt = true;
}

async function handleNotifAllow() {
    if (!globalState || notifBusy) return;
    notifBusy = true;
    try {
        const vault = await globalState.vaultController.vault;
        const ename = vault?.ename;
        const svc = NotificationService.getInstance();
        if (ename) {
            await svc.registerDevice(ename);
        } else {
            await svc.requestPermissions();
        }
        // If the user had already denied previously, requestPermission silently
        // returns "denied" without showing UI on both iOS and Android. Jump to
        // the app's system settings so they have a one-tap path to allow it.
        try {
            if (!(await isPermissionGranted())) {
                await openAppSettings();
            }
        } catch (err) {
            console.warn("[main] openAppSettings failed:", err);
        }
    } catch (err) {
        console.warn("[main] notification permission flow failed:", err);
    } finally {
        notifBusy = false;
        localStorage.setItem(NOTIF_PROMPT_KEY, "true");
        showNotifPrompt = false;
    }
}

function handleNotifSkip() {
    localStorage.setItem(NOTIF_PROMPT_KEY, "true");
    showNotifPrompt = false;
}

async function handleTourNext(next: TourStep | null) {
    if (next === null) {
        // Finishing — slide content back to its natural position, persist the
        // flag, then null out the step so the tour panel dismounts.
        tourOffset = 0;
        if (globalState) globalState.hasSeenWelcomeTour = true;
        tourStep = null;
        // The notif prompt was deferred while the tour ran — surface it now
        // that the user has dismissed it.
        void maybeShowNotifPrompt(true);
        return;
    }
    tourStep = next;
    await tick();

    // Scan is special: push the apps card up to the top gutter so the Scan
    // FAB has clear room beneath it. Without this extra scroll the apps card
    // sits right against the FAB and reads as overlap.
    if (next === "scan") {
        const apps = document.getElementById("tour-target-apps");
        if (!apps) return;
        tourOffset = Math.max(0, apps.offsetTop - TOUR_TOP_GUTTER_PX);
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
            // Flip pageReady so the layout has something to render
            // (cards still won't show because gs is null, but the page
            // doesn't stay blank waiting for a state that never arrives).
            pageReady = true;
            return;
        }
        globalState = gs;

        profileCreationStatus = gs.vaultController.profileCreationStatus;

        const userInfo = await gs.userController.user;
        const fake = await gs.userController.isFake;
        isFake = fake;
        cachedIsFake = fake;
        userData = { ...userInfo, isFake: fake };
        cachedUserData = userData;
        const vaultData = await gs.vaultController.vault;
        ename = vaultData?.ename;
        cachedEname = ename;

        await loadBindingDocuments();
        await loadPersonalIntoStore();

        // Welcome-tour gate — local Tauri Store read, no network needed.
        const seen = await gs.hasSeenWelcomeTour;
        if (!seen) {
            tourStep = "ename";
        }
        pageReady = true;
        hasEverLoaded = true;

        // One-shot notifications prompt. Don't pile it on top of the welcome
        // tour — defer to when the user has dismissed it. For returning users
        // (tour already seen) it fires right away.
        await maybeShowNotifPrompt(seen);
    })();

    const checkStatus = () => {
        if (!globalState) return;
        profileCreationStatus =
            globalState.vaultController.profileCreationStatus;
    };
    statusInterval = setInterval(checkStatus, 1000);

    // Passive refresh: re-pull bindings when the app returns to the
    // foreground and on a slow interval while /main is visible. The loaders
    // already write into both component state and the module cache, so
    // these are idempotent.
    bindingsRefreshInterval = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        void refreshBindings();
    }, 30_000);

    onVisibility = () => {
        if (typeof document !== "undefined" && !document.hidden) {
            void refreshBindings();
        }
    };
    if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", onVisibility);
    }
});

onDestroy(() => {
    if (statusInterval) {
        clearInterval(statusInterval);
    }
    if (bindingsRefreshInterval) {
        clearInterval(bindingsRefreshInterval);
    }
    if (typeof document !== "undefined" && onVisibility) {
        document.removeEventListener("visibilitychange", onVisibility);
    }
    unsubNotifications?.();
});

let bindingsRefreshInterval: ReturnType<typeof setInterval> | undefined =
    undefined;
let onVisibility: (() => void) | undefined = undefined;

async function refreshBindings(): Promise<void> {
    if (!globalState) return;
    try {
        await Promise.all([
            loadBindingDocuments(),
            loadPersonalIntoStore(),
        ]);
    } catch (err) {
        console.warn("[main] passive refresh failed:", err);
    }
}
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
        class="flex flex-col items-center justify-center min-h-screen gap-6"
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
        class="relative transition-transform duration-500 ease-out will-change-transform"
        style="padding-bottom: max(16px, env(safe-area-inset-bottom)); transform: translateY(-{tourOffset}px);"
    >
        {#if pageReady}
            <div
                in:fly|global={animateCardEntrance
                    ? { y: 30, duration: 600 }
                    : { duration: 0 }}
            >
                <Greeting
                    greeting={tourGreeting}
                    name={displayName ?? (userData?.name as string) ?? ""}
                    {notificationCount}
                    {tourActive}
                    onedit={() => {
                        editNameError = null;
                        editNameOpen = true;
                    }}
                />
            </div>
        {/if}

        <main class="mt-6 flex flex-col gap-4 pb-32">
            {#if pageReady && isCardRevealed("ename")}
                <div
                    id="tour-target-ename"
                    class="relative tour-card"
                    class:tour-card-passed={isCardPassed("ename")}
                    in:fly|global={animateCardEntrance
                        ? {
                              y: 30,
                              duration: 600,
                              delay: tourActive ? 400 : 0,
                          }
                        : { duration: 0 }}
                >
                    <ENameCard
                        {ename}
                        {verified}
                        ontoast={handleToast}
                        onshareqr={openSocialDrawer}
                    />
                    <Lasso size="med" active={tourStep === "ename"} />
                </div>
            {/if}

            {#if pageReady && isCardRevealed("binding-docs")}
                <div
                    id="tour-target-binding-docs"
                    class="relative tour-card"
                    class:tour-card-passed={isCardPassed("binding-docs")}
                    in:fly|global={animateCardEntrance
                        ? { y: 30, duration: 600 }
                        : { duration: 0 }}
                >
                    <BindingDocuments
                        {legalId}
                        socialBindingCount={socialBindingCount}
                        socialBindingPreview={socialBindingPreview}
                        onlegalid={openKycFlow}
                        onpersonal={() => goto("/personal")}
                        onsocialinvite={openSocialDrawer}
                        onsocialfulllist={openSocialFullList}
                        oninfo={() => (bindingDocsInfoOpen = true)}
                    />
                    <Lasso size="xl" active={tourStep === "binding-docs"} />
                </div>
            {/if}

            {#if pageReady && isCardRevealed("evault")}
                <div
                    id="tour-target-evault"
                    class="relative tour-card"
                    class:tour-card-passed={isCardPassed("evault")}
                    in:fly|global={animateCardEntrance
                        ? { y: 30, duration: 600 }
                        : { duration: 0 }}
                >
                    <EVaultCard
                        available="5 GB"
                        oninfo={() => (eVaultInfoOpen = true)}
                    />
                    <Lasso size="med" active={tourStep === "evault"} />
                </div>
            {/if}

            {#if pageReady && isCardRevealed("apps")}
                <div
                    id="tour-target-apps"
                    class="relative tour-card"
                    class:tour-card-passed={isCardPassed("apps")}
                    in:fly|global={animateCardEntrance
                        ? { y: 30, duration: 600 }
                        : { duration: 0 }}
                >
                    <AppsMarketplace />
                    <Lasso size="lg" active={tourStep === "apps"} />
                </div>
            {/if}

        </main>
    </div>

    {#if pageReady}
        <!-- Bottom fade so cards scrolling underneath don't crowd the Scan
             FAB. Sits below the FAB (z-20 < z-30) and above the cards. The
             tour's own bottom panel covers this during the walkthrough. -->
        <div
            aria-hidden="true"
            class="fixed bottom-0 left-0 right-0 h-32 z-20 pointer-events-none bg-linear-to-t from-white/80 to-transparent"
        ></div>

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

<SocialBindingDrawer
    bind:isOpen={socialDrawerOpen}
    {globalState}
    onbound={handleSocialBound}
/>

<EditNameSheet
    bind:isOpen={editNameOpen}
    currentName={displayName ?? (userData?.name as string) ?? ""}
    saving={editNameSaving}
    error={editNameError}
    onsave={handleEditNameSave}
/>

<InfoDrawer bind:isOpen={eVaultInfoOpen} title="What is eVault?">
    {#snippet body()}
        <img
            src="/images/what-is-evault.png"
            alt=""
            class="w-full h-auto rounded-2xl shrink-0"
            aria-hidden="true"
        />
        <p>
            eVault is your sovereign and secure storage. It holds all your
            data: photos, documents, social media posts, messages to friends,
            and more. Since your data is now stored by you, not platforms, you
            can easily switch between services.
        </p>
        <p>
            For example, if you don't like one messenger, simply switch to
            another, and all your messages, chats, and friends will still be
            there, because your data is stored with you, and the app only gets
            temporary permission to access it.
        </p>
    {/snippet}
</InfoDrawer>

<InfoDrawer bind:isOpen={bindingDocsInfoOpen} title="Binding documents">
    {#snippet body()}
        <p>
            Link binding documents to strengthen the connection between your
            Digital and Real Selves. Upload verifiable artifacts to your eVault,
            such as official documents, photos, or confirmations from friends
            and family, so you can prove ownership of your eVault if needed.
        </p>
        <img
            src="/images/binding-documents.png"
            alt=""
            class="w-full h-auto rounded-2xl shrink-0"
            aria-hidden="true"
        />
        <h4 class="text-black-900 font-bold text-base">Why it's important:</h4>
        <p>
            Unlike the usual Web 2.0 approach, where platforms make you create
            an account and upload your data to them, in W3DS, you have your own
            sovereign account — your Digital Self — and you control who can
            access your data. With sovereignty comes responsibility.
        </p>
        <p>
            By default, your Digital Self is tied to your Real Self via the eID
            App, so if anything happens to your phone, you may lose control over
            your data. However, if your personal artifacts — documents, photos,
            and social confirmations — are stored in your eVault, you can prove
            ownership of your Digital Self and regain control over your data.
        </p>
    {/snippet}
</InfoDrawer>

<!-- One-shot notifications prompt — first /main visit only. Persisted via
     localStorage so it never re-appears on this device. -->
<BottomSheet bind:isOpen={showNotifPrompt} dismissible={false}>
    <header class="flex flex-col items-center text-center gap-1">
        <h2 class="text-2xl font-bold text-black-900">Stay in the loop</h2>
        <p class="text-sm text-black-500 max-w-xs">
            Get notified about new messages, signing requests, and activity on
            your eVault.
        </p>
    </header>

    <div class="flex flex-col gap-3 pt-2">
        <ButtonAction
            class="w-full uppercase tracking-wide"
            disabled={notifBusy}
            isLoading={notifBusy}
            callback={handleNotifAllow}
            blockingClick
        >
            Allow notifications
        </ButtonAction>
        <ButtonAction
            variant="soft"
            class="w-full uppercase tracking-wide"
            disabled={notifBusy}
            callback={handleNotifSkip}
        >
            Not now
        </ButtonAction>
    </div>
</BottomSheet>

<style>
.tour-card {
    transition: opacity 400ms ease;
}
.tour-card-passed {
    opacity: 0.35;
}
</style>
