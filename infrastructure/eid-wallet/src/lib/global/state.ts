import { invoke } from "@tauri-apps/api/core";
import { Store } from "@tauri-apps/plugin-store";
import { checkStatus, type Status } from "@tauri-apps/plugin-biometric";

/**
 * @author SoSweetHam <soham@auvo.io>
 * @description A centralized state that can be used to control the global state of the application, meant to be used as a singleton through the main layout component.
 *
 * You cannot use this class directly, instead use the `GlobalState.create()` method to get an instance.
 */
export class GlobalState {
    #store: Store;
    private constructor(store: Store) {
        this.#store = store;
    }

    /**
     * @author SoSweetHam <soham@auvo.io>
     * @description Creator of the GlobalState singleton
     * @returns A promise of a new instance of GlobalState
     * @throws Error if the store cannot be loaded
     * @example
     * ```ts
     * import { onMount, setContext } from "svelte";
     * let globalState: GlobalState | undefined = $state(undefined);
     * setContext('globalState', () => globalState);
     * onMount(async() => {
     *     const globalState = await GlobalState.create();
     *     console.log(globalState);
     * })
     * ```
     */
    static async create() {
        const store = await Store.load("global-state.json", {
            autoSave: true,
        });
        const alreadyInitialized = await store.get<boolean>("initialized");

        const instance = new GlobalState(store);

        if (!alreadyInitialized) {
            await instance.#store.set("initialized", true);
        }
        return instance;
    }

    /**
     * @author SoSweetHam <soham@auvo.io>
     * @description Store hash of app pin lock by providing the pin in 4 digit plain text
     * @param pin - The pin in plain text
     * @returns void
     * @throws Error if the pin is not valid
     * @throws Error if the pin is not set
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
     * @description Set the pin for the app
     * @param pin - The pin in plain text
     * @returns void
     * @throws Error if the pin is not valid
     * @throws Error if the pin is not set
     * @example
     * ```ts
     * const globalState = await GlobalState.create();
     * globalState.pin = "1234";
     * ```
     */
    set pin(pin: string) {
        this.#setPin(pin);
    }

    /**
     * @author SoSweetHam <soham@auvo.io>
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
        return this.#store.get<string>("pin").then((pin) => {
            if (!pin) {
                return undefined;
            }
            return pin;
        });
    }

    /**
     * @author SoSweetHam <soham@auvo.io>
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
        this.#setBiometric(value);
    }

    /**
     * @author SoSweetHam <soham@auvo.io>
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
