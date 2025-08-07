import type {
    SchemaMapping,
    Envelope,
    MetaEnvelope,
    IdMapping,
    ACL,
    PlatformData,
    OntologySchema,
    Web3ProtocolPayload,
    AdapterConfig
} from './types.js';

export class Web3Adapter {
    private schemaMappings: Map<string, SchemaMapping>;
    private idMappings: Map<string, IdMapping>;
    private ontologyCache: Map<string, OntologySchema>;
    private config: AdapterConfig;

    constructor(config: AdapterConfig) {
        this.config = config;
        this.schemaMappings = new Map();
        this.idMappings = new Map();
        this.ontologyCache = new Map();
    }

    public async initialize(): Promise<void> {
        await this.loadSchemaMappings();
        await this.loadIdMappings();
    }

    private async loadSchemaMappings(): Promise<void> {
        // In production, this would load from database/config
        // For now, using hardcoded mappings based on documentation
        const chatMapping: SchemaMapping = {
            tableName: "chats",
            schemaId: "550e8400-e29b-41d4-a716-446655440003",
            ownerEnamePath: "users(participants[].ename)",
            ownedJunctionTables: [],
            localToUniversalMap: {
                "chatName": "name",
                "type": "type",
                "participants": "users(participants[].id),participantIds",
                "createdAt": "createdAt",
                "updatedAt": "updatedAt"
            }
        };
        this.schemaMappings.set(chatMapping.tableName, chatMapping);
    }

    private async loadIdMappings(): Promise<void> {
        // In production, load from persistent storage
        // This is placeholder for demo
    }

    public async toEVault(tableName: string, data: PlatformData): Promise<Web3ProtocolPayload> {
        const schemaMapping = this.schemaMappings.get(tableName);
        if (!schemaMapping) {
            throw new Error(`No schema mapping found for table: ${tableName}`);
        }

        const ontologySchema = await this.fetchOntologySchema(schemaMapping.schemaId);
        const envelopes = await this.convertToEnvelopes(data, schemaMapping, ontologySchema);
        const acl = this.extractACL(data);

        const metaEnvelope: MetaEnvelope = {
            id: this.generateW3Id(),
            ontology: ontologySchema.name,
            acl: acl.read.length > 0 ? acl.read : ['*'],
            envelopes
        };

        // Store ID mapping
        if (data.id) {
            const idMapping: IdMapping = {
                w3Id: metaEnvelope.id,
                localId: data.id,
                platform: this.config.platform,
                resourceType: tableName,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            this.idMappings.set(data.id, idMapping);
        }

        return {
            metaEnvelope,
            operation: 'create'
        };
    }

    public async fromEVault(metaEnvelope: MetaEnvelope, tableName: string): Promise<PlatformData> {
        const schemaMapping = this.schemaMappings.get(tableName);
        if (!schemaMapping) {
            throw new Error(`No schema mapping found for table: ${tableName}`);
        }

        const platformData: PlatformData = {};

        // Convert envelopes back to platform format
        for (const envelope of metaEnvelope.envelopes) {
            const platformField = this.findPlatformField(envelope.ontology, schemaMapping);
            if (platformField) {
                platformData[platformField] = this.convertValue(envelope.value, envelope.valueType);
            }
        }

        // Convert W3IDs to local IDs
        platformData.id = this.getLocalId(metaEnvelope.id) || metaEnvelope.id;

        // Add ACL if not public
        if (metaEnvelope.acl && metaEnvelope.acl[0] !== '*') {
            platformData._acl_read = this.convertW3IdsToLocal(metaEnvelope.acl);
            platformData._acl_write = this.convertW3IdsToLocal(metaEnvelope.acl);
        }

        return platformData;
    }

    private async convertToEnvelopes(
        data: PlatformData,
        mapping: SchemaMapping,
        ontologySchema: OntologySchema
    ): Promise<Envelope[]> {
        const envelopes: Envelope[] = [];

        for (const [localField, universalField] of Object.entries(mapping.localToUniversalMap)) {
            if (data[localField] !== undefined) {
                const envelope: Envelope = {
                    id: this.generateEnvelopeId(),
                    ontology: universalField.split(',')[0], // Handle complex mappings
                    value: data[localField],
                    valueType: this.detectValueType(data[localField])
                };
                envelopes.push(envelope);
            }
        }

        return envelopes;
    }

    private extractACL(data: PlatformData): ACL {
        return {
            read: data._acl_read || [],
            write: data._acl_write || []
        };
    }

    private async fetchOntologySchema(schemaId: string): Promise<OntologySchema> {
        if (this.ontologyCache.has(schemaId)) {
            return this.ontologyCache.get(schemaId)!;
        }

        // In production, fetch from ontology server
        // For now, return mock schema
        const schema: OntologySchema = {
            id: schemaId,
            name: 'SocialMediaPost',
            version: '1.0.0',
            fields: {
                text: { type: 'string', required: true },
                userLikes: { type: 'array', required: false },
                interactions: { type: 'array', required: false },
                image: { type: 'string', required: false },
                dateCreated: { type: 'string', required: true }
            }
        };

        this.ontologyCache.set(schemaId, schema);
        return schema;
    }

    private findPlatformField(ontologyField: string, mapping: SchemaMapping): string | null {
        for (const [localField, universalField] of Object.entries(mapping.localToUniversalMap)) {
            if (universalField.includes(ontologyField)) {
                return localField;
            }
        }
        return null;
    }

    private convertValue(value: any, valueType: string): any {
        switch (valueType) {
            case 'string':
                return String(value);
            case 'number':
                return Number(value);
            case 'boolean':
                return Boolean(value);
            case 'array':
                return Array.isArray(value) ? value : [value];
            case 'object':
                return typeof value === 'object' ? value : JSON.parse(value);
            default:
                return value;
        }
    }

    private detectValueType(value: any): Envelope['valueType'] {
        if (typeof value === 'string') return 'string';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'boolean';
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'object' && value !== null) return 'object';
        return 'string';
    }

    private generateW3Id(): string {
        // Generate UUID v4
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    private generateEnvelopeId(): string {
        return this.generateW3Id();
    }

    private getLocalId(w3Id: string): string | null {
        for (const [localId, mapping] of this.idMappings) {
            if (mapping.w3Id === w3Id) {
                return localId;
            }
        }
        return null;
    }

    private convertW3IdsToLocal(w3Ids: string[]): string[] {
        return w3Ids.map(w3Id => this.getLocalId(w3Id) || w3Id);
    }

    public async syncWithEVault(tableName: string, localData: PlatformData[]): Promise<void> {
        for (const data of localData) {
            const payload = await this.toEVault(tableName, data);
            // In production, send to eVault via Web3 Protocol
            console.log('Syncing to eVault:', payload);
        }
    }

    public async handleCrossPlatformData(
        metaEnvelope: MetaEnvelope,
        targetPlatform: string
    ): Promise<PlatformData> {
        // Platform-specific transformations
        const platformTransformations: Record<string, (data: PlatformData) => PlatformData> = {
            twitter: (data) => ({
                ...data,
                post: data.content || data.text,
                reactions: data.userLikes || [],
                comments: data.interactions || []
            }),
            instagram: (data) => ({
                ...data,
                content: data.text || data.post,
                likes: data.userLikes || [],
                responses: data.interactions || [],
                attachment: data.image || data.media
            })
        };

        const baseData = await this.fromEVault(metaEnvelope, 'posts');
        const transformer = platformTransformations[targetPlatform];
        
        return transformer ? transformer(baseData) : baseData;
    }
}