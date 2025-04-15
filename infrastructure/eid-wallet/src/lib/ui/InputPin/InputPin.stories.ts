import type { ComponentProps } from "svelte";
import InputPin from "./InputPin.svelte";

export default {
    title: "UI/InputPin",
    component: InputPin,
    tags: ["autodocs"],
    render: (args: {
        Component: InputPin;
        props: ComponentProps<typeof InputPin>;
    }) => ({
        Component: InputPin,
        props: args,
    }),
};

export const Default = {
    args: {
        size: 4,
    },
};

export const Small = {
    args: {
        size: 4,
        variant: "sm",
    },
};

export const isError = {
    args: {
        size: 4,
        isError: true,
    },
};
