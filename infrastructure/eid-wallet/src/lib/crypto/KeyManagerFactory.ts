import { HardwareKeyManager } from "./HardwareKeyManager";
import { SoftwareKeyManager } from "./SoftwareKeyManager";
import type { KeyManager, KeyManagerConfig } from "./types";
import { KeyManagerError, KeyManagerErrorCodes } from "./types";

/**
 * Factory class to create appropriate key managers based on context
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Factory pattern with state management requires a class
export class KeyManagerFactory {
    private static hardwareKeyManager: HardwareKeyManager | null = null;
    private static softwareKeyManager: SoftwareKeyManager | null = null;

    /**
     * Get a key manager instance based on the configuration
     */
    static async getKeyManager(config: KeyManagerConfig): Promise<KeyManager> {
        // If in pre-verification mode, ALWAYS use software keys (never hardware)
        if (config.preVerificationMode) {
            console.log("Using software key manager for pre-verification mode");
            return KeyManagerFactory.getSoftwareKeyManager();
        }

        // If explicitly requesting hardware and not in pre-verification mode
        if (config.useHardware) {
            return KeyManagerFactory.getHardwareKeyManager();
        }

        // Default behavior: try hardware first, fallback to software
        try {
            const hardwareManager = KeyManagerFactory.getHardwareKeyManager();
            // Test if hardware is available by checking if we can call exists
            await hardwareManager.exists(config.keyId);
            console.log("Using hardware key manager");
            return hardwareManager;
        } catch (error) {
            console.log(
                "Hardware key manager not available, falling back to software",
            );
            return KeyManagerFactory.getSoftwareKeyManager();
        }
    }

    /**
     * Get hardware key manager instance (singleton)
     */
    private static getHardwareKeyManager(): HardwareKeyManager {
        if (!KeyManagerFactory.hardwareKeyManager) {
            KeyManagerFactory.hardwareKeyManager = new HardwareKeyManager();
        }
        return KeyManagerFactory.hardwareKeyManager;
    }

    /**
     * Get software key manager instance (singleton)
     */
    private static getSoftwareKeyManager(): SoftwareKeyManager {
        if (!KeyManagerFactory.softwareKeyManager) {
            KeyManagerFactory.softwareKeyManager = new SoftwareKeyManager();
        }
        return KeyManagerFactory.softwareKeyManager;
    }

    /**
     * Check if hardware key manager is available
     */
    static async isHardwareAvailable(): Promise<boolean> {
        try {
            const hardwareManager = KeyManagerFactory.getHardwareKeyManager();
            // Try to check if a test key exists to verify hardware availability
            await hardwareManager.exists("test-hardware-check");
            return true;
        } catch (error) {
            console.log("Hardware key manager not available:", error);
            return false;
        }
    }

    /**
     * Get the appropriate key manager for a specific use case
     */
    static async getKeyManagerForContext(
        keyId: string,
        context: "onboarding" | "signing" | "verification" | "pre-verification",
        isFake: boolean,
    ): Promise<KeyManager> {
        // Pre-verification users (isFake=true) or pre-verification context should NEVER use hardware
        const shouldUseHardware =
            !isFake &&
            context !== "pre-verification" &&
            (await KeyManagerFactory.isHardwareAvailable());

        const config: KeyManagerConfig = {
            keyId,
            useHardware: shouldUseHardware,
            preVerificationMode: context === "pre-verification" || isFake,
        };

        return KeyManagerFactory.getKeyManager(config);
    }

    /**
     * Reset singleton instances (useful for testing)
     */
    static reset(): void {
        KeyManagerFactory.hardwareKeyManager = null;
        KeyManagerFactory.softwareKeyManager = null;
    }
}
