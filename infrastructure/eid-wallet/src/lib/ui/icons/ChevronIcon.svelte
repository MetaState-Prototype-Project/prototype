<script lang="ts">
interface IChevronIconProps {
    /** Width and height in px. Default 17. */
    size?: number;
    /** Any CSS color. Default `currentColor` so the parent's text-* class drives it. */
    color?: string;
    class?: string;
}

const {
    size = 17,
    color = "currentColor",
    class: classes = "",
}: IChevronIconProps = $props();
</script>

<svg
    width={size}
    height={size}
    viewBox="0 0 8 13"
    fill="none"
    class={classes}
    xmlns="http://www.w3.org/2000/svg"
>
    <path
        d="M6.91401 12L1.41406 6.49995L6.91401 1"
        stroke={color}
        stroke-width="2"
        stroke-linecap="round"
    />
</svg>
