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
	isUpVoted: boolean;
	isDownVoted: boolean;
	upVotes: number;
	time: string;
	replies: CommentType[];
};

export type PostData = {
	id: number;
	avatar: string;
	username: string;
	imgUri: string;
	postAlt: string;
	text: string;
	time: string;
	count: {
		likes: number;
		comments: number;
	};
};
