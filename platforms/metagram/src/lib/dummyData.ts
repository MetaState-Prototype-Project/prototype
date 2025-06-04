import type { CommentType } from './types';
export const dummyPosts = Array.from({ length: 100 }, (_, i) => ({
	id: (i + 1).toString(),
	avatar: 'https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250',
	userId: (i + 1).toString(),
	username: `user${i + 1}`,
	imgUris: [
		'https://picsum.photos/800',
		'https://picsum.photos/600',
		'https://picsum.photos/800',
		'https://picsum.photos/600'
	],
	caption: `This is post number ${i + 1}. Loving how these shots came out! :camera_with_flash:`,
	time: `${i + 1} hours ago`,
	count: {
		likes: Math.floor(Math.random() * 500),
		comments: Math.floor(Math.random() * 200)
	}
}));
export const comments: CommentType[] = Array.from({ length: 50 }, (_, i) => ({
	userImgSrc: 'https://picsum.photos/800',
	name: `user${i + 1}`,
	commentId: `${i + 1}p`,
	comment: `this is the dummy comment which is commented by user${i + 1}`,
	isUpVoted: false,
	isDownVoted: false,
	upVotes: 0,
	time: '2 minutes ago',
	replies: [
		{
			userImgSrc: 'https://picsum.photos/800',
			name: `user${i + 1}x`,
			commentId: `${i + 1}x`,
			comment: `this is the dummy reply which is replied by another${i}x`,
			isUpVoted: false,
			isDownVoted: false,
			upVotes: 0,
			time: '1 minute ago',
			replies: [
				{
					userImgSrc: 'https://picsum.photos/800',
					name: `user${i + 1}a`,
					commentId: `${i + 1}a`,
					comment: `this is the dummy reply which is replied by another${i}a`,
					isUpVoted: false,
					isDownVoted: false,
					upVotes: 0,
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
			isUpVoted: false,
			isDownVoted: false,
			upVotes: 0,
			time: '1 minute ago',
			replies: []
		},
		{
			userImgSrc: 'https://picsum.photos/800',
			name: `user${i + 1}y`,
			commentId: `${i + 1}y`,
			comment: `this is the dummy reply which is replied by another${i}y`,
			isUpVoted: false,
			isDownVoted: false,
			upVotes: 0,
			time: '1 minute ago',
			replies: []
		},
		{
			userImgSrc: 'https://picsum.photos/800',
			name: `user${i + 1}y`,
			commentId: `${i + 1}y`,
			comment: `this is the dummy reply which is replied by another${i}y`,
			isUpVoted: false,
			isDownVoted: false,
			upVotes: 0,
			time: '1 minute ago',
			replies: []
		}
	]
}));
