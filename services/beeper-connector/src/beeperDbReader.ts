import Database from 'better-sqlite3';

// --- Beeper Data Interfaces (Based on Visual Schema) ---

// From 'users' table (and potentially 'accounts' for more details)
export interface BeeperUser {
  userID: string; // From users.userID
  accountID?: string; // From users.accountID
  matrixId?: string; // Assuming 'user' column in 'users' might be a matrix ID or similar unique identifier
  displayName?: string; // Potentially from a props table or if 'user' is a rich object
  avatarUrl?: string; // Potentially from a props table
}

// From 'threads' table
export interface BeeperThread {
  threadID: string; // From threads.threadID
  accountID: string; // From threads.accountID
  name?: string; // If 'thread' column contains a name, or from a props table
  timestamp?: number; // From threads.timestamp (creation or last activity)
  isDirect?: boolean; // This might need to be inferred or found in a props table
}

// From 'messages' table
export interface BeeperMessage {
  messageID: string; // Assuming 'messages' has a primary key like 'messageID' or 'id'
  threadID: string; // Foreign key to BeeperThread (e.g., messages.threadID)
  senderMatrixID: string; // From messages.sender (assuming it's a matrix ID)
  text?: string; // From messages.text_content or similar
  htmlText?: string; // If there's an HTML version
  timestamp: number; // From messages.timestamp or created_at
  isRead?: boolean; // Potentially from messages.is_read or mx_read_receipts
  isFromMe?: boolean; // Potentially from messages.is_from_me or by comparing senderID to own user ID
  attachmentPath?: string; // If attachments are stored locally and referenced
  // platformName?: string; // from accounts.platformName via accountID
  // Other fields like reactions, edits could be added from mx_reactions, mx_events etc.
}

// --- End Beeper Data Interfaces ---

export class BeeperDbReader {
  private db: Database.Database;

  constructor(dbPath: string) {
    try {
      this.db = new Database(dbPath, { readonly: true, fileMustExist: true });
      console.log('Connected to Beeper database.');
    } catch (err: any) {
      console.error('Error opening Beeper database:', err.message);
      throw err;
    }
  }

  public async getUsers(): Promise<BeeperUser[]> {
    // TODO: Implement SQL query for 'users' table
    // Consider joining with 'accounts' if more user/account details are needed.
    // Example: SELECT userID, accountID, user as matrixId FROM users;
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare("SELECT UserID as userID, AccountID as accountID, User as matrixId FROM users");
        const rows = stmt.all() as BeeperUser[];
        resolve(rows);
      } catch (err: any) {
        reject(new Error(`Error fetching users: ${err.message}`));
      }
    });
  }

  public async getThreads(accountID?: string): Promise<BeeperThread[]> {
    // TODO: Implement SQL query for 'threads' table
    // Optionally filter by accountID
    // Example: SELECT threadID, accountID, thread as name, timestamp FROM threads;
    // Need to determine how to get thread name and isDirect status (likely from props or by analyzing participants)
    let query = "SELECT ThreadID as threadID, AccountID as accountID, Thread as name, Timestamp as timestamp FROM threads";
    const params: any[] = [];
    if (accountID) {
      query += " WHERE AccountID = ?";
      params.push(accountID);
    }
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params) as BeeperThread[];
        resolve(rows);
      } catch (err: any) {
        reject(new Error(`Error fetching threads: ${err.message}`));
      }
    });
  }

  public async getMessages(threadID: string, since?: Date, limit: number = 100): Promise<BeeperMessage[]> {
    // TODO: Implement SQL query for 'messages' table, filtered by threadID
    // Join with 'mx_room_messages' or 'mx_events' if necessary for full content or event types
    // Handle 'since' for incremental fetching and 'limit' for pagination
    // Example: SELECT id as messageID, thread_id as threadID, sender as senderMatrixID, content as text, timestamp FROM messages WHERE thread_id = ? ORDER BY timestamp DESC LIMIT ?;
    // This assumes a simple 'messages' table. The actual schema might involve 'mx_events' or 'mx_room_messages'.
    // For now, let's assume a 'messages' table with 'Text' and 'Timestamp'.
    // And 'mx_events' for sender and thread link.
    let query = `
      SELECT
        me.event_id as messageID,
        mrm.thread_id as threadID,
        me.sender as senderMatrixID,
        mrm.data as text, -- Assuming data column in mx_room_messages holds text content
        me.origin_server_ts as timestamp
      FROM mx_events me
      JOIN mx_room_messages mrm ON me.event_id = mrm.event_id
      WHERE mrm.thread_id = ?
    `;
    const params: any[] = [threadID];

    if (since) {
      query += " AND me.origin_server_ts > ?";
      params.push(since.getTime()); // Assuming timestamp is in milliseconds
    }
    query += " ORDER BY me.origin_server_ts DESC LIMIT ?";
    params.push(limit);

    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params) as any[];
        const messages: BeeperMessage[] = rows.map(row => ({
          messageID: row.messageID,
          threadID: row.threadID,
          senderMatrixID: row.senderMatrixID,
          text: typeof row.text === 'string' ? (() => {
            try { return JSON.parse(row.text)?.body; } catch { return row.text; }
          })() : undefined,
          timestamp: row.timestamp,
          // TODO: Populate isRead, isFromMe, attachmentPath, etc.
        }));
        resolve(messages);
      } catch (err: any) {
        reject(new Error(`Error fetching messages for thread ${threadID}: ${err.message}`));
      }
    });
  }


  // Example of how one might fetch specific properties if they are in a key-value table
  // public async getProperty(ownerId: string, key: string): Promise<string | null> {
  //   // Assuming a table like 'props' (ownerId, key, value) or 'message_props', 'thread_props'
  //   return new Promise((resolve, reject) => {
  //     this.db.get("SELECT value FROM props WHERE ownerId = ? AND key = ?", [ownerId, key], (err, row: any) => {
  //       if (err) {
  //         reject(new Error(`Error fetching property ${key} for ${ownerId}: ${err.message}`));
  //       } else {
  //         resolve(row ? row.value : null);
  //       }
  //     });
  //   });
  // }

  public close(): void {
    this.db.close();
    console.log('Beeper database connection closed.');
  }
}
