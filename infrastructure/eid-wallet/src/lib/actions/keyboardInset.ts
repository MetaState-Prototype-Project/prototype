/**
 * Svelte action that exposes the on-screen keyboard's height as a CSS custom
 * property `--kb-inset` on the node it's applied to. Tracks `visualViewport`
 * (the standards-based way to detect the soft keyboard on Android WebView /
 * iOS Safari) and updates the variable on every resize / scroll.
 *
 * Usage:
 *   <main use:keyboardInset style="padding-bottom: calc(16px + var(--kb-inset, 0px));">
 *
 * The inset is `window.innerHeight - visualViewport.height`, clamped to 0 so
 * a missing viewport (older browsers / desktop) leaves the variable at 0.
 */
export function keyboardInset(node: HTMLElement) {
    const vv = window.visualViewport;

    const update = () => {
        if (!vv) {
            node.style.setProperty("--kb-inset", "0px");
            return;
        }
        const inset = Math.max(0, window.innerHeight - vv.height);
        node.style.setProperty("--kb-inset", `${inset}px`);
    };

    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    update();

    return {
        destroy() {
            vv?.removeEventListener("resize", update);
            vv?.removeEventListener("scroll", update);
        },
    };
}
