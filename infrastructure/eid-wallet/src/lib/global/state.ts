import { Store } from "@tauri-apps/plugin-store";
import { SecurityController } from "./controllers/security";
import { UserController } from "./controllers/user";
/**
 * @author SoSweetHam <soham@auvo.io>
 * @description A centralized state that can be used to control the global state of the application, meant to be used as a singleton through the main layout component.
 *
 * @constructor
 * You cannot instance this class directly, instead use the `GlobalState.create()` method to get an instance.
 *
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
export class GlobalState {
    #store: Store;
    securityController: SecurityController;
    userController: UserController;
    private constructor(store: Store) {
        this.#store = store;
        this.securityController = new SecurityController(store);
        this.userController = new UserController(store);
    }

    /**
     * @author SoSweetHam <soham@auvo.io>
     * @description Creator of the GlobalState singleton
     * @returns A promise of a new instance of GlobalState
     * @throws Error if the store cannot be loaded
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
