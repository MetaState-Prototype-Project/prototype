import { Web3Adapter } from '../src/adapter.js';
import type { MetaEnvelope, PlatformData } from '../src/types.js';

async function demonstrateWeb3Adapter() {
    console.log('=== Web3 Adapter Usage Example ===\n');

    // Initialize the adapter for a Twitter-like platform
    const twitterAdapter = new Web3Adapter({
        platform: 'twitter',
        ontologyServerUrl: 'http://ontology-server.local',
        eVaultUrl: 'http://evault.local'
    });

    await twitterAdapter.initialize();
    console.log('✅ Twitter adapter initialized\n');

    // Example 1: Platform A (Twitter) creates a post
    console.log('📝 Platform A (Twitter) creates a post:');
    const twitterPost: PlatformData = {
        id: 'twitter-post-123',
        post: 'Cross-platform test post from Twitter! 🚀',
        reactions: ['user1', 'user2', 'user3'],
        comments: ['Great post!', 'Thanks for sharing!'],
        media: 'https://example.com/image.jpg',
        createdAt: new Date().toISOString(),
        _acl_read: ['user1', 'user2', 'user3', 'public'],
        _acl_write: ['twitter-post-123-author']
    };

    // Convert to eVault format
    const eVaultPayload = await twitterAdapter.toEVault('posts', twitterPost);
    console.log('Converted to MetaEnvelope:', {
        id: eVaultPayload.metaEnvelope.id,
        ontology: eVaultPayload.metaEnvelope.ontology,
        envelopesCount: eVaultPayload.metaEnvelope.envelopes.length,
        acl: eVaultPayload.metaEnvelope.acl
    });
    console.log('');

    // Example 2: Platform B (Instagram) reads the same post
    console.log('📱 Platform B (Instagram) reads the same post:');
    
    const instagramAdapter = new Web3Adapter({
        platform: 'instagram',
        ontologyServerUrl: 'http://ontology-server.local',
        eVaultUrl: 'http://evault.local'
    });
    await instagramAdapter.initialize();

    // Instagram receives the MetaEnvelope and transforms it to their format
    const instagramPost = await instagramAdapter.handleCrossPlatformData(
        eVaultPayload.metaEnvelope,
        'instagram'
    );

    console.log('Instagram format:', {
        content: instagramPost.content,
        likes: instagramPost.likes,
        responses: instagramPost.responses,
        attachment: instagramPost.attachment
    });
    console.log('');

    // Example 3: Batch synchronization
    console.log('🔄 Batch synchronization example:');
    const batchPosts: PlatformData[] = [
        {
            id: 'batch-1',
            post: 'First batch post',
            reactions: ['user1'],
            createdAt: new Date().toISOString()
        },
        {
            id: 'batch-2',
            post: 'Second batch post',
            reactions: ['user2', 'user3'],
            createdAt: new Date().toISOString()
        },
        {
            id: 'batch-3',
            post: 'Third batch post with private ACL',
            reactions: ['user4'],
            createdAt: new Date().toISOString(),
            _acl_read: ['user4', 'user5'],
            _acl_write: ['user4']
        }
    ];

    await twitterAdapter.syncWithEVault('posts', batchPosts);
    console.log(`✅ Synced ${batchPosts.length} posts to eVault\n`);

    // Example 4: Handling ACLs
    console.log('🔒 ACL Handling example:');
    const privatePost: PlatformData = {
        id: 'private-post-456',
        post: 'This is a private post',
        reactions: [],
        _acl_read: ['friend1', 'friend2', 'friend3'],
        _acl_write: ['private-post-456-author']
    };

    const privatePayload = await twitterAdapter.toEVault('posts', privatePost);
    console.log('Private post ACL:', privatePayload.metaEnvelope.acl);
    console.log('');

    // Example 5: Reading back from eVault with ID mapping
    console.log('🔍 ID Mapping example:');
    
    // When reading back, IDs are automatically mapped
    const retrievedPost = await twitterAdapter.fromEVault(
        eVaultPayload.metaEnvelope,
        'posts'
    );
    
    console.log('Original local ID:', twitterPost.id);
    console.log('W3ID:', eVaultPayload.metaEnvelope.id);
    console.log('Retrieved local ID:', retrievedPost.id);
    console.log('');

    // Example 6: Cross-platform data transformation
    console.log('🔄 Cross-platform transformation:');
    
    // Create a mock MetaEnvelope as if it came from eVault
    const mockMetaEnvelope: MetaEnvelope = {
        id: 'w3-id-789',
        ontology: 'SocialMediaPost',
        acl: ['*'],
        envelopes: [
            {
                id: 'env-1',
                ontology: 'text',
                value: 'Universal post content',
                valueType: 'string'
            },
            {
                id: 'env-2',
                ontology: 'userLikes',
                value: ['alice', 'bob', 'charlie'],
                valueType: 'array'
            },
            {
                id: 'env-3',
                ontology: 'interactions',
                value: ['Nice!', 'Cool post!'],
                valueType: 'array'
            },
            {
                id: 'env-4',
                ontology: 'image',
                value: 'https://example.com/universal-image.jpg',
                valueType: 'string'
            },
            {
                id: 'env-5',
                ontology: 'dateCreated',
                value: new Date().toISOString(),
                valueType: 'string'
            }
        ]
    };

    // Transform for different platforms
    const platforms = ['twitter', 'instagram'];
    for (const platform of platforms) {
        const transformedData = await twitterAdapter.handleCrossPlatformData(
            mockMetaEnvelope,
            platform
        );
        console.log(`${platform} format:`, Object.keys(transformedData).slice(0, 4));
    }

    console.log('\n✅ Web3 Adapter demonstration complete!');
}

// Run the demonstration
demonstrateWeb3Adapter().catch(console.error);