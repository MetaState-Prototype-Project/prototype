import { getFirestore } from 'firebase-admin/firestore';
import { EVaultClient } from './graphql/evaultClient';
import { BlabsyToGlobalTransformer } from './transforms/toGlobal';
import { FirestoreIDMappingStore } from './idMappingStore';
import { FirestoreWatcher } from './watchers/firestoreWatcher';
import { WebhookHandler } from './webhookHandler';
import { Request, Response } from 'express';

export interface Web3AdapterConfig {
  registryUrl: string;
  webhookSecret: string;
  webhookEndpoint: string;
  pictiqueWebhookUrl: string;
  pictiqueWebhookSecret: string;
}

export class Web3Adapter {
  private readonly db = getFirestore();
  private evaultClient: EVaultClient;
  private transformer: BlabsyToGlobalTransformer;
  private idMappingStore: FirestoreIDMappingStore;
  private webhookHandler: WebhookHandler;
  private watchers: FirestoreWatcher<any>[] = [];

  constructor(private config: Web3AdapterConfig) {
    this.evaultClient = new EVaultClient(config.registryUrl);
    this.idMappingStore = new FirestoreIDMappingStore();
    this.transformer = new BlabsyToGlobalTransformer(this.idMappingStore);
    this.webhookHandler = new WebhookHandler(
      this.evaultClient,
      this.transformer,
      this.idMappingStore,
      config.webhookSecret,
      config.pictiqueWebhookUrl,
      config.pictiqueWebhookSecret
    );
  }

  async initialize(): Promise<void> {
    // Initialize watchers for each collection
    const collections = [
      { name: 'users', type: 'user' },
      { name: 'tweets', type: 'socialMediaPost' },
      { name: 'messages', type: 'message' },
      { name: 'comments', type: 'comment' }
    ];

    for (const { name, type } of collections) {
      const collection = this.db.collection(name);
      const watcher = new FirestoreWatcher(
        collection,
        type,
        this.transformer,
        this.evaultClient,
        this.idMappingStore
      );
      await watcher.start();
      this.watchers.push(watcher);
    }
  }

  async shutdown(): Promise<void> {
    // Stop all watchers
    await Promise.all(this.watchers.map(watcher => watcher.stop()));
    this.watchers = [];
  }

  getWebhookHandler(): (req: Request, res: Response) => Promise<void> {
    return this.webhookHandler.handleWebhook.bind(this.webhookHandler);
  }
} 