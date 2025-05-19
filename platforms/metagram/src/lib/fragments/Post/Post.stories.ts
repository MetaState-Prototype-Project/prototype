import type { ComponentProps } from "svelte";
import Post from "./Post.svelte";

export default {
    title: "Fragments/Post",
    component: Post,
    tags: ["autodocs"],
    render: (args: {
        Component: Post;
        props: ComponentProps<typeof Post>;
    }) => ({
        Component: Post,
        props: args,
    }),
};

export const Primary = {
    args: {
        avatar: "https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250",
        username: "blurryface",
        imgUri: "https://graphicsfamily.com/wp-content/uploads/edd/2023/01/Free-Photographer-Social-Media-Post-Design-Template-870x870.jpg",
        postAlt: "Sample",
        text: "Took some pictures today! Really love how this one in particular turned out! ",
        time: "2 hours ago",
        count: {
            likes: 100,
            comments: 50,
        },
        callback: {
            like: () => {
                alert("Like clicked");
            },
            comment: () => {
                alert("Comment clicked");
            },
            menu: () => {
                alert("Menu clicked");
            },
        },
    },
};
