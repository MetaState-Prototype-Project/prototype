<script lang="ts">
import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import LegalIdAccordion, { type LegalIdDoc } from "./LegalIdAccordion.svelte";

interface IBindingDocumentsProps {
    /** Verified id_document binding doc, mapped to the row shape. */
    legalId?: LegalIdDoc | null;
    onlegalid?: () => void;
    onpersonal?: () => void;
    onsocialinvite?: () => void;
    oninfo?: () => void;
}

const {
    legalId,
    onlegalid,
    onpersonal,
    onsocialinvite,
    oninfo,
}: IBindingDocumentsProps = $props();
</script>

<section
    class="bg-white rounded-2xl p-4 shadow-[0px_4px_19.9px_0px_#00000024]"
>
    <header class="flex items-center justify-between mb-3">
        <h3 class="font-medium text-black text-lg">Binding Documents</h3>
        <button
            type="button"
            aria-label="About binding documents"
            onclick={oninfo}
            class="text-black-300 active:opacity-60"
        >
            <HugeiconsIcon
                icon={InformationCircleIcon}
                size={24}
                strokeWidth={2}
            />
        </button>
    </header>
    <div class="flex flex-col gap-2">
        <LegalIdAccordion doc={legalId} onadd={onlegalid} />

        <div class="flex items-center gap-3 bg-card-alternative rounded-3xl px-3 py-4">
            <img
                src="/images/Personal.png"
                alt=""
                width="40"
                height="40"
                class="block w-10 h-10 object-contain shrink-0"
                aria-hidden="true"
            />
            <div class="flex-1 min-w-0">
                <p class="font-medium text-black text-lg leading-tight">
                    Personal
                </p>
                <p class="text-black-700 opacity-50 leading-tight">
                    Identity marks
                </p>
            </div>
            <button
                type="button"
                onclick={onpersonal}
                class="bg-white text-black-700 h-11 text-[13px] font-bold uppercase tracking-wide px-4 py-1.5 rounded-full active:opacity-70 shrink-0"
            >
                Add
            </button>
        </div>

        <div class="flex items-center gap-3 bg-card-alternative rounded-3xl px-3 py-4">
            <img
                src="/images/SocialBinding.png"
                alt=""
                width="40"
                height="40"
                class="block w-10 h-10 object-contain shrink-0"
                aria-hidden="true"
            />
            <div class="flex-1 min-w-0">
                <p class="font-medium text-black text-lg leading-tight">
                    Social binding
                </p>
                <p class="text-primary font-medium leading-tight">
                    New level of trust
                </p>
            </div>
            <button
                type="button"
                onclick={onsocialinvite}
                class="bg-primary text-white h-11 text-[13px] font-medium uppercase tracking-wide px-4 py-1.5 rounded-full active:opacity-80 shrink-0"
            >
                Invite
            </button>
        </div>
    </div>
</section>
