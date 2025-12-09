<script lang="ts">
import { ButtonAction } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { documentType, verifStep } from "../store";
import { getContext } from "svelte";

let showVeriffModal = getContext<{ value: boolean }>("showVeriffModal");

import { goto } from "$app/navigation";

function selectDocumentType(type: "passport" | "id" | "permit" | "dl") {
    documentType.set(type);
    verifStep.set(1); // Move to document capture step
    // Close drawer and navigate to fullscreen passport page
    if (showVeriffModal) {
        showVeriffModal.value = false;
    }
    goto("/verify/passport");
}

function goBack() {
    if (showVeriffModal) {
        showVeriffModal.value = false;
    } else {
        // Fallback: just go back in history
        window.history.back();
    }
}
</script>

<div class="flex flex-col gap-5">
    <div class="flex flex-col gap-2 mb-2">
        <button
            onclick={goBack}
            class="cursor-pointer self-start flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
        >
            <Button.Icon
                icon={ArrowLeft01Icon}
                iconColor="currentColor"
                strokeWidth={2}
                class="w-4 h-4"
            />
            <span>go back</span>
        </button>
        <div class="flex-1">
            <h3>Choose Document Type</h3>
            <p>Select the type of identity document you will be presenting</p>
        </div>
    </div>

    <div class="flex flex-col gap-3">
        <ButtonAction
            class="w-full"
            callback={() => selectDocumentType("passport")}
        >
            Passport
        </ButtonAction>

        <ButtonAction
            class="w-full"
            callback={() => selectDocumentType("id")}
        >
            ID Card
        </ButtonAction>

        <ButtonAction
            class="w-full"
            callback={() => selectDocumentType("dl")}
        >
            Driving License
        </ButtonAction>

        <ButtonAction
            class="w-full"
            callback={() => selectDocumentType("permit")}
        >
            Residence Permit
        </ButtonAction>
    </div>

    <div class="text-center text-xs text-white">
        Accepted documents: Driver's License, Residence Permit, Passport, ID Card.
    </div>
</div>

