import { createChat as createChatInFirestore } from '../../utils/firebase-client';

export interface CreatedChat {
  id: string;
  participants: string[];
  name?: string;
}

/**
 * Create a chat on Blabsy
 */
export async function createChat(
  participants: string[],
  name?: string
): Promise<CreatedChat> {
  const chatId = await createChatInFirestore(participants, name);
  
  return {
    id: chatId,
    participants,
    name,
  };
}

