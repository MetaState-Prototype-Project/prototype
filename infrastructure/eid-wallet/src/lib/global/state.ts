import { invoke } from "@tauri-apps/api/core";
import { Store } from "@tauri-apps/plugin-store";

/**
 * @author SoSweetHam
 * @description A centralized state that can be used to control the global state of the application, meant to be used as a singleton through the  main layout component.
 *
 * You cannot use this class directly, instead use the `GlobalState.create()` method to get an instance.
 */
export class GlobalState {
    #store: Store;
    private constructor(store: Store) {
        this.#store = store;
    }

    /**
     * @author SoSweetHam
     * @description Creator of the GlobalState singleton
     * @returns A promise of a new instance of GlobalState
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
     * @author SoSweetHam
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

    set pin(pin: string) {
        this.#setPin(pin).catch((err) => {
            console.error("Error setting pin", err);
        });
    }

    get pinHash() {
        return this.#store.get<string>("pin").then((pin) => {
            if (pin === undefined || pin === null) {
                return undefined;
            }
            return pin;
        });
    }
}
