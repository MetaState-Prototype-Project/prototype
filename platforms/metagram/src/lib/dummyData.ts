import type { CommentType } from "./types";

export const dummyPosts = Array.from({ length: 100 }, (_, i) => ({
	id: i + 1,
	avatar: 'https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250',
	username: `user${i + 1}`,
	imgUri: 'https://picsum.photos/800',
	postAlt: 'Sample',
	text: `This is post number ${i + 1}. Loving how these shots came out! 📸`,
	time: `${i + 1} hours ago`,
	count: {
		likes: Math.floor(Math.random() * 500),
		comments: Math.floor(Math.random() * 200)
	}
}));

export const comments: CommentType[] = Array.from({ length: 50 }, (_, i) => ({
	userImgSrc: 'https://picsum.photos/800',
	name: `user${i + 1}`,
	commentId: `${i + 1}`,
	comment: `this is the dummy comment which is commented by user${i + 1}`,
	isLiked: false,
	isDisliked: false,
	likeCount: 0,
	time: '2 minutes ago',
	replies: [
		{
			userImgSrc: 'https://picsum.photos/800',
			name: `user${i + 1}x`,
			commentId: `${i + 1}x`,
			comment: `this is the dummy reply which is replied by another${i}x`,
			isLiked: false,
			isDisliked: false,
			likeCount: 0,
			time: '1 minute ago',
			replies: [
				{
					userImgSrc: 'https://picsum.photos/800',
					name: `user${i + 1}a`,
					commentId: `${i + 1}a`,
					comment: `this is the dummy reply which is replied by another${i}a`,
					isLiked: false,
					isDisliked: false,
					likeCount: 0,
					time: '1 minute ago',
					replies: []
				}
			]
		},
		{
			userImgSrc: 'https://picsum.photos/800',
			name: `user${i + 1}y`,
			commentId: `${i + 1}y`,
			comment: `this is the dummy reply which is replied by another${i}y`,
			isLiked: false,
			isDisliked: false,
			likeCount: 0,
			time: '1 minute ago',
			replies: []
		}
	]
}));
