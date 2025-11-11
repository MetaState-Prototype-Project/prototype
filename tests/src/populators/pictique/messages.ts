import { sendMessage as sendMessageApi } from '../../utils/api-client';

export interface CreatedMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
}

/**
 * Create a message on Pictique
 */
export async function createMessage(
  token: string,
  chatId: string,
  text: string,
  senderId: string
): Promise<CreatedMessage> {
  const message = await sendMessageApi(chatId, text, token);
  
  return {
    id: message.id,
    chatId,
    senderId,
    text: message.text,
  };
}

