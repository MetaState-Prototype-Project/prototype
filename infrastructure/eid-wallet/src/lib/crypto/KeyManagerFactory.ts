import type { KeyManager, KeyManagerConfig } from './types';
import { HardwareKeyManager } from './HardwareKeyManager';
import { SoftwareKeyManager } from './SoftwareKeyManager';
import { KeyManagerError, KeyManagerErrorCodes } from './types';

/**
 * Factory class to create appropriate key managers based on context
 */
export class KeyManagerFactory {
    private static hardwareKeyManager: HardwareKeyManager | null = null;
    private static softwareKeyManager: SoftwareKeyManager | null = null;

    /**
     * Get a key manager instance based on the configuration
     */
    static async getKeyManager(config: KeyManagerConfig): Promise<KeyManager> {
        // If explicitly requesting hardware and not in pre-verification mode
        if (config.useHardware && !config.preVerificationMode) {
            return this.getHardwareKeyManager();
        }

        // If in pre-verification mode, always use software keys
        if (config.preVerificationMode) {
            console.log('Using software key manager for pre-verification mode');
            return this.getSoftwareKeyManager();
        }

        // Default behavior: try hardware first, fallback to software
        try {
            const hardwareManager = this.getHardwareKeyManager();
            // Test if hardware is available by checking if we can call exists
            await hardwareManager.exists(config.keyId);
            console.log('Using hardware key manager');
            return hardwareManager;
        } catch (error) {
            console.log('Hardware key manager not available, falling back to software');
            return this.getSoftwareKeyManager();
        }
    }

    /**
     * Get hardware key manager instance (singleton)
     */
    private static getHardwareKeyManager(): HardwareKeyManager {
        if (!this.hardwareKeyManager) {
            this.hardwareKeyManager = new HardwareKeyManager();
        }
        return this.hardwareKeyManager;
    }

    /**
     * Get software key manager instance (singleton)
     */
    private static getSoftwareKeyManager(): SoftwareKeyManager {
        if (!this.softwareKeyManager) {
            this.softwareKeyManager = new SoftwareKeyManager();
        }
        return this.softwareKeyManager;
    }

    /**
     * Check if hardware key manager is available
     */
    static async isHardwareAvailable(): Promise<boolean> {
        try {
            const hardwareManager = this.getHardwareKeyManager();
            // Try to check if a test key exists to verify hardware availability
            await hardwareManager.exists('test-hardware-check');
            return true;
        } catch (error) {
            console.log('Hardware key manager not available:', error);
            return false;
        }
    }

    /**
     * Get the appropriate key manager for a specific use case
     */
    static async getKeyManagerForContext(
        keyId: string,
        context: 'onboarding' | 'signing' | 'verification' | 'pre-verification'
    ): Promise<KeyManager> {
        const config: KeyManagerConfig = {
            keyId,
            useHardware: context !== 'pre-verification',
            preVerificationMode: context === 'pre-verification',
        };

        return this.getKeyManager(config);
    }

    /**
     * Reset singleton instances (useful for testing)
     */
    static reset(): void {
        this.hardwareKeyManager = null;
        this.softwareKeyManager = null;
    }
}
