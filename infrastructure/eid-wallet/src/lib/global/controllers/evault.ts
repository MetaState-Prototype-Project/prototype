import type { Store } from "@tauri-apps/plugin-store";

export class VaultController {
    #store: Store;
    constructor(store: Store) {
        this.#store = store;
    }

    set vault(
        vault:
            | Promise<Record<string, string> | undefined>
            | Record<string, string>
            | undefined,
    ) {
        if (vault instanceof Promise) {
            vault
                .then((resolvedUser) => {
                    this.#store.set("vault", resolvedUser);
                })
                .catch((error) => {
                    console.error("Failed to set vault:", error);
                });
        } else {
            this.#store.set("vault", vault);
        }
    }

    get vault() {
        return this.#store
            .get<Record<string, string>>("vault")
            .then((vault) => {
                if (!vault) {
                    return undefined;
                }
                return vault;
            })
            .catch((error) => {
                console.error("Failed to get vault:", error);
                return undefined;
            });
    }
}
