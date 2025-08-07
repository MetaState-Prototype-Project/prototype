import type { BeeperMessage, BeeperThread, BeeperUser } from './beeperDbReader';

type TransformInput = {
  users: BeeperUser[];
  threads: BeeperThread[];
  messages: BeeperMessage[];
  sourcePlatform?: string;
};

export type SocialMediaPostPayload = {
  text: string;
  dateCreated: string; // ISO string
  threadId?: string;
  roomId?: string;
  roomName?: string | null;
  senderId?: string;
  senderDisplayName?: string | null;
  sourcePlatform: string;
};

export type MetaEnvelopePayload = {
  ontology: 'SocialMediaPost';
  payload: SocialMediaPostPayload;
};

export class MetaStateTransformer {
  public transform(input: TransformInput): MetaEnvelopePayload[] {
    const { users, threads, messages, sourcePlatform = 'Beeper' } = input;

    const threadById = new Map(threads.map((t) => [t.threadID, t]));
    const userByMatrix = new Map(
      users
        .filter((u) => !!u.matrixId)
        .map((u) => [u.matrixId as string, u])
    );

    // One meta-envelope per message for MVP
    return messages.map((m) => {
      const thread = m.threadID ? threadById.get(m.threadID) : undefined;
      const sender = m.senderMatrixID ? userByMatrix.get(m.senderMatrixID) : undefined;

      const payload: SocialMediaPostPayload = {
        text: m.text ?? '',
        dateCreated: new Date(m.timestamp).toISOString(),
        threadId: m.threadID,
        roomId: thread?.threadID,
        roomName: thread?.name ?? null,
        senderId: m.senderMatrixID,
        senderDisplayName: sender?.displayName ?? sender?.matrixId ?? null,
        sourcePlatform,
      };

      return {
        ontology: 'SocialMediaPost',
        payload,
      };
    });
  }
}

// End of file
