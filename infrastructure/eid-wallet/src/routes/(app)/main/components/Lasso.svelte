<!--
    Hand-drawn purple lasso overlay — wraps the focused card during the
    welcome tour. The path is drawn on with Svelte's `in:draw` transition,
    matching the hand-drawn feel of the source SVGs. The `|global` modifier
    is important: it makes the transition fire when an ancestor block
    (e.g. the card's `{#if isCardRevealed}` wrapper) mounts, not only when
    this component's own `{#if active}` toggles.
-->
<script lang="ts">
import { draw, fade } from "svelte/transition";

export type LassoSize = "sm" | "med" | "lg" | "xl";

const PATHS: Record<LassoSize, { w: number; h: number; d: string }> = {
    sm: {
        w: 207,
        h: 82,
        d: "M7.69326 53.5C0.193286 48 0.0598484 25.2608 2.18018 20.2701C8.00066 6.57014 23.7608 6.73538 34.7631 5.18018C76.2528 -0.684475 178.546 -7.17783 200.835 37.2163C222.811 80.9886 166.148 76.6182 112.898 77.8157C55.3521 79.1098 9.45613 93.7078 14.6934 34",
    },
    med: {
        w: 360,
        h: 122,
        d: "M1 61.3938C1 54.3335 1.63712 38.3243 5.32197 30.6462C15.4372 9.56945 42.8261 9.82366 61.9467 7.43104C134.05 -1.5915 311.822 -11.5813 350.556 56.7174C388.748 124.059 290.276 117.336 197.734 119.178C97.7275 121.169 0.398399 134.604 9.5 42.7454",
    },
    lg: {
        w: 359,
        h: 230,
        d: "M1 162.163C14.8728 116.447 -22.6766 59.8366 37.3862 24.2888C88.6321 -6.04072 293.906 -7.0275 334.433 22.9813C368.817 48.4415 371.312 210.09 302.92 222.014C245.155 232.085 198.208 230.821 140.328 221.086C107.534 215.57 68.8672 223.761 39.3539 209.476C-4.53662 177.042 21.516 140.223 13.2119 103.109",
    },
    xl: {
        w: 366,
        h: 335,
        d: "M1 236.06C15.2001 169.382 -23.2352 86.8144 38.2446 34.9672C90.6995 -9.26904 300.816 -10.7083 342.299 33.0602C377.494 70.1944 380.049 305.962 310.043 323.354C250.915 338.043 202.86 336.199 143.615 322C110.048 313.955 70.4683 325.901 40.2588 305.066C-4.66724 257.761 22 204.06 13.5 149.928",
    },
};

interface ILassoProps {
    size: LassoSize;
    /** Whether the lasso is shown. The path is conditionally mounted so
     *  the draw / fade transitions fire each time it (re)appears. */
    active: boolean;
    /** ms of delay before the line starts drawing — lets the focused card
     *  finish settling first. Default 450ms. */
    drawDelay?: number;
    /** ms duration of the draw animation. Default 800ms. */
    drawDuration?: number;
    /** Optional extra class on the SVG (positioning tweaks per step). */
    class?: string;
}

const {
    size,
    active,
    drawDelay = 450,
    drawDuration = 500,
    class: classes = "",
}: ILassoProps = $props();

const path = $derived(PATHS[size]);
</script>

{#if active}
    <svg
        width={path.w}
        height={path.h}
        viewBox="0 0 {path.w} {path.h}"
        fill="none"
        aria-hidden="true"
        class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-none {classes}"
        out:fade|global={{ duration: 200 }}
    >
        <path
            d={path.d}
            stroke="#8968FF"
            stroke-width="2"
            stroke-linecap="round"
            in:draw|global={{ duration: drawDuration, delay: drawDelay }}
        />
    </svg>
{/if}
