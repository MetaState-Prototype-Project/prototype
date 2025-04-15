import { Store } from "@tauri-apps/plugin-store";
import { SecurityController } from "./controllers/security";
/**
 * @author SoSweetHam <soham@auvo.io>
 * @description A centralized state that can be used to control the global state of the application, meant to be used as a singleton through the main layout component.
 *
 * You cannot use this class directly, instead use the `GlobalState.create()` method to get an instance.
 */
export class GlobalState {
    #store: Store;
    securityController: SecurityController;
    private constructor(store: Store) {
        this.#store = store;
        this.securityController = new SecurityController(store);
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
}
