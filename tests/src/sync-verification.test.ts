import { createTestUsers, TestUser } from './utils/user-factory';
import { getAuthToken } from './utils/api-client';
import { config } from './config/env';
import * as falso from '@ngneat/falso';

import { createPost as createBlabsyPost } from './populators/blabsy/posts';
import { createComment as createBlabsyComment } from './populators/blabsy/comments';
import { createLike as createBlabsyLike } from './populators/blabsy/likes';
import { createChat as createBlabsyChat } from './populators/blabsy/chats';
import { createMessage as createBlabsyMessage } from './populators/blabsy/messages';

import { createPost as createPictiquePost } from './populators/pictique/posts';
import { createComment as createPictiqueComment } from './populators/pictique/comments';
import { createLike as createPictiqueLike } from './populators/pictique/likes';
import { createChat as createPictiqueChat } from './populators/pictique/chats';
import { createMessage as createPictiqueMessage } from './populators/pictique/messages';

// Data comparison
import { compareAllData } from './utils/data-comparator';
import { Platform, TestSocialUser, TestSocialUserFactory } from './factories';


const TEST_CONFIG = {
    POSTS_PER_USER: 2,
    COMMENTS_PER_USER: 4,
}

describe('Sync Verification Test', () => {
    const USER_COUNT = config.userCount;
    let loadedUsers: TestUser[] = [];
    let userTokens: Map<string, string> = new Map();
    let testSocialUsers: TestSocialUser[] = [];

    beforeAll(async () => {
        console.log(`Setting up ${USER_COUNT} test users (checking cache first)...`);

        // Clear cache if requested
        if (process.env.CLEAR_USER_CACHE === 'true') {
            const { clearUserCache } = await import('./utils/user-cache');
            clearUserCache();
        }

        // Create or load users from cache
        loadedUsers = await createTestUsers(USER_COUNT);

        // Ensure we have enough users (create more if cache had fewer)
        if (loadedUsers.length < USER_COUNT) {
            console.log(`Cache had ${loadedUsers.length} users, creating ${USER_COUNT - loadedUsers.length} more...`);
            const additionalUsers = await createTestUsers(USER_COUNT - loadedUsers.length, false);
            loadedUsers.push(...additionalUsers);
        }

        console.log(`Using ${loadedUsers.length} test users`);

        for (const user of loadedUsers) {
            const socialUser = TestSocialUserFactory.createRandomPlatform(user.ename);
            testSocialUsers.push(socialUser)
        }

    }, 300000); // 5 minute timeout

    describe('Posts Sync', () => {
        let pictiquePosts: any[] = [];
        let blabsyPosts: any[] = [];
        let loadedPostsFromPictique: any[] = [];
        let loadedPostsFromBlabsy: any[] = [];

        beforeAll(async () => {
            // Create posts from all users
            for (const user of testSocialUsers) {
                const post = await user.createPost(falso.randSentence());
                if (user.metadata.platform === Platform.BLABSY) {
                    blabsyPosts.push(post);
                } else if (user.metadata.platform === Platform.PICTIQUE) {
                    pictiquePosts.push(post);
                }
            }

            // Wait 20 seconds for sync
            await new Promise(resolve => setTimeout(resolve, 20_000));

            // Fetch posts from both platforms
            const [user] = loadedUsers.map(u => TestSocialUserFactory.createForBothPlatforms(u.ename));
            loadedPostsFromPictique = await user.pictique.getAllPosts();
            loadedPostsFromBlabsy = await user.blabsy.getAllPosts();

        }, 300_000); // 45 second timeout (20s wait + post creation + fetch time)

        test('[Posts] Blabsy -> Pictique', () => {
            let pictiquePostSyncCounter = 0;
            for (const post of blabsyPosts) {
                const match = loadedPostsFromPictique.find((p: any) =>
                    p.text === post.text
                );
                if (match) pictiquePostSyncCounter++;
            }
            expect(blabsyPosts.length).toEqual(pictiquePostSyncCounter);
        });

        test('[Posts] Pictique -> Blabsy', () => {
            let blabsyPostSyncCounter = 0;
            for (const post of pictiquePosts) {
                const match = loadedPostsFromBlabsy.find((p: any) =>
                    p.text === post.text
                );
                if (match) blabsyPostSyncCounter++;
            }
            expect(pictiquePosts.length).toEqual(blabsyPostSyncCounter);
        });
    }, 300_000);

    // test('Create entities from both platforms, wait 90s, then verify sync', async () => {
    //     // Need at least 3 users for this test
    //     if (testUsers.length < 3) {
    //         throw new Error('Need at least 3 users for this test');
    //     }
    //
    //     const [user1, user2, user3] = testUsers;
    //     const user1Token = userTokens.get(user1.ename);
    //     const user2Token = userTokens.get(user2.ename);
    //     const user3Token = userTokens.get(user3.ename);
    //
    //     if (!user1Token || !user2Token || !user3Token) {
    //         throw new Error('Failed to get auth tokens for required users');
    //     }
    //
    //     const blabsyPostText = `Blabsy post: ${falso.randSentence()}`;
    //     const blabsyPost = await createBlabsyPost(user1.ename, blabsyPostText);
    //     console.log(`Created Blabsy post: ${blabsyPost.id}`);
    //
    //     // Create one post from Pictique (user 1)
    //     const pictiquePostText = `Pictique post: ${falso.randSentence()}`;
    //     const pictiquePost = await createPictiquePost(user1Token, pictiquePostText);
    //     console.log(`Created Pictique post: ${pictiquePost.id}`);
    //
    //     // Wait a bit for posts to sync before creating comments
    //     await new Promise(resolve => setTimeout(resolve, 5000));
    //
    //     // Create one comment from Blabsy (user 2 on user 1's Blabsy post)
    //     const blabsyCommentText = `Blabsy comment: ${falso.randSentence()}`;
    //     const blabsyComment = await createBlabsyComment(user2.ename, blabsyPost.id, blabsyCommentText);
    //     console.log(`Created Blabsy comment: ${blabsyComment.id}`);
    //
    //     // Create one comment from Pictique (user 2 on user 1's Pictique post)
    //     const pictiqueCommentText = `Pictique comment: ${falso.randSentence()}`;
    //     const pictiqueComment = await createPictiqueComment(user2Token, pictiquePost.id, pictiqueCommentText);
    //     console.log(`Created Pictique comment: ${pictiqueComment.id}`);
    //
    //     // Wait a bit for comments to sync before creating likes
    //     await new Promise(resolve => setTimeout(resolve, 5000));
    //
    //     // Create one like from Blabsy (user 3 on user 1's Blabsy post)
    //     const blabsyLike = await createBlabsyLike(user3.ename, blabsyPost.id);
    //     console.log(`Created Blabsy like: user ${blabsyLike.userId} on post ${blabsyLike.tweetId}`);
    //
    //     // Create one like from Pictique (user 3 on user 1's Pictique post)
    //     const pictiqueLike = await createPictiqueLike(user3Token, pictiquePost.id, user3.ename);
    //     console.log(`Created Pictique like: user ${pictiqueLike.userId} on post ${pictiqueLike.postId}`);
    //
    //     // Create one chat from Blabsy (user 1 + user 2)
    //     const blabsyChat = await createBlabsyChat([user1.ename, user2.ename]);
    //     console.log(`Created Blabsy chat: ${blabsyChat.id}`);
    //
    //     // Create one chat from Pictique (user 1 + user 2)
    //     const pictiqueChat = await createPictiqueChat(user1Token, [user1.ename, user2.ename]);
    //     console.log(`Created Pictique chat: ${pictiqueChat.id}`);
    //
    //     // Wait a bit for chats to sync before creating messages
    //     await new Promise(resolve => setTimeout(resolve, 5000));
    //
    //     // Create one message from Blabsy (user 1 in chat)
    //     const blabsyMessageText = `Blabsy message: ${falso.randSentence()}`;
    //     const blabsyMessage = await createBlabsyMessage(blabsyChat.id, user1.ename, blabsyMessageText);
    //     console.log(`Created Blabsy message: ${blabsyMessage.id}`);
    //
    //     // Create one message from Pictique (user 1 in chat)
    //     const pictiqueMessageText = `Pictique message: ${falso.randSentence()}`;
    //     const pictiqueMessage = await createPictiqueMessage(user1Token, pictiqueChat.id, pictiqueMessageText, user1.ename);
    //     console.log(`Created Pictique message: ${pictiqueMessage.id}`);
    //
    //     console.log('All entities created. Waiting 90 seconds for sync...');
    //     await new Promise(resolve => setTimeout(resolve, 90000)); // 90 seconds
    //
    //     console.log('Fetching all data from both platforms...');
    //
    //     // Fetch all data from both platforms
    //     // Use user1's token to fetch Pictique data
    //     const pictiqueData = await fetchAllPictiqueData(user1Token);
    //     const blabsyData = await fetchAllBlabsyData();
    //
    //     console.log('\n=== Data Summary ===');
    //     console.log(`Pictique: ${pictiqueData.posts.length} posts, ${pictiqueData.comments.length} comments, ${pictiqueData.likes.length} likes, ${pictiqueData.chats.length} chats, ${pictiqueData.messages.length} messages`);
    //     console.log(`Blabsy: ${blabsyData.tweets.length} tweets, ${blabsyData.replies.length} replies, ${blabsyData.likes.length} likes, ${blabsyData.chats.length} chats, ${blabsyData.messages.length} messages`);
    //
    //     // Compare data
    //     console.log('\nComparing data...');
    //     const comparison = await compareAllData(pictiqueData, blabsyData);
    //
    //     console.log('\n=== Comparison Results ===');
    //     console.log(`Posts match: ${comparison.postsMatch} (${comparison.details.matchedPosts}/${comparison.details.pictiquePosts} Pictique, ${comparison.details.blabsyTweets} Blabsy)`);
    //     console.log(`Comments match: ${comparison.commentsMatch} (${comparison.details.matchedComments}/${comparison.details.pictiqueComments} Pictique, ${comparison.details.blabsyReplies} Blabsy)`);
    //     console.log(`Likes match: ${comparison.likesMatch} (${comparison.details.matchedLikes}/${comparison.details.pictiqueLikes} Pictique, ${comparison.details.blabsyLikes} Blabsy)`);
    //     console.log(`Chats match: ${comparison.chatsMatch} (${comparison.details.matchedChats}/${comparison.details.pictiqueChats} Pictique, ${comparison.details.blabsyChats} Blabsy)`);
    //     console.log(`Messages match: ${comparison.messagesMatch} (${comparison.details.matchedMessages}/${comparison.details.pictiqueMessages} Pictique, ${comparison.details.blabsyMessages} Blabsy)`);
    //
    //     if (comparison.errors.length > 0) {
    //         console.log(`\nErrors (showing first 10):`);
    //         comparison.errors.slice(0, 10).forEach(error => console.log(`  - ${error}`));
    //     }
    //
    //     // Verify counts match
    //     expect(comparison.details.pictiquePosts).toBe(comparison.details.blabsyTweets);
    //     expect(comparison.details.pictiqueComments).toBe(comparison.details.blabsyReplies);
    //     expect(comparison.details.pictiqueLikes).toBe(comparison.details.blabsyLikes);
    //     expect(comparison.details.pictiqueChats).toBe(comparison.details.blabsyChats);
    //     expect(comparison.details.pictiqueMessages).toBe(comparison.details.blabsyMessages);
    //
    //     // Verify all entities matched
    //     expect(comparison.postsMatch).toBe(true);
    //     expect(comparison.commentsMatch).toBe(true);
    //     expect(comparison.likesMatch).toBe(true);
    //     expect(comparison.chatsMatch).toBe(true);
    //     expect(comparison.messagesMatch).toBe(true);
    // }, 200000); // 3+ minute timeout (90s wait + setup + verification)
});

