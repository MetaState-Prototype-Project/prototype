import { Request, Response } from 'express';
import { WebhookEvent } from './types';
import { EVaultClient } from './graphql/evaultClient';
import { BlabsyToGlobalTransformer } from './transforms/toGlobal';
import { FirestoreIDMappingStore } from './idMappingStore';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

export class WebhookHandler {
  private readonly db = getFirestore();

  constructor(
    private evaultClient: EVaultClient,
    private transformer: BlabsyToGlobalTransformer,
    private idMappingStore: FirestoreIDMappingStore,
    private webhookSecret: string
  ) {}

  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Verify webhook signature
      const signature = req.headers['x-webhook-signature'];
      if (!this.verifySignature(req.body, signature as string)) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const event = req.body as WebhookEvent;
      
      // Fetch the meta envelope
      const envelope = await this.evaultClient.fetchMetaEnvelope(event.metaEnvelopeId, event.w3id);
      
      // Transform to platform format
      const platformData = await this.transformer.fromGlobal(envelope);
      
      // Get the platform ID if it exists
      const platformId = await this.idMappingStore.getPlatformId(event.metaEnvelopeId, this.getEntityType(envelope.schemaId));
      
      // Update or create the document
      const collection = this.getCollectionForSchemaId(envelope.schemaId);
      if (!collection) {
        throw new Error(`Unknown schema ID: ${envelope.schemaId}`);
      }

      if (platformId) {
        // Update existing document
        await collection.doc(platformId).update(platformData);
      } else {
        // Create new document
        const docRef = await collection.add(platformData);
        await this.idMappingStore.store(docRef.id, event.metaEnvelopeId, this.getEntityType(envelope.schemaId));
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private verifySignature(payload: any, signature: string): boolean {
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    const calculatedSignature = hmac.update(JSON.stringify(payload)).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(calculatedSignature)
    );
  }

  private getEntityType(schemaId: string): string {
    const schemaMap: Record<string, string> = {
      '550e8400-e29b-41d4-a716-446655440000': 'users',
      '550e8400-e29b-41d4-a716-446655440001': 'tweets',
      '550e8400-e29b-41d4-a716-446655440002': 'messages',
      '550e8400-e29b-41d4-a716-446655440003': 'comments'
    };
    return schemaMap[schemaId] || '';
  }

  private getCollectionForSchemaId(schemaId: string) {
    const collectionName = this.getEntityType(schemaId);
    return collectionName ? this.db.collection(collectionName) : null;
  }
} 