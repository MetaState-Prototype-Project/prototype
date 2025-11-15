import { createChat as createChatApi, searchUsers } from '../../utils/api-client';

export interface CreatedChat {
  id: string;
  participants: string[];
  name?: string;
}

/**
 * Create a chat on Pictique
 * participantEnames: array of enames (e.g., ["@user1", "@user2"])
 */
export async function createChat(
  token: string,
  participantEnames: string[]
): Promise<CreatedChat> {
  // Look up user IDs from enames
  const participantIds: string[] = [];
  for (const ename of participantEnames) {
    const users = await searchUsers(ename);
    const user = users.find((u: any) => u.ename === ename);
    if (!user || !user.id) {
      throw new Error(`User not found in Pictique: ${ename}`);
    }
    participantIds.push(user.id);
  }
  
  const chat = await createChatApi(participantIds, undefined, token);
  
  return {
    id: chat.id,
    participants: chat.participants?.map((p: any) => p.id || p) || participantIds,
    name: chat.name,
  };
}

