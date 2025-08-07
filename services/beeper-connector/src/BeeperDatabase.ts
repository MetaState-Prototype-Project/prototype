/**
 * Beeper Database Interface
 * Handles reading and writing to Beeper SQLite database
 */

import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import os from 'os';
import type { BeeperMessage, BeeperRoom, BeeperUser, SyncMapping } from './types.js';

export class BeeperDatabase {
    private db: Database | null = null;
    private dbPath: string;
    private changeListeners: ((message: BeeperMessage) => void)[] = [];

    constructor(dbPath: string) {
        // Expand ~ to home directory
        this.dbPath = dbPath.replace('~', os.homedir());
    }

    /**
     * Connect to the Beeper database
     */
    async connect(): Promise<void> {
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database,
            mode: sqlite3.OPEN_READWRITE
        });

        // Create sync mapping table if it doesn't exist
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS w3_sync_mappings (
                local_id TEXT PRIMARY KEY,
                w3_id TEXT NOT NULL,
                last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sync_status TEXT DEFAULT 'pending'
            )
        `);

        console.log('✅ Connected to Beeper database');
    }

    /**
     * Get messages from the database
     */
    async getMessages(limit: number = 1000): Promise<BeeperMessage[]> {
        if (!this.db) throw new Error('Database not connected');

        const query = `
            SELECT 
                m.messageID as id,
                m.text,
                m.senderID as sender,
                json_extract(u.user, '$.fullName') as senderName,
                m.threadID as room,
                json_extract(t.thread, '$.title') as roomName,
                datetime(m.timestamp/1000, 'unixepoch') as timestamp
            FROM messages m
            LEFT JOIN users u ON m.senderID = u.userID
            LEFT JOIN threads t ON m.threadID = t.threadID
            WHERE m.text IS NOT NULL
            ORDER BY m.timestamp DESC
            LIMIT ?
        `;

        const messages = await this.db.all<BeeperMessage[]>(query, limit);
        return messages;
    }

    /**
     * Get new messages since last sync
     */
    async getNewMessages(since?: Date): Promise<BeeperMessage[]> {
        if (!this.db) throw new Error('Database not connected');

        const sinceTimestamp = since ? since.getTime() : Date.now() - 86400000; // Default to last 24 hours

        const query = `
            SELECT 
                m.messageID as id,
                m.text,
                m.senderID as sender,
                json_extract(u.user, '$.fullName') as senderName,
                m.threadID as room,
                json_extract(t.thread, '$.title') as roomName,
                datetime(m.timestamp/1000, 'unixepoch') as timestamp
            FROM messages m
            LEFT JOIN users u ON m.senderID = u.userID
            LEFT JOIN threads t ON m.threadID = t.threadID
            LEFT JOIN w3_sync_mappings sm ON m.messageID = sm.local_id
            WHERE m.text IS NOT NULL
            AND m.timestamp > ?
            AND (sm.local_id IS NULL OR sm.sync_status = 'pending')
            ORDER BY m.timestamp ASC
        `;

        const messages = await this.db.all<BeeperMessage[]>(query, sinceTimestamp);
        return messages;
    }

    /**
     * Check if a message exists
     */
    async messageExists(messageId: string): Promise<boolean> {
        if (!this.db) throw new Error('Database not connected');

        const result = await this.db.get(
            'SELECT 1 FROM messages WHERE messageID = ?',
            messageId
        );
        return !!result;
    }

    /**
     * Insert a new message (for syncing from eVault)
     */
    async insertMessage(message: any): Promise<void> {
        if (!this.db) throw new Error('Database not connected');

        // Note: In production, this would need proper Beeper message format
        // For now, we store in a custom table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS synced_messages (
                id TEXT PRIMARY KEY,
                text TEXT,
                sender TEXT,
                senderName TEXT,
                room TEXT,
                roomName TEXT,
                timestamp DATETIME,
                w3_id TEXT,
                raw_data TEXT
            )
        `);

        await this.db.run(
            `INSERT INTO synced_messages (id, text, sender, senderName, room, roomName, timestamp, w3_id, raw_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            message.id,
            message.text,
            message.sender,
            message.senderName,
            message.room,
            message.roomName,
            message.timestamp,
            message.w3Id,
            JSON.stringify(message)
        );
    }

    /**
     * Update an existing message
     */
    async updateMessage(message: any): Promise<void> {
        if (!this.db) throw new Error('Database not connected');

        await this.db.run(
            `UPDATE synced_messages 
             SET text = ?, sender = ?, senderName = ?, room = ?, roomName = ?, 
                 timestamp = ?, raw_data = ?
             WHERE id = ?`,
            message.text,
            message.sender,
            message.senderName,
            message.room,
            message.roomName,
            message.timestamp,
            JSON.stringify(message),
            message.id
        );
    }

    /**
     * Store sync mapping between local and W3 IDs
     */
    async storeSyncMapping(localId: string, w3Id: string): Promise<void> {
        if (!this.db) throw new Error('Database not connected');

        await this.db.run(
            `INSERT OR REPLACE INTO w3_sync_mappings (local_id, w3_id, last_synced_at, sync_status)
             VALUES (?, ?, CURRENT_TIMESTAMP, 'synced')`,
            localId,
            w3Id
        );
    }

    /**
     * Get sync mapping for a local ID
     */
    async getSyncMapping(localId: string): Promise<SyncMapping | null> {
        if (!this.db) throw new Error('Database not connected');

        const mapping = await this.db.get<SyncMapping>(
            'SELECT * FROM w3_sync_mappings WHERE local_id = ?',
            localId
        );
        return mapping || null;
    }

    /**
     * Get rooms
     */
    async getRooms(): Promise<BeeperRoom[]> {
        if (!this.db) throw new Error('Database not connected');

        const query = `
            SELECT 
                threadID as id,
                json_extract(thread, '$.title') as name,
                json_extract(thread, '$.type') as type,
                thread as metadata
            FROM threads
            LIMIT 100
        `;

        const rooms = await this.db.all<BeeperRoom[]>(query);
        return rooms;
    }

    /**
     * Get users
     */
    async getUsers(): Promise<BeeperUser[]> {
        if (!this.db) throw new Error('Database not connected');

        const query = `
            SELECT 
                userID as id,
                json_extract(user, '$.fullName') as name,
                json_extract(user, '$.email') as email,
                json_extract(user, '$.avatar') as avatar
            FROM users
            LIMIT 100
        `;

        const users = await this.db.all<BeeperUser[]>(query);
        return users;
    }

    /**
     * Register a change listener
     */
    onMessageChange(listener: (message: BeeperMessage) => void): void {
        this.changeListeners.push(listener);
    }

    /**
     * Start watching for changes (polling-based for SQLite)
     */
    async startWatching(intervalMs: number = 5000): Promise<void> {
        let lastCheck = new Date();

        setInterval(async () => {
            const newMessages = await this.getNewMessages(lastCheck);
            for (const message of newMessages) {
                for (const listener of this.changeListeners) {
                    listener(message);
                }
            }
            lastCheck = new Date();
        }, intervalMs);

        console.log(`👀 Watching for database changes (interval: ${intervalMs}ms)`);
    }

    /**
     * Close the database connection
     */
    async close(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
            console.log('Database connection closed');
        }
    }
}