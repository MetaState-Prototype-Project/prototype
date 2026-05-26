<script lang="ts">
interface IEditIconProps {
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
}: IEditIconProps = $props();
</script>

<svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 17 17"
    fill="none"
    class={classes}
    aria-hidden="true"
>
    <path
        opacity="0.8"
        d="M1.0018 11.8866C0.986619 11.6032 1.09258 11.3267 1.29326 11.1261L8.75328 3.66603C8.96851 3.4508 9.30272 3.40997 9.56344 3.56704C10.1552 3.92355 10.8291 3.24963 10.4726 2.6579C10.3155 2.39718 10.3563 2.06297 10.5716 1.84774L11.1264 1.29287C11.517 0.902351 12.1501 0.902351 12.5407 1.29287L14.7517 3.50395C15.1423 3.89448 15.1423 4.52764 14.7517 4.91816L14.1969 5.47303C13.9816 5.68826 13.6474 5.7291 13.3867 5.57202C12.795 5.21552 12.1211 5.88944 12.4776 6.48116C12.6346 6.74188 12.5938 7.07609 12.3786 7.29132L4.91855 14.7513C4.71787 14.952 4.44136 15.058 4.15796 15.0428L1.25196 14.8872C1.20094 14.8844 1.16018 14.8437 1.15745 14.7926L1.0018 11.8866Z"
        stroke={color}
        stroke-width="2"
    />
</svg>
