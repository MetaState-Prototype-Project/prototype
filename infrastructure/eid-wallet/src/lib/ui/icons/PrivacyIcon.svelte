<script lang="ts">
interface IPrivacyIconProps {
    size?: number;
    color?: string;
    class?: string;
}

const {
    size = 24,
    color = "currentColor",
    class: classes = "",
}: IPrivacyIconProps = $props();
</script>

<svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    class={classes}
    xmlns="http://www.w3.org/2000/svg"
>
    <path
        opacity="0.8"
        d="M6 2H14.1152C14.397 2 14.6659 2.11867 14.8555 2.32715L18.7402 6.60059C18.9075 6.78463 19 7.02475 19 7.27344V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V3C5 2.44772 5.44772 2 6 2Z"
        stroke={color}
        stroke-width="2"
        stroke-linejoin="round"
    />
    <path
        opacity="0.8"
        d="M9 10H15"
        stroke={color}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    />
    <path
        opacity="0.8"
        d="M9 14H13"
        stroke={color}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    />
</svg>
