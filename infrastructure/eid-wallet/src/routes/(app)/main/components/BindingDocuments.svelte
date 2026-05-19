<script lang="ts">
import {
    Agreement02Icon,
    InformationCircleIcon,
    UserIcon,
} from "@hugeicons/core-free-icons";
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

<section class="bg-white rounded-2xl border border-black-100 p-4 shadow-sm">
    <header class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-black-900">Binding Documents</h3>
        <button
            type="button"
            aria-label="About binding documents"
            onclick={oninfo}
            class="text-black-500 active:opacity-60"
        >
            <HugeiconsIcon
                icon={InformationCircleIcon}
                size={18}
                strokeWidth={2}
            />
        </button>
    </header>
    <div class="flex flex-col gap-2">
        <LegalIdAccordion doc={legalId} onadd={onlegalid} />

        <div class="flex items-center gap-3 bg-gray rounded-xl p-2.5">
            <div
                class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary shrink-0"
            >
                <HugeiconsIcon icon={UserIcon} size={20} strokeWidth={2} />
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-black-900 leading-tight">
                    Personal
                </p>
                <p class="text-xs text-black-500 leading-tight">
                    Idenity marks
                </p>
            </div>
            <button
                type="button"
                onclick={onpersonal}
                class="bg-black-100 text-black-700 text-[10px] font-bold uppercase tracking-wide px-4 py-1.5 rounded-full active:opacity-70 shrink-0"
            >
                Add
            </button>
        </div>

        <div class="flex items-center gap-3 bg-gray rounded-xl p-2.5">
            <div
                class="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 shrink-0"
            >
                <HugeiconsIcon
                    icon={Agreement02Icon}
                    size={20}
                    strokeWidth={2}
                />
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-black-900 leading-tight">
                    Social binding
                </p>
                <p class="text-xs text-primary leading-tight">
                    New level of trust
                </p>
            </div>
            <button
                type="button"
                onclick={onsocialinvite}
                class="bg-primary text-white text-[10px] font-bold uppercase tracking-wide px-4 py-1.5 rounded-full active:opacity-80 shrink-0"
            >
                Invite
            </button>
        </div>
    </div>
</section>
