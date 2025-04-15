import type { Store } from "@tauri-apps/plugin-store";

/**
 * @version Stub/0.0.1-Alpha
 * @author SoSweetHam <soham@auvo.io>
 *
 * @description A controller for the user data in the store, meant to be used as a singleton through the global state.
 *
 * Would eventually use the w3id package to manage user data stuff
 * Uses the following namespaces in the store:
 * @param {unknown} user - Data based on user passport
 * @param {string} ename - W3ID compliant string
 *
 * @memberof GlobalState
 * You should not use this class directly, it is intended for use through the GlobalState.
 *
 *
 * @constructor Meant to be used as a singleton through the GlobalState, should already be handled.
 * @param store - The store to use for storing the user data
 *
 * @example
 * ```ts
 * import { GlobalState } from "./state";
 * const globalState = await GlobalState.create();
 * globalState.userController.updateUserData({ name: "John Doe" });
 * console.log(globalState.userController.userData);
 * ```
 */
export class UserController {
    #store: Store;
    constructor(store: Store) {
        this.#store = store;
    }
}
