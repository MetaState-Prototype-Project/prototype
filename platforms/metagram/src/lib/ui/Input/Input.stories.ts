import { Input } from "..";

export default {
    title: "UI/Input",
    component: Input,
    tags: ["autodocs"],
    render: (args: {
        type: string;
        placeholder: string;
        helperText: string;
    }) => ({
        Component: Input,
        props: args,
    }),
};

export const Text = {
    args: {
        type: "text",
        placeholder: "Joe Biden",
    },
};

export const Tel = {
    args: {
        type: "tel",
        placeholder: "987654321",
    },
};

export const number = {
    args: {
        type: "number",
        placeholder: "Enter something",
    },
};

export const Email = {
    args: {
        type: "email",
        placeholder: "example@email.com",
    },
};

export const Password = {
    args: {
        type: "password",
        placeholder: "Please enter password",
    },
};
