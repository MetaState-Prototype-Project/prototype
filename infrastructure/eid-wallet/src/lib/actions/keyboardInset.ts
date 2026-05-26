/** Exposes the soft keyboard's height as `--kb-inset` on the node, and locks
 *  document scroll while mounted so the page can't be panned when the
 *  keyboard pushes the layout viewport past the visual viewport. */
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

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";

    const blockTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 1) e.preventDefault();
    };
    document.addEventListener("touchmove", blockTouchMove, { passive: false });

    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    update();

    return {
        destroy() {
            vv?.removeEventListener("resize", update);
            vv?.removeEventListener("scroll", update);
            document.removeEventListener("touchmove", blockTouchMove);
            html.style.overflow = prevHtmlOverflow;
            body.style.overflow = prevBodyOverflow;
            html.style.overscrollBehavior = prevHtmlOverscroll;
            body.style.overscrollBehavior = prevBodyOverscroll;
        },
    };
}
