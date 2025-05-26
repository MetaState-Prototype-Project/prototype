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
	},
	callback: {
		like: () => alert(`Like clicked on post ${i + 1}`),
		comment: () => alert(`Comment clicked on post ${i + 1}`),
		menu: () => alert(`Menu clicked on post ${i + 1}`)
	}
}));
