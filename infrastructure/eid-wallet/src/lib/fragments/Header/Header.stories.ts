import Header from "./Header.svelte";

export default {
    title: "Fragments/Header",
    component: Header,
    tags: ["autodocs"],
    render: (args: any) => ({
        Component: Header,
        props: args,
    }),
};

export const Main = {
    args: {
    },
};
