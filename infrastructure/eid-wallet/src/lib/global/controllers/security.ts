import { invoke } from "@tauri-apps/api/core";
import { type Status, checkStatus } from "@tauri-apps/plugin-biometric";
import type { Store } from "@tauri-apps/plugin-store";
/**
 * @author SoSweetHam <soham@auvo.io>
 * @description A security controller that can enable/disable biometric authentication for the app and provide for basic pin based application authentication schemes.
 *
 * Uses the following namespaces in the store:
 * - `pin` - The pin hash
 * - `biometrics` - The biometric authentication status
 *
 * @memberof GlobalState
 * You should not use this class directly, it is intended for use through the GlobalState.
 *
 * @constructor Meant to be used as a singleton through the GlobalState, should already be handled.
 * @param store - The store to use for storing the pin hash and biometric authentication status
 * @example
 * ```ts
 * import { GlobalState } from "./state";
 * const globalState = await GlobalState.create();
 * globalState.securityController.updatePin("1234", "1234");
 * console.log(globalState.securityController.pinHash);
 * ```
 */
export class SecurityController {
    #store: Store;
    constructor(store: Store) {
        this.#store = store;
    }

    /**
     * @author SoSweetHam <soham@auvo.io>
     * @description Store hash of app pin lock by providing the pin in 4 digit plain text
     * @memberof SecurityController
     * @param pin - The pin in plain text
     * @returns void
     * @throws Error if the pin is not valid
     * @throws Error if the pin cannot be hashed
     * @throws Error if the pin cannot be stored
     */
    async #setPin(pin: string) {
        const regex = /^\d{4}$/;
        if (!regex.test(pin)) {
            throw new Error("Invalid pin");
        }
        const hash = await invoke<string>("hash", { pin });
        if (!hash) {
            throw new Error("Pin not set");
        }
        await this.#store.set("pin", hash);
    }

    /**
     * @author SoSweetHam <soham@auvo.io>
     * @returns The pin hash if set, else undefined
     * @throws Error if the pin is not set
     * @description Get the pin hash for the app if set
     */
    async #getPin() {
        return this.#store.get<string>("pin").then((pin) => {
            if (!pin) {
                return undefined;
            }
            return pin;
        });
    }

    /**
     * @author SoSweetHam <soham@auvo.io>
     * @description Clear the pin for the app - For debug use only, ideally.
     * @memberof SecurityController
     * @returns void
     */
    async clearPin() {
        await this.#store.delete("pin");
    }

    /**
     * @author SoSweetHam <soham@auvo.io>
     * @description Verify the pin for the app
     * @memberof SecurityController
     * @param pin The pin in plain text.
     * @returns True if the pin is correct else False.
     * @throws Error if the pin is not set.
     */
    async verifyPin(pin: string) {
        const hash = await this.#getPin();
        if (!hash) {
            throw new Error("Pin not set");
        }
        const isValid = await invoke<boolean>("verify", { pin, hash });
        return isValid;
    }

    /**
     * @author SoSweetHam <soham@auvo.io>
     * @memberof SecurityController
     * @description Set/Update the pin for the app
     * @param newPin The new pin in plain text
     * @param confirmPin Copy of new pin (ideally both user provided directly)
     * @param oldPin Required if the pin on the app is already set
     * @returns void
     * @throws Error if the pin is not valid
     * @throws Error if the pin cannot be hashed
     * @throws Error if the pin cannot be stored
     * @throws Error if the old pin is not valid
     * @throws Error if the new pin and confirm pin do not match
     * @throws Error if the old pin is not provided
     * @example
     * ```ts
     * const globalState = await GlobalState.create();
     * globalState.securityController.updatePin("1234", "1234");
     * console.log(globalState.securityController.pinHash);
     * ```
     */
    async updatePin(newPin: string, confirmPin: string, oldPin?: string) {
        const hash = await this.#getPin();
        if (!hash) {
            if (newPin !== confirmPin) {
                throw new Error("Pins are not the same!");
            }
            return await this.#setPin(newPin);
        }
        if (oldPin) {
            const isValid = await invoke<boolean>("verify", {
                pin: oldPin,
                hash,
            });
            if (!isValid) {
                throw new Error("Invalid pin");
            }
            await this.#setPin(newPin);
            return;
        }
        throw new Error("Old pin not provided!");
    }

    /**
     * @author SoSweetHam <soham@auvo.io>
     * @memberof SecurityController
     * @description Get the pin hash for the app if set
     * @returns A promise for the pin hash
     * @example
     * ```ts
     * const globalState = await GlobalState.create();
     * const pinHash = await globalState.pinHash;
     * console.log(pinHash);
     * ```
     */
    get pinHash() {
        return this.#getPin();
    }

    /**
     * @author SoSweetHam <soham@auvo.io>
     * @memberof SecurityController
     * @description Set the biometric authentication for the app
     * @param value - Enable/Disable biometric authentication
     * @returns void
     * @throws Error if the biometric is not supported and trying to enable it
     * @example
     * ```ts
     * const globalState = await GlobalState.create();
     * globalState.enableBiometric = true;
     * ```
     */
    async #setBiometric(value: boolean | Promise<boolean>) {
        const status: Status = await checkStatus();
        if (status.isAvailable) {
            await this.#store.set("biometrics", await value);
        } else {
            await this.#store.set("biometrics", false);
            if (await value) {
                throw new Error("Biometric not supported");
            }
        }
    }

    /**
     * @author SoSweetHam <soham@auvo.io>
     * @memberof SecurityController
     * @description Set the biometric authentication status for the app, if the biometric is not supported, it will be set to false
     * @param value - Enable/Disable biometric authentication
     * @returns void
     * @throws Error if the biometric is not supported and trying to enable it
     * @example
     * ```ts
     * const globalState = await GlobalState.create();
     * globalState.biometricSupport = true;
     * ```
     */
    set biometricSupport(value: boolean | Promise<boolean>) {
        this.#setBiometric(value).catch((error) => {
            console.error("Failed to set biometric support:", error);
            // Consider how to handle errors in a setter - possibly notify via an event
        });
    }

    /**
     * @author SoSweetHam <soham@auvo.io>
     * @memberof SecurityController
     * @description Get the biometric authentication status for the app
     * @returns A promise for the biometric authentication status
     * @example
     * ```ts
     * const globalState = await GlobalState.create();
     * const biometricSupport = await globalState.biometricSupport;
     * console.log(biometricSupport);
     * ```
     */
    get biometricSupport() {
        return this.#store.get<boolean>("biometrics").then((biometric) => {
            if (biometric === undefined) {
                return false;
            }
            return biometric;
        });
    }
}
