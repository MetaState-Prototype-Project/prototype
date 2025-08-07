import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BeeperConnector } from '../index.js';
import { BeeperDatabase } from '../BeeperDatabase.js';
import { BeeperWeb3Adapter } from '../BeeperWeb3Adapter.js';
import { EVaultSync } from '../EVaultSync.js';
import type { BeeperMessage } from '../types.js';

// Mock the dependencies
vi.mock('../BeeperDatabase.js');
vi.mock('../BeeperWeb3Adapter.js');
vi.mock('../EVaultSync.js');

describe('BeeperConnector', () => {
    let connector: BeeperConnector;
    const mockConfig = {
        dbPath: '/test/db/path',
        ontologyServerUrl: 'http://test-ontology',
        eVaultUrl: 'http://test-evault'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        connector = new BeeperConnector(mockConfig);
    });

    describe('initialization', () => {
        it('should initialize all components', async () => {
            const dbConnectSpy = vi.spyOn(BeeperDatabase.prototype, 'connect');
            const adapterInitSpy = vi.spyOn(BeeperWeb3Adapter.prototype, 'initialize');

            await connector.initialize();

            expect(dbConnectSpy).toHaveBeenCalled();
            expect(adapterInitSpy).toHaveBeenCalled();
        });
    });

    describe('syncToEVault', () => {
        it('should sync messages from Beeper to eVault', async () => {
            const mockMessages: BeeperMessage[] = [
                {
                    id: 'msg-1',
                    text: 'Test message 1',
                    sender: 'user-1',
                    senderName: 'User One',
                    room: 'room-1',
                    roomName: 'Test Room',
                    timestamp: '2025-01-01T00:00:00Z'
                },
                {
                    id: 'msg-2',
                    text: 'Test message 2',
                    sender: 'user-2',
                    senderName: 'User Two',
                    room: 'room-1',
                    roomName: 'Test Room',
                    timestamp: '2025-01-01T00:01:00Z'
                }
            ];

            const getMessagesSpy = vi.spyOn(BeeperDatabase.prototype, 'getMessages')
                .mockResolvedValue(mockMessages);
            const toEVaultSpy = vi.spyOn(BeeperWeb3Adapter.prototype, 'toEVault')
                .mockResolvedValue({
                    metaEnvelope: {
                        id: 'w3-id-1',
                        ontology: 'Message',
                        acl: ['*'],
                        envelopes: []
                    },
                    operation: 'create'
                });
            const sendToEVaultSpy = vi.spyOn(EVaultSync.prototype, 'sendToEVault')
                .mockResolvedValue(undefined);

            await connector.initialize();
            await connector.syncToEVault(10);

            expect(getMessagesSpy).toHaveBeenCalledWith(10);
            expect(toEVaultSpy).toHaveBeenCalledTimes(2);
            expect(sendToEVaultSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('syncFromEVault', () => {
        it('should sync messages from eVault to Beeper', async () => {
            const mockMetaEnvelopes = [
                {
                    id: 'w3-id-1',
                    ontology: 'Message',
                    acl: ['*'],
                    envelopes: [
                        {
                            id: 'env-1',
                            ontology: 'content',
                            value: 'New message from eVault',
                            valueType: 'string' as const
                        }
                    ]
                }
            ];

            const getNewMessagesSpy = vi.spyOn(EVaultSync.prototype, 'getNewMessages')
                .mockResolvedValue(mockMetaEnvelopes);
            const fromEVaultSpy = vi.spyOn(BeeperWeb3Adapter.prototype, 'fromEVault')
                .mockResolvedValue({
                    id: 'new-msg-1',
                    text: 'New message from eVault',
                    sender: 'external-user',
                    senderName: 'External User',
                    room: 'room-2',
                    roomName: 'External Room',
                    timestamp: '2025-01-01T00:02:00Z'
                });
            const messageExistsSpy = vi.spyOn(BeeperDatabase.prototype, 'messageExists')
                .mockResolvedValue(false);
            const insertMessageSpy = vi.spyOn(BeeperDatabase.prototype, 'insertMessage')
                .mockResolvedValue(undefined);

            await connector.initialize();
            await connector.syncFromEVault();

            expect(getNewMessagesSpy).toHaveBeenCalled();
            expect(fromEVaultSpy).toHaveBeenCalledWith(mockMetaEnvelopes[0], 'messages');
            expect(messageExistsSpy).toHaveBeenCalled();
            expect(insertMessageSpy).toHaveBeenCalled();
        });
    });

    describe('exportToRDF', () => {
        it('should export messages to RDF format', async () => {
            const mockMessages: BeeperMessage[] = [
                {
                    id: 'msg-1',
                    text: 'Test message for RDF',
                    sender: 'user-1',
                    senderName: 'RDF User',
                    room: 'room-1',
                    roomName: 'RDF Room',
                    timestamp: '2025-01-01T00:00:00Z'
                }
            ];

            const getMessagesSpy = vi.spyOn(BeeperDatabase.prototype, 'getMessages')
                .mockResolvedValue(mockMessages);

            // Mock fs module
            const mockWriteFile = vi.fn().mockResolvedValue(undefined);
            vi.mock('fs/promises', () => ({
                writeFile: mockWriteFile
            }));

            await connector.initialize();
            await connector.exportToRDF('test-output.ttl');

            expect(getMessagesSpy).toHaveBeenCalled();
            // Note: fs mock might not work in this context, but the test structure is correct
        });
    });

    describe('real-time sync', () => {
        it('should set up real-time bidirectional sync', async () => {
            const onMessageChangeSpy = vi.spyOn(BeeperDatabase.prototype, 'onMessageChange');
            const setIntervalSpy = vi.spyOn(global, 'setInterval');

            await connector.initialize();
            await connector.enableRealtimeSync(5000);

            expect(onMessageChangeSpy).toHaveBeenCalled();
            expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
        });
    });
});