<script lang="ts">
interface IMessageIconProps {
    /** Width and height in px. Default 24. */
    size?: number;
    /** Any CSS color. Default `currentColor` so the parent's text-* class drives it. */
    color?: string;
    class?: string;
}

const {
    size = 24,
    color = "currentColor",
    class: classes = "",
}: IMessageIconProps = $props();
</script>

<svg
    width={size}
    height={size}
    viewBox="0 0 25 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class={classes}
    aria-hidden="true"
>
    <path
        d="M10.3682 3H18.3682C21.1296 3 23.3682 5.23858 23.3682 8V17C23.3682 19.7614 21.1296 22 18.3682 22H3.67871C0.791166 22 -0.0457989 18.0566 2.59277 16.8838C4.28051 16.1337 5.36816 14.4592 5.36816 12.6123V8C5.36816 5.23858 7.60674 3 10.3682 3Z"
        stroke={color}
        stroke-width="2"
    />
    <rect
        x="9.86816"
        y="9.5"
        width="9"
        height="1"
        rx="0.5"
        stroke={color}
    />
    <rect
        x="9.86816"
        y="14.5"
        width="6"
        height="1"
        rx="0.5"
        stroke={color}
    />
</svg>
