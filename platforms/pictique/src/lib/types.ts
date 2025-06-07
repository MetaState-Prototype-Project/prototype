import type { SVGAttributes } from "svelte/elements";

export interface ISvgProps extends SVGAttributes<SVGElement> {
    size?: number | string;
    color?: string;
}

export type CommentType = {
    commentId: string;
    name: string;
    userImgSrc: string;
    comment: string;
    isUpVoted: boolean;
    isDownVoted: boolean;
    upVotes: number;
    time: string;
    replies: CommentType[];
};

export type PostData = {
    id: string;
    avatar: string;
    userId: string;
    username: string;
    imgUris: string[];
    caption: string;
    time: string;
    count: {
        likes: number;
        comments: number;
    };
};

export type userProfile = {
    userId: string;
    username: string;
    avatar: string;
    totalPosts: number;
    followers: number;
    following: number;
    userBio: string;
    posts: PostData[];
};

export type Image = {
    url: string;
    alt: string;
};
