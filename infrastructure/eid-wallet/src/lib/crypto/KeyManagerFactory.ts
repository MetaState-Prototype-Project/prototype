import { exists as hwExists } from "@auvo/tauri-plugin-crypto-hw-api";
import { HardwareKeyManager } from "./HardwareKeyManager";
import { SoftwareKeyManager } from "./SoftwareKeyManager";
import type { KeyManager } from "./types";
import { WALLET_KEY_ALIAS } from "./types";

// biome-ignore lint/complexity/noStaticOnlyClass: shared singleton state
export class KeyManagerFactory {
    private static hardware: HardwareKeyManager | null = null;
    private static software: SoftwareKeyManager | null = null;

    static getHardware(): HardwareKeyManager {
        if (!KeyManagerFactory.hardware) {
            KeyManagerFactory.hardware = new HardwareKeyManager();
        }
        return KeyManagerFactory.hardware;
    }

    static getSoftware(): SoftwareKeyManager {
        if (!KeyManagerFactory.software) {
            KeyManagerFactory.software = new SoftwareKeyManager();
        }
        return KeyManagerFactory.software;
    }

    static get(type: "hardware" | "software"): KeyManager {
        return type === "hardware"
            ? KeyManagerFactory.getHardware()
            : KeyManagerFactory.getSoftware();
    }

    /**
     * Probe whether the device has working hardware-backed key support.
     * One-shot check; the result should be cached by the caller.
     */
    static async isHardwareAvailable(): Promise<boolean> {
        try {
            await hwExists(WALLET_KEY_ALIAS);
            return true;
        } catch {
            return false;
        }
    }

    static reset(): void {
        KeyManagerFactory.hardware = null;
        KeyManagerFactory.software = null;
    }
}
