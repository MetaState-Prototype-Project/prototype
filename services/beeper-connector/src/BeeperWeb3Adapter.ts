/**
 * Beeper-specific Web3 Adapter
 * Extends the base Web3 Adapter with Beeper-specific schema mappings
 */

import { Web3Adapter } from '../../../infrastructure/web3-adapter/src/adapter.js';
import type { 
    SchemaMapping, 
    MetaEnvelope, 
    PlatformData,
    AdapterConfig 
} from '../../../infrastructure/web3-adapter/src/types.js';
import type { BeeperMessage, MessageSchema } from './types.js';

export class BeeperWeb3Adapter extends Web3Adapter {
    constructor(config: AdapterConfig) {
        super(config);
    }

    /**
     * Initialize with Beeper-specific schema mappings
     */
    async initialize(): Promise<void> {
        await super.initialize();
        await this.loadBeeperMappings();
    }

    /**
     * Load Beeper-specific schema mappings
     */
    private async loadBeeperMappings(): Promise<void> {
        // Message schema mapping
        const messageMapping: SchemaMapping = {
            tableName: 'messages',
            schemaId: '550e8400-e29b-41d4-a716-446655440010',
            ownerEnamePath: 'user(sender.ename)',
            ownedJunctionTables: [],
            localToUniversalMap: {
                'text': 'content',
                'sender': 'author',
                'senderName': 'authorName',
                'room': 'channel',
                'roomName': 'channelName',
                'timestamp': 'createdAt',
                'platform': 'source',
                'type': 'messageType'
            }
        };
        this.addSchemaMapping(messageMapping);

        // Room/Thread schema mapping
        const roomMapping: SchemaMapping = {
            tableName: 'rooms',
            schemaId: '550e8400-e29b-41d4-a716-446655440011',
            ownerEnamePath: 'room(owner.ename)',
            ownedJunctionTables: ['room_participants'],
            localToUniversalMap: {
                'name': 'title',
                'type': 'roomType',
                'participants': 'members',
                'createdAt': 'established',
                'metadata': 'properties'
            }
        };
        this.addSchemaMapping(roomMapping);

        // User schema mapping
        const userMapping: SchemaMapping = {
            tableName: 'users',
            schemaId: '550e8400-e29b-41d4-a716-446655440012',
            ownerEnamePath: 'user(self.ename)',
            ownedJunctionTables: [],
            localToUniversalMap: {
                'name': 'displayName',
                'email': 'emailAddress',
                'avatar': 'profileImage',
                'ename': 'w3id'
            }
        };
        this.addSchemaMapping(userMapping);

        console.log('✅ Beeper schema mappings loaded');
    }

    /**
     * Add a schema mapping (protected method to expose to subclass)
     */
    protected addSchemaMapping(mapping: SchemaMapping): void {
        // Access the parent's schemaMappings Map
        (this as any).schemaMappings.set(mapping.tableName, mapping);
    }

    /**
     * Convert Beeper message to MetaEnvelope with proper ACL
     */
    async messageToMetaEnvelope(message: BeeperMessage): Promise<MetaEnvelope> {
        const platformData: PlatformData = {
            id: message.id,
            text: message.text,
            sender: message.sender,
            senderName: message.senderName,
            room: message.room,
            roomName: message.roomName,
            timestamp: message.timestamp,
            platform: 'beeper',
            type: 'message',
            _acl_read: message.participants || ['*'],
            _acl_write: [message.sender]
        };

        const payload = await this.toEVault('messages', platformData);
        return payload.metaEnvelope;
    }

    /**
     * Convert MetaEnvelope back to Beeper message format
     */
    async metaEnvelopeToMessage(metaEnvelope: MetaEnvelope): Promise<BeeperMessage> {
        const platformData = await this.fromEVault(metaEnvelope, 'messages');
        
        return {
            id: platformData.id as string,
            text: platformData.text as string,
            sender: platformData.sender as string,
            senderName: platformData.senderName as string,
            room: platformData.room as string,
            roomName: platformData.roomName as string,
            timestamp: platformData.timestamp as string,
            participants: platformData._acl_read as string[]
        };
    }

    /**
     * Handle cross-platform message transformation
     */
    async transformMessageForPlatform(
        metaEnvelope: MetaEnvelope, 
        targetPlatform: string
    ): Promise<any> {
        const baseData = await this.fromEVault(metaEnvelope, 'messages');

        switch (targetPlatform) {
            case 'slack':
                return {
                    text: baseData.text,
                    user: baseData.sender,
                    channel: baseData.room,
                    ts: new Date(baseData.timestamp).getTime() / 1000
                };
            
            case 'discord':
                return {
                    content: baseData.text,
                    author: {
                        id: baseData.sender,
                        username: baseData.senderName
                    },
                    channel_id: baseData.room,
                    timestamp: baseData.timestamp
                };
            
            case 'telegram':
                return {
                    text: baseData.text,
                    from: {
                        id: baseData.sender,
                        first_name: baseData.senderName
                    },
                    chat: {
                        id: baseData.room,
                        title: baseData.roomName
                    },
                    date: Math.floor(new Date(baseData.timestamp).getTime() / 1000)
                };
            
            default:
                return baseData;
        }
    }

    /**
     * Batch sync messages
     */
    async batchSyncMessages(messages: BeeperMessage[]): Promise<void> {
        const platformDataArray: PlatformData[] = messages.map(msg => ({
            id: msg.id,
            text: msg.text,
            sender: msg.sender,
            senderName: msg.senderName,
            room: msg.room,
            roomName: msg.roomName,
            timestamp: msg.timestamp,
            platform: 'beeper',
            type: 'message',
            _acl_read: msg.participants || ['*'],
            _acl_write: [msg.sender]
        }));

        await this.syncWithEVault('messages', platformDataArray);
    }
}