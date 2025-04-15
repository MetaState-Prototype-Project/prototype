import type { BiometryType } from "@tauri-apps/plugin-biometric";

export const runtime = $state<{
    header: {
        title: string | undefined;
        backEnabled: boolean | undefined;
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
        backEnabled: undefined,
    },
    biometry: undefined,
});
