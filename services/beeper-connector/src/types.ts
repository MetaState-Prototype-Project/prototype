/**
 * Type definitions for Beeper Connector
 */

export interface BeeperConfig {
    dbPath: string;
    ontologyServerUrl: string;
    eVaultUrl: string;
}

export interface BeeperMessage {
    id: string;
    text: string;
    sender: string;
    senderName: string;
    room: string;
    roomName: string;
    timestamp: string;
    participants?: string[];
    metadata?: Record<string, any>;
}

export interface SyncMapping {
    localId: string;
    w3Id: string;
    lastSyncedAt: Date;
    syncStatus: 'pending' | 'synced' | 'failed';
}

export interface BeeperRoom {
    id: string;
    name: string;
    type: 'direct' | 'group' | 'channel';
    participants: string[];
    createdAt: string;
    metadata?: Record<string, any>;
}

export interface BeeperUser {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
    ename?: string; // W3ID ename
}

export interface MessageSchema {
    tableName: string;
    schemaId: string;
    ownerEnamePath: string;
    localToUniversalMap: Record<string, string>;
}