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
    <div class="flex items-start gap-3 mb-2">
        <Button.Icon
            icon={ArrowLeft01Icon}
            iconColor="black"
            strokeWidth={2}
            onclick={goBack}
            class="cursor-pointer mt-1"
        />
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

