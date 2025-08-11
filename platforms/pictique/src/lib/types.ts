import type { SVGAttributes } from 'svelte/elements';

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
	createdAt: string | number | Date;
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

export interface Post {
	id: string;
	text: string;
	images: string[];
	author: {
		id: string;
		handle: string;
		name: string;
		avatarUrl: string;
	};
	createdAt: string;
	likedBy: userProfile[];
	comments: {
		id: string;
		text: string;
		author: {
			id: string;
			handle: string;
			name: string;
			avatarUrl: string;
		};
		createdAt: string;
	}[];
}

export type userProfile = {
	id: string;
	handle: string;
	name: string;
	description: string;
	avatarUrl: string;
	totalPosts: number;
	followers: number;
	following: number;
	posts: PostData[];
	username: string;
};

export type Image = {
	url: string;
	alt: string;
};

export type GroupInfo = {
	id: string;
	name: string;
	avatar: string;
};

export type Chat = {
	id: string;
	avatar: string;
	handle: string;
	unread: boolean;
	text: string;
	participants: {
		id: string;
		name?: string;
		handle?: string;
		ename?: string;
		avatarUrl: string;
	}[];
	latestMessage: {
		text: string;
		isRead: boolean;
	};
};

export type MessageType = {
	id: string;
	avatar: string;
	handle: string;
	unread: boolean;
	text: string;
	name: string;
	username: string;
};
