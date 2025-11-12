import { createTestUsers, TestUser } from './utils/user-factory';
import { getAuthToken } from './utils/api-client';
import { config } from './config/env';
import * as falso from '@ngneat/falso';
import Table from 'cli-table3';

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

    // Track expected sync counts and sync times for summary report
    const syncSummary = {
        posts: { blabsy: 0, pictique: 0 },
        chats: { blabsy: 0, pictique: 0 },
        comments: { blabsy: 0, pictique: 0 },
        messages: { blabsy: 0, pictique: 0 },
    };

    // Track actual sync counts
    const actualSyncCounts = {
        posts: { blabsyToPictique: 0, pictiqueToBlabsy: 0 },
        chats: { blabsyToPictique: 0, pictiqueToBlabsy: 0 },
        comments: { blabsyToPictique: 0, pictiqueToBlabsy: 0 },
        messages: { blabsyToPictique: 0, pictiqueToBlabsy: 0 },
    };


    beforeAll(async () => {
        // Clear cache if requested
        if (process.env.CLEAR_USER_CACHE === 'true') {
            const { clearUserCache } = await import('./utils/user-cache');
            clearUserCache();
        }

        // Check if cache exists and is valid before creating users
        const { isCacheValid } = await import('./utils/user-cache');
        const cacheWasValid = isCacheValid(USER_COUNT);
        let usersWereCreated = false;

        // Create or load users from cache
        loadedUsers = await createTestUsers(USER_COUNT);

        // If cache wasn't valid, users were just created
        if (!cacheWasValid) {
            usersWereCreated = true;
        }

        // Ensure we have enough users (create more if cache had fewer)
        if (loadedUsers.length < USER_COUNT) {
            const additionalUsers = await createTestUsers(USER_COUNT - loadedUsers.length, false);
            loadedUsers.push(...additionalUsers);
            usersWereCreated = true;
        }

        // If users were created (not from cache), wait a bit for them to sync
        if (usersWereCreated) {
            console.log('Users were created (not from cache), waiting 10 seconds for sync...');
            await new Promise(resolve => setTimeout(resolve, 10_000));
        }

        for (const user of loadedUsers) {
            const socialUser = TestSocialUserFactory.createRandomPlatform(user.ename);
            testSocialUsers.push(socialUser)
        }

    }, 300000); // 5 minute timeout

    describe('Posts and Chats Sync', () => {
        let pictiquePosts: any[] = [];
        let blabsyPosts: any[] = [];
        let pictiqueChats: any[] = [];
        let blabsyChats: any[] = [];
        let loadedPostsFromPictique: any[] = [];
        let loadedPostsFromBlabsy: any[] = [];
        let loadedChatsFromPictique: any[] = [];
        let loadedChatsFromBlabsy: any[] = [];

        beforeAll(async () => {
            // Batch create posts and chats in parallel (they're independent)
            const createPromises: Promise<any>[] = [];

            // Create posts from all users
            for (const user of testSocialUsers) {
                createPromises.push(
                    user.createPost(falso.randSentence()).then(post => {
                        if (user.metadata.platform === Platform.BLABSY) {
                            blabsyPosts.push(post);
                            syncSummary.posts.blabsy++;
                        } else if (user.metadata.platform === Platform.PICTIQUE) {
                            pictiquePosts.push(post);
                            syncSummary.posts.pictique++;
                        }
                    })
                );
            }

            // Create DMs between n/2 users (all permutations of pairs)
            // Only use first half of users for DM creation
            const dmUserCount = Math.floor(loadedUsers.length / 2);
            const dmUsers = loadedUsers.slice(0, dmUserCount);

            if (dmUsers.length >= 2) {
                // Create all permutations of pairs for DMs
                for (let i = 0; i < dmUsers.length; i++) {
                    for (let j = i + 1; j < dmUsers.length; j++) {
                        const user1 = dmUsers[i];
                        const user2 = dmUsers[j];
                        const user1Blabsy = TestSocialUserFactory.create(Platform.BLABSY, user1.ename);
                        const user1Pictique = TestSocialUserFactory.create(Platform.PICTIQUE, user1.ename);

                        createPromises.push(
                            user1Blabsy.createChat([user1.ename, user2.ename]).then(chat => {
                                blabsyChats.push(chat);
                                syncSummary.chats.blabsy++;
                            })
                        );

                        createPromises.push(
                            user1Pictique.createChat([user1.ename, user2.ename]).then(chat => {
                                pictiqueChats.push(chat);
                                syncSummary.chats.pictique++;
                            })
                        );
                    }
                }
            }

            await Promise.all(createPromises);

            // Wait 20 seconds for sync
            await new Promise(resolve => setTimeout(resolve, 20_000));

            // Fetch all data from both platforms
            const [user] = loadedUsers.map(u => TestSocialUserFactory.createForBothPlatforms(u.ename));
            loadedPostsFromPictique = await user.pictique.getAllPosts();
            loadedPostsFromBlabsy = await user.blabsy.getAllPosts();

            // For Pictique, fetch chats from ALL users since getUserChats only returns chats for the logged-in user
            const pictiqueChatsSet = new Map<string, any>();
            for (const testUser of loadedUsers) {
                const pictiqueUser = TestSocialUserFactory.create(Platform.PICTIQUE, testUser.ename);
                const userChats = await pictiqueUser.getAllChats();
                for (const chat of userChats) {
                    if (!pictiqueChatsSet.has(chat.id)) {
                        pictiqueChatsSet.set(chat.id, chat);
                    }
                }
            }
            loadedChatsFromPictique = Array.from(pictiqueChatsSet.values());

            // For Blabsy, we can fetch all chats directly from Firestore
            loadedChatsFromBlabsy = await user.blabsy.getAllChats();
        }, 300_000);

        test('[Posts] Blabsy -> Pictique', () => {
            const failedSyncs: any[] = [];
            let pictiquePostSyncCounter = 0;
            for (const post of blabsyPosts) {
                const match = loadedPostsFromPictique.find((p: any) =>
                    p.text === post.text
                );
                if (match) {
                    pictiquePostSyncCounter++;
                } else {
                    failedSyncs.push({ type: 'post', id: post.id, text: post.text, platform: 'Blabsy' });
                }
            }
            actualSyncCounts.posts.blabsyToPictique = pictiquePostSyncCounter;
            if (failedSyncs.length > 0) {
                console.log('\n❌ Failed to sync Blabsy -> Pictique:', JSON.stringify(failedSyncs, null, 2));
            }
            expect(blabsyPosts.length).toEqual(pictiquePostSyncCounter);
        });

        test('[Posts] Pictique -> Blabsy', () => {
            const failedSyncs: any[] = [];
            let blabsyPostSyncCounter = 0;
            for (const post of pictiquePosts) {
                const match = loadedPostsFromBlabsy.find((p: any) =>
                    p.text === post.text
                );
                if (match) {
                    blabsyPostSyncCounter++;
                } else {
                    failedSyncs.push({ type: 'post', id: post.id, text: post.text, platform: 'Pictique' });
                }
            }
            actualSyncCounts.posts.pictiqueToBlabsy = blabsyPostSyncCounter;
            if (failedSyncs.length > 0) {
                console.log('\n❌ Failed to sync Pictique -> Blabsy:', JSON.stringify(failedSyncs, null, 2));
            }
            expect(pictiquePosts.length).toEqual(blabsyPostSyncCounter);
        });

        test('[Chats] Blabsy -> Pictique', () => {
            if (blabsyChats.length === 0) {
                return;
            }

            // Helper function to compare participant arrays properly
            const arraysEqual = (a: string[], b: string[]): boolean => {
                if (a.length !== b.length) return false;
                const setA = new Set(a);
                const setB = new Set(b);
                if (setA.size !== setB.size) return false;
                for (const item of setA) {
                    if (!setB.has(item)) return false;
                }
                return true;
            };

            console.log(`\n🔍 DEBUG: Looking for ${blabsyChats.length} Blabsy chats in ${loadedChatsFromPictique.length} Pictique chats`);
            console.log(`📋 Created Blabsy chats (from test creation):`);
            for (const c of blabsyChats) {
                const participants = (c.participants || []).map((p: string) => {
                    const normalized = p.startsWith('@') ? p.slice(1) : p;
                    return `@${normalized}`;
                }).sort();
                console.log(`  - Chat ${c.id}:`, JSON.stringify(participants));
            }
            console.log(`📋 Fetched Blabsy chats (from Firestore):`);
            for (const c of loadedChatsFromBlabsy) {
                const participants = (c.participants || []).map((p: string) => {
                    const normalized = p.startsWith('@') ? p.slice(1) : p;
                    return `@${normalized}`;
                }).sort();
                console.log(`  - Chat ${c.id}:`, JSON.stringify(participants));
            }

            // Verify all created chats exist in Firestore
            const createdChatIds = new Set(blabsyChats.map(c => c.id));
            const fetchedChatIds = new Set(loadedChatsFromBlabsy.map((c: any) => c.id));
            const missingChats = blabsyChats.filter(c => !fetchedChatIds.has(c.id));
            if (missingChats.length > 0) {
                console.error(`\n⚠️ WARNING: ${missingChats.length} created Blabsy chats not found in Firestore:`, missingChats.map(c => c.id));
            }
            console.log(`📋 Available Pictique chats:`);
            for (const c of loadedChatsFromPictique) {
                const participants = (c.participants || []).map((p: any) => ({
                    id: p.id,
                    handle: p.handle,
                    ename: p.ename,
                    normalized: p.handle ? `@${p.handle}` : (p.ename || `@${p.id}`)
                }));
                console.log(`  - Chat ${c.id}:`, JSON.stringify(participants, null, 2));
            }

            const failedSyncs: any[] = [];
            let pictiqueChatSyncCounter = 0;
            const usedPictiqueChatIds = new Set<string>(); // Track matched chats to avoid duplicates

            for (const chat of blabsyChats) {
                // Blabsy participants are enames (with or without @)
                const blabsyParticipants = (chat.participants || []).map((p: string) => {
                    // Normalize: remove @ if present, then add it back for consistency
                    const normalized = p.startsWith('@') ? p.slice(1) : p;
                    return `@${normalized}`;
                }).sort();

                console.log(`\n🔍 Looking for Blabsy chat ${chat.id} with participants:`, blabsyParticipants);

                const match = loadedChatsFromPictique.find((c: any) => {
                    // Skip if already matched
                    if (usedPictiqueChatIds.has(c.id)) {
                        console.log(`  ⏭️  Skipping Pictique chat ${c.id} (already matched)`);
                        return false;
                    }

                    // Pictique participants - use handle (without @)
                    const pictiqueParticipants = (c.participants || []).map((p: any) => {
                        // Handle never has @, so always add it
                        if (!p.handle) {
                            console.error('  ❌ Pictique participant missing handle:', p);
                        }
                        return `@${p.handle}`;
                    }).sort();

                    console.log(`  🔎 Comparing with Pictique chat ${c.id} participants:`, pictiqueParticipants);
                    const isMatch = arraysEqual(blabsyParticipants, pictiqueParticipants);
                    console.log(`  ${isMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
                    return isMatch;
                });

                if (match) {
                    pictiqueChatSyncCounter++;
                    usedPictiqueChatIds.add(match.id);
                    console.log(`  ✅ Matched Blabsy chat ${chat.id} with Pictique chat ${match.id}`);
                } else {
                    console.log(`  ❌ NO MATCH FOUND for Blabsy chat ${chat.id}`);
                    failedSyncs.push({ type: 'chat', id: chat.id, participants: blabsyParticipants, platform: 'Blabsy' });
                }
            }

            actualSyncCounts.chats.blabsyToPictique = pictiqueChatSyncCounter;
            if (failedSyncs.length > 0) {
                console.log('\n❌ Failed to sync Blabsy -> Pictique:', JSON.stringify(failedSyncs, null, 2));
            }
            expect(blabsyChats.length).toEqual(pictiqueChatSyncCounter);
        });

        test('[Chats] Pictique -> Blabsy', () => {
            if (pictiqueChats.length === 0) {
                return;
            }

            // Helper function to compare participant arrays properly
            const arraysEqual = (a: string[], b: string[]): boolean => {
                if (a.length !== b.length) return false;
                const setA = new Set(a);
                const setB = new Set(b);
                if (setA.size !== setB.size) return false;
                for (const item of setA) {
                    if (!setB.has(item)) return false;
                }
                return true;
            };

            const failedSyncs: any[] = [];
            let blabsyChatSyncCounter = 0;
            const usedBlabsyChatIds = new Set<string>(); // Track matched chats to avoid duplicates

            for (const chat of pictiqueChats) {
                // Pictique participants - use handle (without @)
                const pictiqueParticipants = (chat.participants || []).map((p: any) => {
                    // Handle never has @, so always add it
                    if (!p.handle) {
                        console.error('Pictique participant missing handle:', p);
                    }
                    return `@${p.handle}`;
                }).sort();

                const match = loadedChatsFromBlabsy.find((c: any) => {
                    // Skip if already matched
                    if (usedBlabsyChatIds.has(c.id)) return false;

                    // Blabsy participants are enames (with or without @)
                    const blabsyParticipants = (c.participants || []).map((p: string) => {
                        // Normalize: remove @ if present, then add it back for consistency
                        const normalized = p.startsWith('@') ? p.slice(1) : p;
                        return `@${normalized}`;
                    }).sort();

                    return arraysEqual(pictiqueParticipants, blabsyParticipants);
                });

                if (match) {
                    blabsyChatSyncCounter++;
                    usedBlabsyChatIds.add(match.id);
                } else {
                    failedSyncs.push({ type: 'chat', id: chat.id, participants: pictiqueParticipants, platform: 'Pictique' });
                }
            }

            actualSyncCounts.chats.pictiqueToBlabsy = blabsyChatSyncCounter;
            if (failedSyncs.length > 0) {
                console.log('\n❌ Failed to sync Pictique -> Blabsy:', JSON.stringify(failedSyncs, null, 2));
            }
            expect(pictiqueChats.length).toEqual(blabsyChatSyncCounter);
        });
    }, 300_000);

    describe('Comments and Messages Sync', () => {
        let pictiqueComments: any[] = [];
        let blabsyComments: any[] = [];
        let pictiqueMessages: any[] = [];
        let blabsyMessages: any[] = [];
        let blabsyPostIdForComments: string | null = null;
        let pictiquePostIdForComments: string | null = null;
        let syncedPictiquePostId: string | null = null;
        let syncedBlabsyPostId: string | null = null;

        beforeAll(async () => {
            // Get posts and chats from both platforms (from previous test)
            const [user] = loadedUsers.map(u => TestSocialUserFactory.createForBothPlatforms(u.ename));
            const allPictiquePosts = await user.pictique.getAllPosts();
            const allBlabsyPosts = await user.blabsy.getAllPosts();
            const allPictiqueChats = await user.pictique.getAllChats();
            const allBlabsyChats = await user.blabsy.getAllChats();

            // Find posts for comments
            if (allBlabsyPosts.length > 0) {
                const blabsyPost = allBlabsyPosts[0];
                blabsyPostIdForComments = blabsyPost.id;
                const syncedPost = allPictiquePosts.find((p: any) => p.text === blabsyPost.text);
                if (syncedPost) {
                    syncedPictiquePostId = syncedPost.id;
                }
            }

            if (allPictiquePosts.length > 0) {
                const pictiquePost = allPictiquePosts[0];
                pictiquePostIdForComments = pictiquePost.id;
                const syncedPost = allBlabsyPosts.find((p: any) => p.text === pictiquePost.text);
                if (syncedPost) {
                    syncedBlabsyPostId = syncedPost.id;
                }
            }


            // Batch create comments and messages in parallel
            const createPromises: Promise<any>[] = [];

            // Create comments from Blabsy users on Blabsy posts
            if (blabsyPostIdForComments) {
                for (const user of testSocialUsers) {
                    if (user.metadata.platform === Platform.BLABSY) {
                        createPromises.push(
                            user.createComment(blabsyPostIdForComments, falso.randSentence()).then(comment => {
                                blabsyComments.push(comment);
                                syncSummary.comments.blabsy++;
                            })
                        );
                    }
                }
            }

            // Create comments from Pictique users on Pictique posts
            if (pictiquePostIdForComments) {
                for (const user of testSocialUsers) {
                    if (user.metadata.platform === Platform.PICTIQUE) {
                        createPromises.push(
                            user.createComment(pictiquePostIdForComments, falso.randSentence()).then(comment => {
                                pictiqueComments.push(comment);
                                syncSummary.comments.pictique++;
                            })
                        );
                    }
                }
            }

            // Create messages from users who are actually participants in ALL chats
            // Each user sends 1 message per chat

            // Use all Blabsy chats
            for (const blabsyChat of allBlabsyChats) {
                const chatParticipantEnames = (blabsyChat.participants || []).map((p: string) =>
                    p.startsWith('@') ? p : `@${p}`
                );

                // Only create messages from users who are participants in the chat
                for (const user of loadedUsers) {
                    const userEname = user.ename.startsWith('@') ? user.ename : `@${user.ename}`;
                    if (chatParticipantEnames.includes(userEname)) {
                        const blabsyUser = TestSocialUserFactory.create(Platform.BLABSY, user.ename);
                        createPromises.push(
                            blabsyUser.createMessage(blabsyChat.id, falso.randSentence()).then(message => {
                                blabsyMessages.push(message);
                                syncSummary.messages.blabsy++;
                            })
                        );
                    }
                }
            }

            // Use all Pictique chats
            for (const pictiqueChat of allPictiqueChats) {
                const chatParticipantEnames = (pictiqueChat.participants || []).map((p: any) => {
                    const ename = p.ename || p.id || p;
                    return ename.startsWith('@') ? ename : `@${ename}`;
                });

                // Only create messages from users who are participants in the chat
                for (const user of loadedUsers) {
                    const userEname = user.ename.startsWith('@') ? user.ename : `@${user.ename}`;
                    if (chatParticipantEnames.includes(userEname)) {
                        const pictiqueUser = TestSocialUserFactory.create(Platform.PICTIQUE, user.ename);
                        createPromises.push(
                            pictiqueUser.createMessage(pictiqueChat.id, falso.randSentence()).then(message => {
                                pictiqueMessages.push(message);
                                syncSummary.messages.pictique++;
                            })
                        );
                    }
                }
            }

            await Promise.all(createPromises);

            // Wait 20 seconds for sync
            await new Promise(resolve => setTimeout(resolve, 20_000));

        }, 300_000);

        test('[Comments] Blabsy -> Pictique', async () => {
            if (!blabsyPostIdForComments || !syncedPictiquePostId || blabsyComments.length === 0) {
                return;
            }

            const [user] = loadedUsers.map(u => TestSocialUserFactory.createForBothPlatforms(u.ename));
            const loadedCommentsFromPictique = await user.pictique.getAllComments(syncedPictiquePostId);

            const failedSyncs: any[] = [];
            let pictiqueCommentSyncCounter = 0;
            for (const comment of blabsyComments) {
                const match = loadedCommentsFromPictique.find((c: any) =>
                    c.text === comment.text
                );
                if (match) {
                    pictiqueCommentSyncCounter++;
                } else {
                    failedSyncs.push({ type: 'comment', id: comment.id, text: comment.text, platform: 'Blabsy' });
                }
            }
            if (failedSyncs.length > 0) {
                console.log('\n❌ Failed to sync Blabsy -> Pictique:', JSON.stringify(failedSyncs, null, 2));
            }
            expect(blabsyComments.length).toEqual(pictiqueCommentSyncCounter);
        });

        test('[Comments] Pictique -> Blabsy', async () => {
            if (!pictiquePostIdForComments || !syncedBlabsyPostId || pictiqueComments.length === 0) {
                return;
            }

            const [user] = loadedUsers.map(u => TestSocialUserFactory.createForBothPlatforms(u.ename));
            const loadedCommentsFromBlabsy = await user.blabsy.getAllComments(syncedBlabsyPostId);

            const failedSyncs: any[] = [];
            let blabsyCommentSyncCounter = 0;
            for (const comment of pictiqueComments) {
                const match = loadedCommentsFromBlabsy.find((c: any) =>
                    c.text === comment.text
                );
                if (match) {
                    blabsyCommentSyncCounter++;
                } else {
                    failedSyncs.push({ type: 'comment', id: comment.id, text: comment.text, platform: 'Pictique' });
                }
            }
            if (failedSyncs.length > 0) {
                console.log('\n❌ Failed to sync Pictique -> Blabsy:', JSON.stringify(failedSyncs, null, 2));
            }
            expect(pictiqueComments.length).toEqual(blabsyCommentSyncCounter);
        });

        test('[Messages] Blabsy -> Pictique', async () => {
            if (blabsyMessages.length === 0) {
                return;
            }

            console.log(`\n🔍 DEBUG: Checking ${blabsyMessages.length} Blabsy messages for sync`);
            console.log(`📋 Blabsy messages:`, blabsyMessages.map(m => ({
                id: m.id,
                chatId: m.chatId,
                text: m.text?.substring(0, 50) + '...',
                senderId: m.senderId
            })));

            const [user] = loadedUsers.map(u => TestSocialUserFactory.createForBothPlatforms(u.ename));
            const allBlabsyChats = await user.blabsy.getAllChats();
            
            // For Pictique, fetch chats from ALL users since getUserChats only returns chats for the logged-in user
            const pictiqueChatsSet = new Map<string, any>();
            for (const testUser of loadedUsers) {
                const pictiqueUser = TestSocialUserFactory.create(Platform.PICTIQUE, testUser.ename);
                const userChats = await pictiqueUser.getAllChats();
                for (const chat of userChats) {
                    if (!pictiqueChatsSet.has(chat.id)) {
                        pictiqueChatsSet.set(chat.id, chat);
                    }
                }
            }
            const allPictiqueChats = Array.from(pictiqueChatsSet.values());
            console.log(`📋 Found ${allPictiqueChats.length} Pictique chats from all users`);

            // Build a map of Blabsy chat ID -> Pictique chat ID
            const chatIdMap = new Map<string, string>();
            for (const blabsyChat of allBlabsyChats) {
                const blabsyParticipants = (blabsyChat.participants || []).map((p: string) =>
                    p.startsWith('@') ? p : `@${p}`
                ).sort();

                const syncedChat = allPictiqueChats.find((c: any) => {
                    const pictiqueParticipants = (c.participants || []).map((p: any) => {
                        const handle = p.handle || p.id;
                        return handle ? `@${handle}` : (p.ename ? (p.ename.startsWith('@') ? p.ename : `@${p.ename}`) : `@${p.id}`);
                    }).sort();
                    return JSON.stringify(blabsyParticipants) === JSON.stringify(pictiqueParticipants);
                });

                if (syncedChat) {
                    chatIdMap.set(blabsyChat.id, syncedChat.id);
                    console.log(`✅ Mapped Blabsy chat ${blabsyChat.id} -> Pictique chat ${syncedChat.id}`);
                } else {
                    console.log(`❌ No Pictique chat found for Blabsy chat ${blabsyChat.id} with participants:`, blabsyParticipants);
                }
            }

            const failedSyncs: any[] = [];
            let pictiqueMessageSyncCounter = 0;

            // Group messages by chat ID
            const messagesByChat = new Map<string, any[]>();
            for (const message of blabsyMessages) {
                const chatId = message.chatId;
                if (!messagesByChat.has(chatId)) {
                    messagesByChat.set(chatId, []);
                }
                messagesByChat.get(chatId)!.push(message);
            }

            console.log(`\n📋 Messages grouped by chat:`, Array.from(messagesByChat.entries()).map(([chatId, msgs]) => ({
                blabsyChatId: chatId,
                messageCount: msgs.length,
                messages: msgs.map(m => ({ id: m.id, text: m.text?.substring(0, 30) + '...' }))
            })));

            // Check each chat's messages
            for (const [blabsyChatId, messages] of messagesByChat.entries()) {
                console.log(`\n🔍 Checking messages for Blabsy chat ${blabsyChatId} (${messages.length} messages)`);
                const pictiqueChatId = chatIdMap.get(blabsyChatId);
                if (!pictiqueChatId) {
                    console.log(`  ❌ Chat ${blabsyChatId} didn't sync to Pictique, marking all ${messages.length} messages as failed`);
                    // Chat didn't sync, all messages failed
                    messages.forEach(msg => {
                        failedSyncs.push({ type: 'message', id: msg.id, text: msg.text, platform: 'Blabsy', chatId: blabsyChatId });
                    });
                    continue;
                }

                console.log(`  ✅ Chat synced: Blabsy ${blabsyChatId} -> Pictique ${pictiqueChatId}`);

                // Find a user who is a participant in this Pictique chat to fetch messages
                const pictiqueChat = allPictiqueChats.find(c => c.id === pictiqueChatId);
                let participantUser = user.pictique;
                if (pictiqueChat && pictiqueChat.participants && pictiqueChat.participants.length > 0) {
                    // Get the first participant's handle (which is ename without @)
                    const firstParticipant = pictiqueChat.participants[0];
                    const participantHandle = firstParticipant.handle || firstParticipant.id;
                    console.log(`  👤 First participant handle: ${participantHandle}`);
                    
                    // Find a test user whose ename (without @) matches the participant's handle
                    const participantTestUser = loadedUsers.find(u => {
                        const userHandle = u.ename.startsWith('@') ? u.ename.slice(1) : u.ename;
                        return userHandle === participantHandle;
                    });
                    
                    if (participantTestUser) {
                        participantUser = TestSocialUserFactory.create(Platform.PICTIQUE, participantTestUser.ename);
                        console.log(`  ✅ Using participant user: ${participantTestUser.ename}`);
                    } else {
                        console.log(`  ⚠️  Could not find participant user for handle ${participantHandle}, using default user`);
                    }
                }
                
                console.log(`  📥 Fetching messages from Pictique chat ${pictiqueChatId}...`);
                const loadedMessagesFromPictique = await participantUser.getAllMessages(pictiqueChatId);
                console.log(`  📥 Found ${loadedMessagesFromPictique.length} messages in Pictique chat`);
                console.log(`  📋 Pictique messages:`, loadedMessagesFromPictique.map((m: any) => ({
                    id: m.id,
                    text: m.text?.substring(0, 50) + '...',
                    senderId: m.sender?.id || m.senderId
                })));

                for (const message of messages) {
                    console.log(`  🔎 Looking for Blabsy message: "${message.text?.substring(0, 50)}..."`);
                    const match = loadedMessagesFromPictique.find((m: any) =>
                        m.text === message.text
                    );
                    if (match) {
                        console.log(`    ✅ MATCH found! Pictique message ID: ${match.id}`);
                        pictiqueMessageSyncCounter++;
                    } else {
                        console.log(`    ❌ NO MATCH - message not found in Pictique`);
                        failedSyncs.push({ type: 'message', id: message.id, text: message.text, platform: 'Blabsy', chatId: blabsyChatId });
                    }
                }
            }

            if (failedSyncs.length > 0) {
                console.log('\n❌ Failed to sync Blabsy -> Pictique:', JSON.stringify(failedSyncs, null, 2));
            }
            expect(blabsyMessages.length).toEqual(pictiqueMessageSyncCounter);
        });

        test('[Messages] Pictique -> Blabsy', async () => {
            if (pictiqueMessages.length === 0) {
                return;
            }

            const [user] = loadedUsers.map(u => TestSocialUserFactory.createForBothPlatforms(u.ename));
            const allBlabsyChats = await user.blabsy.getAllChats();
            
            // For Pictique, fetch chats from ALL users since getUserChats only returns chats for the logged-in user
            const pictiqueChatsSet = new Map<string, any>();
            for (const testUser of loadedUsers) {
                const pictiqueUser = TestSocialUserFactory.create(Platform.PICTIQUE, testUser.ename);
                const userChats = await pictiqueUser.getAllChats();
                for (const chat of userChats) {
                    if (!pictiqueChatsSet.has(chat.id)) {
                        pictiqueChatsSet.set(chat.id, chat);
                    }
                }
            }
            const allPictiqueChats = Array.from(pictiqueChatsSet.values());

            // Build a map of Pictique chat ID -> Blabsy chat ID
            const chatIdMap = new Map<string, string>();
            for (const pictiqueChat of allPictiqueChats) {
                const pictiqueParticipants = (pictiqueChat.participants || []).map((p: any) => {
                    const ename = p.ename || p.id || p;
                    return ename.startsWith('@') ? ename : `@${ename}`;
                }).sort();

                const syncedChat = allBlabsyChats.find((c: any) => {
                    const blabsyParticipants = (c.participants || []).map((p: string) =>
                        p.startsWith('@') ? p : `@${p}`
                    ).sort();
                    return JSON.stringify(pictiqueParticipants) === JSON.stringify(blabsyParticipants);
                });

                if (syncedChat) {
                    chatIdMap.set(pictiqueChat.id, syncedChat.id);
                }
            }

            const failedSyncs: any[] = [];
            let blabsyMessageSyncCounter = 0;

            // Group messages by chat ID
            const messagesByChat = new Map<string, any[]>();
            for (const message of pictiqueMessages) {
                const chatId = message.chatId;
                if (!messagesByChat.has(chatId)) {
                    messagesByChat.set(chatId, []);
                }
                messagesByChat.get(chatId)!.push(message);
            }

            // Check each chat's messages
            for (const [pictiqueChatId, messages] of messagesByChat.entries()) {
                const blabsyChatId = chatIdMap.get(pictiqueChatId);
                if (!blabsyChatId) {
                    // Chat didn't sync, all messages failed
                    messages.forEach(msg => {
                        failedSyncs.push({ type: 'message', id: msg.id, text: msg.text, platform: 'Pictique', chatId: pictiqueChatId });
                    });
                    continue;
                }

                const loadedMessagesFromBlabsy = await user.blabsy.getAllMessages(blabsyChatId);

                for (const message of messages) {
                    const match = loadedMessagesFromBlabsy.find((m: any) =>
                        m.text === message.text
                    );
                    if (match) {
                        blabsyMessageSyncCounter++;
                    } else {
                        failedSyncs.push({ type: 'message', id: message.id, text: message.text, platform: 'Pictique', chatId: pictiqueChatId });
                    }
                }
            }

            if (failedSyncs.length > 0) {
                console.log('\n❌ Failed to sync Pictique -> Blabsy:', JSON.stringify(failedSyncs, null, 2));
            }
            expect(pictiqueMessages.length).toEqual(blabsyMessageSyncCounter);
        });
    }, 300_000);

    afterAll(() => {
        // Helper function to format status
        const formatStatus = (expected: number, actual: number): string => {
            if (expected === actual) {
                return '✅';
            }
            return '❌';
        };

        // Create table
        const table = new Table({
            head: ['Entity Type', 'Expected', 'Actual', 'Status'],
            style: {
                head: ['cyan', 'bold'],
                border: ['gray'],
            },
            colWidths: [30, 10, 10, 10],
        });

        // Posts
        const postsBlabsyToPictique = syncSummary.posts.blabsy;
        const postsPictiqueToBlabsy = syncSummary.posts.pictique;
        const actualPostsBlabsyToPictique = actualSyncCounts.posts.blabsyToPictique;
        const actualPostsPictiqueToBlabsy = actualSyncCounts.posts.pictiqueToBlabsy;

        table.push(
            ['Posts: Blabsy → Pictique', postsBlabsyToPictique, actualPostsBlabsyToPictique, formatStatus(postsBlabsyToPictique, actualPostsBlabsyToPictique)],
            ['Posts: Pictique → Blabsy', postsPictiqueToBlabsy, actualPostsPictiqueToBlabsy, formatStatus(postsPictiqueToBlabsy, actualPostsPictiqueToBlabsy)]
        );

        // Chats
        const chatsBlabsyToPictique = syncSummary.chats.blabsy;
        const chatsPictiqueToBlabsy = syncSummary.chats.pictique;
        const actualChatsBlabsyToPictique = actualSyncCounts.chats.blabsyToPictique;
        const actualChatsPictiqueToBlabsy = actualSyncCounts.chats.pictiqueToBlabsy;

        table.push(
            ['Chats: Blabsy → Pictique', chatsBlabsyToPictique, actualChatsBlabsyToPictique, formatStatus(chatsBlabsyToPictique, actualChatsBlabsyToPictique)],
            ['Chats: Pictique → Blabsy', chatsPictiqueToBlabsy, actualChatsPictiqueToBlabsy, formatStatus(chatsPictiqueToBlabsy, actualChatsPictiqueToBlabsy)]
        );

        // Comments
        const commentsBlabsyToPictique = syncSummary.comments.blabsy;
        const commentsPictiqueToBlabsy = syncSummary.comments.pictique;
        const actualCommentsBlabsyToPictique = actualSyncCounts.comments.blabsyToPictique;
        const actualCommentsPictiqueToBlabsy = actualSyncCounts.comments.pictiqueToBlabsy;

        table.push(
            ['Comments: Blabsy → Pictique', commentsBlabsyToPictique, actualCommentsBlabsyToPictique, formatStatus(commentsBlabsyToPictique, actualCommentsBlabsyToPictique)],
            ['Comments: Pictique → Blabsy', commentsPictiqueToBlabsy, actualCommentsPictiqueToBlabsy, formatStatus(commentsPictiqueToBlabsy, actualCommentsPictiqueToBlabsy)]
        );

        // Messages
        const messagesBlabsyToPictique = syncSummary.messages.blabsy;
        const messagesPictiqueToBlabsy = syncSummary.messages.pictique;
        const actualMessagesBlabsyToPictique = actualSyncCounts.messages.blabsyToPictique;
        const actualMessagesPictiqueToBlabsy = actualSyncCounts.messages.pictiqueToBlabsy;

        table.push(
            ['Messages: Blabsy → Pictique', messagesBlabsyToPictique, actualMessagesBlabsyToPictique, formatStatus(messagesBlabsyToPictique, actualMessagesBlabsyToPictique)],
            ['Messages: Pictique → Blabsy', messagesPictiqueToBlabsy, actualMessagesPictiqueToBlabsy, formatStatus(messagesPictiqueToBlabsy, actualMessagesPictiqueToBlabsy)]
        );

        // Summary statistics
        const totalExpected = postsBlabsyToPictique + postsPictiqueToBlabsy +
            chatsBlabsyToPictique + chatsPictiqueToBlabsy +
            commentsBlabsyToPictique + commentsPictiqueToBlabsy +
            messagesBlabsyToPictique + messagesPictiqueToBlabsy;
        const totalActual = actualPostsBlabsyToPictique + actualPostsPictiqueToBlabsy +
            actualChatsBlabsyToPictique + actualChatsPictiqueToBlabsy +
            actualCommentsBlabsyToPictique + actualCommentsPictiqueToBlabsy +
            actualMessagesBlabsyToPictique + actualMessagesPictiqueToBlabsy;
        const successRate = totalExpected > 0 ? ((totalActual / totalExpected) * 100).toFixed(1) : '0.0';

        // Print summary
        console.log('\n\n📊 SYNC VERIFICATION SUMMARY REPORT');
        console.log('═══════════════════════════════════════════════════════════════════════════════\n');
        console.log(table.toString());
        console.log(`\n📈 Overall: ${totalActual}/${totalExpected} synced (${successRate}% success rate)\n`);
    });
});

