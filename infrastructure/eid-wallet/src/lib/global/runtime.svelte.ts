import type { BiometryType } from "@tauri-apps/plugin-biometric";

export const runtime = $state<{
    header: {
        title: string | undefined;
        subtitle: string | undefined;
        backEnabled: boolean | undefined;
        /** Optional override for the AppNav back chevron. Falls back to
         *  window.history.back() when undefined. */
        onback: (() => void) | undefined;
    };
    /**
     *  None = 0,
     *  TouchID = 1,
     *  FaceID = 2,
     *  Iris = 3
     */
    biometry: BiometryType | undefined;
}>({
    header: {
        title: undefined,
        subtitle: undefined,
        backEnabled: undefined,
        onback: undefined,
    },
    biometry: undefined,
});
