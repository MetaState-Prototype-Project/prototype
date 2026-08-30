<script lang="ts">
    import type { IdentityLevel } from "$lib/levels";

    interface Actor {
        ename: string;
        role: string;
        ial: IdentityLevel;
        idDocuments: number;
        attestations: number;
        verifiedAttesters: number;
        error?: string;
    }

    let {
        actors = [],
        minimumIal,
        required,
    }: {
        actors?: Actor[];
        minimumIal: IdentityLevel;
        /** IAL the awarded level would need, so a shortfall is obvious. */
        required?: IdentityLevel | null;
    } = $props();

    const MEANING: Record<IdentityLevel, string> = {
        IAL1: "Anonymous — not sufficient for certification",
        IAL2: "Attested by at least one identified person",
        IAL3: "Passport or equivalent eID verified",
        IAL4: "Passport plus three independent attestations",
    };

    const ROLES: Record<string, string> = {
        releaseSigner: "Signed the release",
        author: "Author",
        deployer: "Deployer",
    };

    function tone(ial: IdentityLevel): string {
        if (ial === "IAL1") return "bg-negative-wash text-negative";
        if (ial === "IAL2") return "bg-caution-wash text-caution";
        return "bg-positive-wash text-positive";
    }

    /** What this actor would need to reach the next level up. */
    function gap(actor: Actor): string | null {
        if (actor.error) return `Their eVault could not be read (${actor.error}).`;
        if (actor.ial === "IAL4") return null;
        if (actor.ial === "IAL3") {
            const missing = 3 - actor.verifiedAttesters;
            return `IAL4 needs ${missing} more attestation${missing === 1 ? "" : "s"} from passport-verified people.`;
        }
        if (actor.ial === "IAL2") return "IAL3 needs a verified eID document.";
        return "IAL2 needs an attestation from someone already identified.";
    }
</script>

<section class="card p-6">
    <div class="flex flex-wrap items-baseline justify-between gap-3">
        <h2 class="text-sm font-semibold text-ink">Responsible actors</h2>
        <span class="pill {tone(minimumIal)}">Weakest: {minimumIal}</span>
    </div>
    <p class="mt-1 text-xs text-muted">
        Worked out from each person's binding documents. The weakest of them is
        what caps the level, so one unidentified actor holds back the release.
    </p>

    {#if required && minimumIal < required}
        <p class="mt-3 rounded-2xl bg-caution-wash px-4 py-3 text-sm text-caution">
            That level needs {required}. As it stands the release cannot go above
            what {minimumIal} supports.
        </p>
    {/if}

    <ul class="mt-4 space-y-2">
        {#each actors as actor (actor.ename)}
            <li class="rounded-2xl border border-line px-4 py-3">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span class="pill {tone(actor.ial)}">{actor.ial}</span>
                    <span class="text-sm text-muted">{ROLES[actor.role] ?? actor.role}</span>
                    <span class="mono-block flex-1 truncate">{actor.ename}</span>
                </div>
                <p class="mt-1.5 text-xs text-muted">
                    {MEANING[actor.ial]}
                    <span class="text-faint">
                        · {actor.idDocuments} eID · {actor.attestations} attestation{actor.attestations === 1 ? "" : "s"}
                        {#if actor.attestations > 0}({actor.verifiedAttesters} from verified people){/if}
                    </span>
                </p>
                {#if gap(actor)}
                    <p class="mt-1 text-xs text-faint">{gap(actor)}</p>
                {/if}
            </li>
        {/each}
    </ul>
</section>
