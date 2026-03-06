<script lang="ts">
import { BottomSheet, ButtonAction } from "$lib/ui";

interface CameraPermissionDialogProps {
    isOpen: boolean;
    onOpenSettings: () => void;
    onGoBack?: () => void;
    onOpenChange?: (value: boolean) => void;
    title?: string;
    description?: string;
    dismissible?: boolean;
}

let {
    isOpen = $bindable(false),
    onOpenSettings,
    onGoBack,
    onOpenChange,
    title = "Camera Access Required",
    description = "To continue, please grant camera permission in your device settings.",
    dismissible = false,
}: CameraPermissionDialogProps = $props();

function handleOpenChange(value: boolean) {
    if (!dismissible && !value) return;
    isOpen = value;
    onOpenChange?.(value);
}
</script>

<BottomSheet
    {isOpen}
    onOpenChange={handleOpenChange}
    dismissible={dismissible}
>
    <div class="flex flex-col items-center text-center pb-4">
        <!-- Camera icon with slash -->
        <svg
            class="mx-auto mb-6"
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-gray-700"
            />
            <path
                d="M3 3l18 18"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                class="text-gray-700"
            />
        </svg>

        <h4 class="font-semibold text-xl mb-3 text-gray-900">
            {title}
        </h4>

        <p class="text-gray-600 text-sm mb-6 max-w-xs">
            {description}
        </p>

        <div class="flex flex-col gap-3 w-full">
            <ButtonAction
                variant="solid"
                callback={onOpenSettings}
                class="w-full"
            >
                Open Settings
            </ButtonAction>

            {#if onGoBack}
                <ButtonAction
                    variant="soft"
                    callback={onGoBack}
                    class="w-full"
                >
                    Go Back
                </ButtonAction>
            {:else}
                <!-- Spacer to maintain consistent bottom spacing -->
                <div class="h-10"></div>
            {/if}
        </div>
    </div>
</BottomSheet>
