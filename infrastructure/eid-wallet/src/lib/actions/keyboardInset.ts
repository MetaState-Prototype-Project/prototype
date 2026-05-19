/** Exposes the soft keyboard's height as `--kb-inset` on the node. */
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
