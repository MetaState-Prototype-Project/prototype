// Moves the host element to `target` (default <body>). Lets `position: fixed`
// descendants escape a transformed ancestor's stacking context.
export function portal(
    node: HTMLElement,
    initialTarget: HTMLElement | string = "body",
) {
    let current = initialTarget;

    function mount() {
        const targetEl =
            typeof current === "string"
                ? document.querySelector(current)
                : current;
        if (targetEl) targetEl.appendChild(node);
    }

    mount();

    return {
        update(newTarget: HTMLElement | string) {
            current = newTarget;
            mount();
        },
        destroy() {
            if (node.parentNode) node.parentNode.removeChild(node);
        },
    };
}
