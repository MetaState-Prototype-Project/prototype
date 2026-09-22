/**
 * Runtime state for the current run of the app, as opposed to the persisted
 * configuration the other controllers own.
 *
 * Every other controller wraps the Tauri store, so everything they hold
 * survives the app being killed: is a PIN set, is an identity enrolled, are
 * biometrics enabled. Those are configuration questions.
 *
 * "Has the user authenticated?" is not one of them. It must be forgotten when
 * the app is killed, or a deep link arriving on a cold start would inherit a
 * login from a previous run and skip the prompt entirely.
 *
 * It must equally SURVIVE the webview being rebuilt, which is not the same
 * event. Approving a deep-link login hands off to the browser via openUrl, and
 * Android is free to reload the backgrounded webview; the approve path also
 * does a document navigation to the platform's redirect. Neither is a new run
 * of the app, and the current flow has no way to re-prompt in the middle of
 * one, so an in-memory field would strand the user.
 *
 * sessionStorage is exactly that lifetime: dies with the tab/app, survives a
 * reload. Hence a controller that, unlike its siblings, takes no Store and
 * reads sessionStorage directly.
 *
 * See docs/architecture/deepLink.md.
 */
export class SessionController {
    static readonly #AUTHENTICATED_KEY = "walletAuthenticated";

    #storage(): Storage | null {
        try {
            return typeof sessionStorage === "undefined"
                ? null
                : sessionStorage;
        } catch {
            // Private mode / storage disabled. Degrade to "not authenticated"
            // rather than throwing inside a deep-link callback, where a throw
            // is invisible to the user and strands the flow.
            return null;
        }
    }

    /**
     * Record that the user is through the authentication gate.
     *
     * Callers must do this BEFORE any await that precedes their navigation, so
     * a deep link delivered mid-flight sees the user as authenticated and
     * routes itself rather than storing a payload nobody is left to collect.
     */
    markAuthenticated(): void {
        try {
            this.#storage()?.setItem(
                SessionController.#AUTHENTICATED_KEY,
                "true",
            );
        } catch (error) {
            // Reaching the storage object can succeed while writing to it
            // fails: quota exhausted, or Safari-style private mode where
            // setItem always throws. The caller has already authenticated, and
            // its catch treats a throw as failed authentication, so letting
            // this escape would bounce a signed-in user back to the PIN screen.
            console.warn("Could not persist the session marker:", error);
        }
    }

    get isAuthenticated(): boolean {
        try {
            return (
                this.#storage()?.getItem(
                    SessionController.#AUTHENTICATED_KEY,
                ) === "true"
            );
        } catch (error) {
            // Read failures fall back to "not authenticated", which costs the
            // user a prompt. The alternative is throwing inside the layout's
            // deep-link gate, which would drop the payload entirely.
            console.warn("Could not read the session marker:", error);
            return false;
        }
    }

    /**
     * Called by GlobalState.reset() on logout.
     *
     * Required, not defensive: logout does an SPA navigation to "/", which
     * leaves sessionStorage intact. Without this the session would keep
     * claiming the user is authenticated, and the next deep link would route
     * itself straight to the consent screen on the strength of a login that
     * has already ended.
     */
    async clear(): Promise<void> {
        try {
            this.#storage()?.removeItem(SessionController.#AUTHENTICATED_KEY);
        } catch (error) {
            // GlobalState.reset() runs every controller's clear() in one try
            // block, so rejecting here would skip the rest of logout and leave
            // the vault and keys behind.
            console.warn("Could not clear the session marker:", error);
        }
    }
}
