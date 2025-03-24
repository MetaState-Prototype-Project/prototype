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

export const Primary = {
    args: {
        title: "Create PIN",
        isBackRequired: false,
        isUserLoggedIn: false
    },
};

export const Secondary = {
    args: {
        title: "Create PIN",
        isBackRequired: true,
        isUserLoggedIn: false
    },
};

export const Tertiary = {
    args: {
        title: "Create PIN",
        isBackRequired: true,
        isUserLoggedIn: true
    },
};