<script lang="ts">
interface IPinIconProps {
    size?: number;
    /** Shield outline color. Default currentColor. */
    color?: string;
    class?: string;
}

const {
    size = 24,
    color = "currentColor",
    class: classes = "",
}: IPinIconProps = $props();
</script>

<svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    class={classes}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
>
    <path
        opacity="0.8"
        d="M5 2H19C19.5523 2 20 2.44772 20 3V10.3828C20 13.9036 18.1482 17.1652 15.125 18.9697L12.5127 20.5293C12.197 20.7177 11.803 20.7177 11.4873 20.5293L8.875 18.9697C5.85184 17.1652 4 13.9036 4 10.3828V3C4 2.44772 4.44772 2 5 2Z"
        stroke={color}
        stroke-width="2"
        stroke-linejoin="round"
    />
    <path
        d="M12 7L12.0018 9.99757L14.8532 9.07295L12.0029 10.0009L13.7634 12.4271L12 10.003L10.2366 12.4271L11.9971 10.0009L9.14683 9.07295L11.9982 9.99757L12 7Z"
        fill="#D9D9D9"
        stroke="#4A515E"
        stroke-width="2"
    />
</svg>
