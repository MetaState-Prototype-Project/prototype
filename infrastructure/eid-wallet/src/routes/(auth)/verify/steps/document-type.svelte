<script lang="ts">
import { ButtonAction } from "$lib/ui";
import { documentType, verifStep } from "../store";

function selectDocumentType(type: "passport" | "id" | "permit" | "dl") {
    documentType.set(type);
    verifStep.set(1); // Move to document capture step
}
</script>

<div class="flex flex-col gap-5">
    <div>
        <h3>Choose Document Type</h3>
        <p>Select the type of identity document you will be presenting</p>
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

