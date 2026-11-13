<script lang="ts">
export interface IllustrationLabel {
    /** Centre of the label, in the illustration's own pixel coordinates. */
    x: number;
    y: number;
    /** Newline-separated; translators control where the break falls. */
    text: string;
    /** Widest the label may run before it is shrunk to fit. Set it where a
     *  drawn shape boxes the text in — Russian runs ~30% longer than English
     *  and would otherwise cross the outline. */
    maxWidth?: number;
}

const {
    src,
    width,
    height,
    labels,
    size = 50,
}: {
    src: string;
    width: number;
    height: number;
    labels: IllustrationLabel[];
    size?: number;
} = $props();

const LINE_HEIGHT = 1.15;

const lines = $derived(
    labels.flatMap((label) => {
        const parts = label.text.split("\n");
        const offset = ((parts.length - 1) * size * LINE_HEIGHT) / 2;
        return parts.map((text, i) => ({
            text,
            x: label.x,
            y: label.y - offset + i * size * LINE_HEIGHT,
            maxWidth: label.maxWidth,
        }));
    }),
);

let elements = $state<(SVGTextElement | undefined)[]>([]);

// Measured rather than guessed: the shrink has to follow whatever string is
// on screen, including one that arrives from the correction catalog.
$effect(() => {
    for (const [i, line] of lines.entries()) {
        const el = elements[i];
        if (!el) continue;
        el.setAttribute("font-size", String(size));
        if (!line.maxWidth) continue;
        const measured = el.getComputedTextLength();
        if (measured > line.maxWidth) {
            el.setAttribute(
                "font-size",
                String(Math.floor((size * line.maxWidth) / measured)),
            );
        }
    }
});
</script>

<div class="relative">
    <img
        {src}
        alt=""
        class="w-full h-auto rounded-2xl shrink-0"
        aria-hidden="true"
    />
    <svg
        viewBox="0 0 {width} {height}"
        class="absolute inset-0 w-full h-full"
        aria-hidden="true"
    >
        {#each lines as line, i (i)}
            <text
                bind:this={elements[i]}
                x={line.x}
                y={line.y}
                text-anchor="middle"
                dominant-baseline="central"
                font-size={size}
                font-weight="700"
                fill="#8968FF"
            >{line.text}</text>
        {/each}
    </svg>
</div>
