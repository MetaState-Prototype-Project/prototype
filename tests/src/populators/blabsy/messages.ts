import { sendMessage } from '../../utils/firebase-client';

export interface CreatedMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
}

/**
 * Create a message on Blabsy
 */
export async function createMessage(
  chatId: string,
  senderId: string,
  text: string
): Promise<CreatedMessage> {
  const messageId = await sendMessage(chatId, senderId, text);
  
  return {
    id: messageId,
    chatId,
    senderId,
    text,
  };
}

