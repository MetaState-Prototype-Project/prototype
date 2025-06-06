import type { ComponentProps } from "svelte";
import { Textarea } from "..";

export default {
    title: "UI/Textarea",
    component: Textarea,
    tags: ["autodocs"],
    render: (args: {
        Component: Textarea;
        props: ComponentProps<typeof Textarea>;
    }) => ({
        Component: Textarea,
        props: args,
    }),
};

export const Primary = {
    args: {
        rows: 5,
        placeholder: "Hey guys...",
    },
};
