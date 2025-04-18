import type { Store } from "@tauri-apps/plugin-store";

/**
 * @author SoSweetHam <soham@auvo.io>
 * @version 0.0.1-alpha/Stub
 * @date 2025-04-16
 * Would evolve with w3id spec and implementation proposals
 *
 * @description A user controller that can be used to manage the user state of the application.
 *
 * Uses the following namespaces in the store:
 * - `user` - The user state
 *
 * @memberof GlobalState
 * You should not use this class directly, it is intended for use through the GlobalState.
 *
 * @constructor Meant to be used as a singleton through the GlobalState, should already be handled.
 * @param store - The store to use for storing the user state
 * @example
 * ```ts
 * import { GlobalState } from "./state";
 * const globalState = await GlobalState.create();
 * globalState.userController.user = {
 *    name: "John Doe",
 *    "Date of Birth": "01/01/2000",
 *    "ID submitted": "American Passport",
 *    "Passport Number": "1234567-US"
 * };
 * console.log(globalState.userController.user);
 * ```
 */
export class UserController {
    #store: Store;
    constructor(store: Store) {
        this.#store = store;
    }

    /**
     * @author SoSweetHam <soham@auvo.io>
     * @description Sets the user state in the store
     *
     * @returns {void}
     * @example
     * ```ts
     * import { GlobalState } from "./state";
     * const globalState = await GlobalState.create();
     * globalState.userController.user = {
     *   name: "John Doe",
     *   "Date of Birth": "01/01/2000",
     *   "ID submitted": "American Passport",
     *   "Passport Number": "1234567-US"
     * };
     * console.log(globalState.userController.user);
     * ```
     * @throws {Error} If the user state cannot be set in the store
     */
    set user(
        user:
            | Promise<Record<string, string> | undefined>
            | Record<string, string>
            | undefined
    ) {
        this.#store.set("user", user);
    }

    get user() {
        return this.#store.get<Record<string, string>>("user").then((user) => {
            if (!user) {
                return undefined;
            }
            return user;
        });
    }
}
