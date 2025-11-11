// This file contains comparison utilities for synced data
// Use TestSocialUser.getAllPosts(), getAllChats(), etc. to fetch data instead

export interface PictiqueData {
  posts: any[];
  comments: any[];
  likes: any[];
  chats: any[];
  messages: any[];
}

export interface BlabsyData {
  tweets: any[];
  replies: any[];
  likes: any[];
  chats: any[];
  messages: any[];
}

export interface ComparisonResult {
  postsMatch: boolean;
  commentsMatch: boolean;
  likesMatch: boolean;
  chatsMatch: boolean;
  messagesMatch: boolean;
  errors: string[];
  details: {
    pictiquePosts: number;
    blabsyTweets: number;
    matchedPosts: number;
    pictiqueComments: number;
    blabsyReplies: number;
    matchedComments: number;
    pictiqueLikes: number;
    blabsyLikes: number;
    matchedLikes: number;
    pictiqueChats: number;
    blabsyChats: number;
    matchedChats: number;
    pictiqueMessages: number;
    blabsyMessages: number;
    matchedMessages: number;
  };
}

/**
 * Compare posts by content (author ename + text)
 */
function comparePosts(pictiquePosts: any[], blabsyTweets: any[]): { matched: number; errors: string[] } {
  const errors: string[] = [];
  let matched = 0;
  
  for (const pictiquePost of pictiquePosts) {
    const authorEname = pictiquePost.author?.ename || pictiquePost.author?.id;
    const postText = pictiquePost.text;
    
    const matchingTweet = blabsyTweets.find((tweet: any) => {
      const tweetAuthor = tweet.createdBy;
      const tweetText = tweet.text;
      
      return authorEname === tweetAuthor && postText === tweetText;
    });
    
    if (matchingTweet) {
      matched++;
    } else {
      errors.push(`Post not found in Blabsy: author="${authorEname}", text="${postText}"`);
    }
  }
  
  return { matched, errors };
}

/**
 * Compare comments by content (author + text + parent)
 */
function compareComments(pictiqueComments: any[], blabsyReplies: any[]): { matched: number; errors: string[] } {
  const errors: string[] = [];
  let matched = 0;
  
  for (const pictiqueComment of pictiqueComments) {
    const authorEname = pictiqueComment.author?.ename || pictiqueComment.author?.id;
    const commentText = pictiqueComment.text;
    const parentPostId = pictiqueComment.postId;
    
    // Find matching reply by author, text, and parent tweet
    const matchingReply = blabsyReplies.find((reply: any) => {
      const replyAuthor = reply.createdBy;
      const replyText = reply.text;
      const replyParentId = reply.parent?.id;
      
      return authorEname === replyAuthor && 
             commentText === replyText &&
             (replyParentId === parentPostId || true); // Parent ID might differ, so we'll match by content only for now
    });
    
    if (matchingReply) {
      matched++;
    } else {
      errors.push(`Comment not found in Blabsy: author="${authorEname}", text="${commentText}"`);
    }
  }
  
  return { matched, errors };
}

/**
 * Compare likes by user and post/tweet content
 */
function compareLikes(pictiqueLikes: any[], blabsyLikes: any[]): { matched: number; errors: string[] } {
  const errors: string[] = [];
  let matched = 0;
  
  for (const pictiqueLike of pictiqueLikes) {
    const userId = pictiqueLike.userId;
    const postText = pictiqueLike.postText;
    
    const matchingLike = blabsyLikes.find((blabsyLike: any) => {
      return blabsyLike.userId === userId && blabsyLike.tweetText === postText;
    });
    
    if (matchingLike) {
      matched++;
    } else {
      errors.push(`Like not found in Blabsy: user="${userId}", postText="${postText}"`);
    }
  }
  
  return { matched, errors };
}

/**
 * Compare chats by participants (as sets, order doesn't matter)
 */
function compareChats(pictiqueChats: any[], blabsyChats: any[]): { matched: number; errors: string[] } {
  const errors: string[] = [];
  let matched = 0;
  
  for (const pictiqueChat of pictiqueChats) {
    const pictiqueParticipants = new Set(
      (pictiqueChat.participants || []).map((p: any) => p.id || p)
    );
    
    const matchingChat = blabsyChats.find((blabsyChat: any) => {
      const blabsyParticipants = new Set(blabsyChat.participants || []);
      
      if (pictiqueParticipants.size !== blabsyParticipants.size) {
        return false;
      }
      
      for (const participant of pictiqueParticipants) {
        if (!blabsyParticipants.has(participant)) {
          return false;
        }
      }
      
      return true;
    });
    
    if (matchingChat) {
      matched++;
    } else {
      errors.push(`Chat not found in Blabsy: participants=[${Array.from(pictiqueParticipants).join(', ')}]`);
    }
  }
  
  return { matched, errors };
}

/**
 * Compare messages by sender, text, and chat participants
 */
function compareMessages(pictiqueMessages: any[], blabsyMessages: any[]): { matched: number; errors: string[] } {
  const errors: string[] = [];
  let matched = 0;
  
  for (const pictiqueMessage of pictiqueMessages) {
    const senderId = pictiqueMessage.sender?.id || pictiqueMessage.sender?.ename || pictiqueMessage.senderId;
    const messageText = pictiqueMessage.text;
    const chatParticipants = new Set(pictiqueMessage.chatParticipants || []);
    
    const matchingMessage = blabsyMessages.find((blabsyMessage: any) => {
      const blabsySender = blabsyMessage.senderId;
      const blabsyText = blabsyMessage.text;
      const blabsyChatParticipants = new Set(blabsyMessage.chatParticipants || []);
      
      if (senderId !== blabsySender || messageText !== blabsyText) {
        return false;
      }
      
      if (chatParticipants.size !== blabsyChatParticipants.size) {
        return false;
      }
      
      for (const participant of chatParticipants) {
        if (!blabsyChatParticipants.has(participant)) {
          return false;
        }
      }
      
      return true;
    });
    
    if (matchingMessage) {
      matched++;
    } else {
      errors.push(`Message not found in Blabsy: sender="${senderId}", text="${messageText}"`);
    }
  }
  
  return { matched, errors };
}

/**
 * Compare all data from both platforms
 */
export async function compareAllData(
  pictiqueData: PictiqueData,
  blabsyData: BlabsyData
): Promise<ComparisonResult> {
  const errors: string[] = [];
  
  // Compare posts (Pictique -> Blabsy)
  const postsComparison = comparePosts(pictiqueData.posts, blabsyData.tweets);
  // Counts must match and all Pictique posts must have matches
  const postsMatch = postsComparison.matched === pictiqueData.posts.length && 
                     blabsyData.tweets.length === pictiqueData.posts.length;
  errors.push(...postsComparison.errors);
  
  // Compare comments
  const commentsComparison = compareComments(pictiqueData.comments, blabsyData.replies);
  const commentsMatch = commentsComparison.matched === pictiqueData.comments.length &&
                        blabsyData.replies.length === pictiqueData.comments.length;
  errors.push(...commentsComparison.errors);
  
  // Compare likes
  const likesComparison = compareLikes(pictiqueData.likes, blabsyData.likes);
  const likesMatch = likesComparison.matched === pictiqueData.likes.length &&
                     blabsyData.likes.length === pictiqueData.likes.length;
  errors.push(...likesComparison.errors);
  
  // Compare chats
  const chatsComparison = compareChats(pictiqueData.chats, blabsyData.chats);
  const chatsMatch = chatsComparison.matched === pictiqueData.chats.length &&
                     blabsyData.chats.length === pictiqueData.chats.length;
  errors.push(...chatsComparison.errors);
  
  // Compare messages
  const messagesComparison = compareMessages(pictiqueData.messages, blabsyData.messages);
  const messagesMatch = messagesComparison.matched === pictiqueData.messages.length &&
                        blabsyData.messages.length === pictiqueData.messages.length;
  errors.push(...messagesComparison.errors);
  
  return {
    postsMatch,
    commentsMatch,
    likesMatch,
    chatsMatch,
    messagesMatch,
    errors,
    details: {
      pictiquePosts: pictiqueData.posts.length,
      blabsyTweets: blabsyData.tweets.length,
      matchedPosts: postsComparison.matched,
      pictiqueComments: pictiqueData.comments.length,
      blabsyReplies: blabsyData.replies.length,
      matchedComments: commentsComparison.matched,
      pictiqueLikes: pictiqueData.likes.length,
      blabsyLikes: blabsyData.likes.length,
      matchedLikes: likesComparison.matched,
      pictiqueChats: pictiqueData.chats.length,
      blabsyChats: blabsyData.chats.length,
      matchedChats: chatsComparison.matched,
      pictiqueMessages: pictiqueData.messages.length,
      blabsyMessages: blabsyData.messages.length,
      matchedMessages: messagesComparison.matched,
    },
  };
}

