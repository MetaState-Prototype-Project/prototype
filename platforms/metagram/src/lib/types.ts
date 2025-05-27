import { type SVGAttributes } from 'svelte/elements';

export interface ISvgProps extends SVGAttributes<SVGElement> {
	size?: number | string;
	color?: string;
}

export type CommentType = {
	commentId: string;
	name: string;
	userImgSrc: string;
	comment: string;
	isLiked: boolean;
	isDisliked: boolean;
	likeCount: number;
	time: string;
	replies: CommentType[];
};
