<<<<<<< HEAD
/**
 * Beeper Connector with Web3 Adapter Integration
 * Provides bidirectional synchronization between Beeper messages and eVault
 */

import { BeeperDatabase } from './BeeperDatabase.js';
import { BeeperWeb3Adapter } from './BeeperWeb3Adapter.js';
import { EVaultSync } from './EVaultSync.js';
import type { BeeperConfig } from './types.js';

export class BeeperConnector {
    private db: BeeperDatabase;
    private adapter: BeeperWeb3Adapter;
    private sync: EVaultSync;
    private config: BeeperConfig;

    constructor(config: BeeperConfig) {
        this.config = config;
        this.db = new BeeperDatabase(config.dbPath);
        this.adapter = new BeeperWeb3Adapter({
            platform: 'beeper',
            ontologyServerUrl: config.ontologyServerUrl,
            eVaultUrl: config.eVaultUrl
        });
        this.sync = new EVaultSync(this.adapter, config.eVaultUrl);
    }

    /**
     * Initialize the connector
     */
    async initialize(): Promise<void> {
        await this.db.connect();
        await this.adapter.initialize();
        console.log('✅ Beeper Connector initialized');
    }

    /**
     * Sync messages from Beeper to eVault
     */
    async syncToEVault(limit: number = 1000): Promise<void> {
        console.log('📤 Starting sync to eVault...');
        
        // Get messages from Beeper database
        const messages = await this.db.getMessages(limit);
        console.log(`Found ${messages.length} messages to sync`);

        // Transform and sync each message
        for (const message of messages) {
            try {
                // Convert to platform data format
                const platformData = this.transformBeeperMessage(message);
                
                // Convert to eVault format and sync
                const payload = await this.adapter.toEVault('messages', platformData);
                await this.sync.sendToEVault(payload);
                
                // Store mapping for bidirectional sync
                await this.db.storeSyncMapping(message.id, payload.metaEnvelope.id);
                
                console.log(`✅ Synced message ${message.id}`);
            } catch (error) {
                console.error(`❌ Failed to sync message ${message.id}:`, error);
            }
        }
        
        console.log('✅ Sync to eVault complete');
    }

    /**
     * Sync messages from eVault to Beeper
     */
    async syncFromEVault(): Promise<void> {
        console.log('📥 Starting sync from eVault...');
        
        // Get new messages from eVault
        const metaEnvelopes = await this.sync.getNewMessages();
        console.log(`Found ${metaEnvelopes.length} new messages from eVault`);

        for (const metaEnvelope of metaEnvelopes) {
            try {
                // Convert back to Beeper format
                const beeperData = await this.adapter.fromEVault(metaEnvelope, 'messages');
                
                // Check if message already exists
                const exists = await this.db.messageExists(beeperData.id);
                if (!exists) {
                    // Insert into Beeper database
                    await this.db.insertMessage(beeperData);
                    console.log(`✅ Added message ${beeperData.id} to Beeper`);
                } else {
                    // Update existing message
                    await this.db.updateMessage(beeperData);
                    console.log(`✅ Updated message ${beeperData.id} in Beeper`);
                }
            } catch (error) {
                console.error(`❌ Failed to sync message from eVault:`, error);
            }
        }
        
        console.log('✅ Sync from eVault complete');
    }

    /**
     * Enable real-time bidirectional sync
     */
    async enableRealtimeSync(intervalMs: number = 30000): Promise<void> {
        console.log('🔄 Enabling real-time bidirectional sync...');
        
        // Set up change listeners on Beeper database
        this.db.onMessageChange(async (message) => {
            console.log(`Detected change in message ${message.id}`);
            const platformData = this.transformBeeperMessage(message);
            const payload = await this.adapter.toEVault('messages', platformData);
            await this.sync.sendToEVault(payload);
        });

        // Set up periodic sync from eVault
        setInterval(async () => {
            await this.syncFromEVault();
        }, intervalMs);

        console.log(`✅ Real-time sync enabled (interval: ${intervalMs}ms)`);
    }

    /**
     * Transform Beeper message to platform data format
     */
    private transformBeeperMessage(message: any): any {
        return {
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
    }

    /**
     * Export messages to RDF format (backward compatibility)
     */
    async exportToRDF(outputPath: string): Promise<void> {
        console.log('📝 Exporting messages to RDF...');
        
        const messages = await this.db.getMessages();
        const rdfTriples: string[] = [];
        
        // RDF prefixes
        rdfTriples.push('@prefix : <https://metastate.dev/ontology/beeper/> .');
        rdfTriples.push('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
        rdfTriples.push('@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .');
        rdfTriples.push('@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .');
        rdfTriples.push('@prefix dc: <http://purl.org/dc/elements/1.1/> .\n');

        // Convert messages to RDF triples
        for (const message of messages) {
            const messageId = `message_${message.id}`;
            const senderId = `sender_${message.sender}`;
            const roomId = `room_${message.room}`;

            rdfTriples.push(`
:${messageId} rdf:type :Message ;
    :hasText "${this.escapeRDF(message.text)}" ;
    :hasSender :${senderId} ;
    :inRoom :${roomId} ;
    :hasTimestamp "${message.timestamp}"^^xsd:dateTime .

:${senderId} rdf:type :Person ;
    rdfs:label "${this.escapeRDF(message.senderName)}" .

:${roomId} rdf:type :Room ;
    rdfs:label "${this.escapeRDF(message.roomName)}" .
`);
        }

        // Write to file
        const fs = await import('fs/promises');
        await fs.writeFile(outputPath, rdfTriples.join('\n'));
        console.log(`✅ Exported ${messages.length} messages to ${outputPath}`);
    }

    /**
     * Escape text for RDF
     */
    private escapeRDF(text: string): string {
        if (!text) return '';
        return text
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, ' ')
            .replace(/\r/g, ' ')
            .replace(/\t/g, ' ');
    }

    /**
     * Close connections
     */
    async close(): Promise<void> {
        await this.db.close();
        console.log('👋 Beeper Connector closed');
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const main = async () => {
        const connector = new BeeperConnector({
            dbPath: process.env.BEEPER_DB_PATH || '~/Library/Application Support/BeeperTexts/index.db',
            ontologyServerUrl: process.env.ONTOLOGY_SERVER_URL || 'http://localhost:3000',
            eVaultUrl: process.env.EVAULT_URL || 'http://localhost:4000'
        });

        await connector.initialize();

        const command = process.argv[2];
        switch (command) {
            case 'sync-to-evault':
                await connector.syncToEVault();
                break;
            case 'sync-from-evault':
                await connector.syncFromEVault();
                break;
            case 'realtime':
                await connector.enableRealtimeSync();
                // Keep process running
                process.stdin.resume();
                break;
            case 'export-rdf':
                const outputPath = process.argv[3] || 'beeper_messages.ttl';
                await connector.exportToRDF(outputPath);
                break;
            default:
                console.log(`
Usage: 
  npm run sync-to-evault    - Sync Beeper messages to eVault
  npm run sync-from-evault  - Sync eVault messages to Beeper
  npm run realtime          - Enable real-time bidirectional sync
  npm run export-rdf [file] - Export messages to RDF format
                `);
        }

        if (command !== 'realtime') {
            await connector.close();
        }
    };

    main().catch(console.error);
}

export default BeeperConnector;
=======
import { BeeperDbReader } from './beeperDbReader';
import { EvaultWriter } from './evaultWriter';
import { MetaStateTransformer } from './metaStateTransformer';
import { StateStore } from './state';

async function main() {
  console.log('Beeper Connector Service starting...');

  const beeperDbPath = process.env.BEEPER_DB_PATH;
  if (!beeperDbPath) {
    console.error('Error: BEEPER_DB_PATH environment variable is not set.');
    process.exit(1);
  }
  console.log(`Attempting to connect to Beeper DB at: ${beeperDbPath}`);

  const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? '0');
  const statePath = process.env.STATE_FILE_PATH;
  const stateStore = new StateStore(statePath);
  const state = stateStore.load();

  let dbReader: BeeperDbReader | null = null;

  try {
    dbReader = new BeeperDbReader(beeperDbPath);

    console.log('Fetching users...');
    const users = await dbReader.getUsers();
    console.log(`Found ${users.length} users:`, users.slice(0, 5));

      const firstUser = users[0];
      let threads: Awaited<ReturnType<typeof dbReader.getThreads>> = [];
      const messages: Awaited<ReturnType<typeof dbReader.getMessages>> = [];

      if (firstUser?.accountID) {
        const firstUserAccountId = firstUser.accountID;
        console.log(`Fetching threads for accountID: ${firstUserAccountId} ...`);
        threads = await dbReader.getThreads(firstUserAccountId);
        console.log(`Found ${threads.length} threads for account ${firstUserAccountId}:`, threads.slice(0, 3));
        for (const th of threads.slice(0, 5)) {
          const last = state.threads[th.threadID]?.lastTimestampMs;
          const sinceDate = last ? new Date(last) : undefined;
          const batch = await dbReader.getMessages(th.threadID, sinceDate, 50);
          messages.push(...batch);
        }
      } else {
        console.log('Skipping thread and message fetching as no users with an accountID found.');
      }

      // Transform Beeper records into MetaState envelopes
      const transformer = new MetaStateTransformer();
      const envelopes = transformer.transform({ users, threads, messages, sourcePlatform: 'Beeper' });

      // Write into eVault if configured
      const evaultEndpoint = process.env.EVAULT_ENDPOINT;
      const evaultAuthToken = process.env.EVAULT_AUTH_TOKEN;
      const aclEnv = process.env.W3ID_ACL; // JSON array or comma-separated
      const acl: string[] = (() => {
        if (!aclEnv) return [];
        try {
          const parsed = JSON.parse(aclEnv);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return aclEnv.split(',').map((s) => s.trim()).filter(Boolean);
        }
      })();

      if (evaultEndpoint && envelopes.length > 0) {
        console.log(`Writing ${envelopes.length} envelopes to eVault at ${evaultEndpoint} ...`);
        const writer = new EvaultWriter(evaultEndpoint, evaultAuthToken);
        await writer.storeBatch(
          envelopes.map((payload) => ({ ontology: payload.ontology, payload: payload.payload, acl })),
          0
        );
        console.log('Write complete.');
        for (const m of messages) {
          const t = m.threadID;
          const ts = m.timestamp;
          const entry = state.threads[t] ?? { lastTimestampMs: 0 };
          if (!entry.lastTimestampMs || ts > entry.lastTimestampMs) {
            entry.lastTimestampMs = ts;
            state.threads[t] = entry;
          }
        }
        stateStore.save(state);
      } else if (!evaultEndpoint) {
        console.warn('EVAULT_ENDPOINT not set. Skipping write to eVault.');
      }

    console.log('Beeper Connector Service finished its run (data fetching test complete).');

  } catch (error) {
    console.error('Error in Beeper Connector Service:', error);
    process.exit(1);
  } finally {
    if (dbReader) {
      dbReader.close();
    }
  }
}

async function loop() {
  const interval = Number(process.env.POLL_INTERVAL_MS ?? '0');
  if (!interval || interval <= 0) {
    await main();
    return;
  }
  while (true) {
    try {
      await main();
    } catch (e) {
      console.error('Polling iteration failed:', e);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

loop().catch(error => {
  console.error('Unhandled error in main loop:', error);
  process.exit(1);
});
>>>>>>> a19aa5e (feat(beeper-connector): add MetaStateTransformer, wire eVault GraphQL writer, fix mutation shape, add sync:once script; update visualize script; add tsconfig files)
