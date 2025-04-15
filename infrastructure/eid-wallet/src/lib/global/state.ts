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
}
