const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const REGISTRY_URL = process.env.REGISTRY_URL || 'http://localhost:4321';
const EVault_BASE_URL = process.env.EVAULT_BASE_URL || 'http://localhost:4000';
const USER_SCHEMA_ID = '550e8400-e29b-41d4-a716-446655440000';

// In-memory cache
let registryCache = [];
let userProfilesCache = new Map();

// GraphQL query for searching user profiles
const SEARCH_USER_PROFILES_QUERY = `
  query SearchUserProfiles($term: String!) {
    searchMetaEnvelopes(ontology: "User", term: $term) {
      id
      parsed
      envelopes {
        ontology
        value
      }
    }
  }
`;

// Function to fetch all vault entries from registry
async function fetchRegistryData() {
    try {
        console.log('Fetching registry data...');
        const response = await axios.get(`${REGISTRY_URL}/list`);
        registryCache = response.data;
        console.log(`Cached ${registryCache.length} registry entries`);
    } catch (error) {
        console.error('Error fetching registry data:', error.message);
    }
}

// Function to fetch user profiles from eVault
async function fetchUserProfiles() {
    try {
        console.log('Fetching user profiles...');
        
        // First, get all user profile IDs by ontology
        const findUsersQuery = `
            query {
                findMetaEnvelopesByOntology(ontology: "User")
            }
        `;
        
        const findResponse = await axios.post(`${EVault_BASE_URL}/graphql`, {
            query: findUsersQuery
        });
        
        const userIds = findResponse.data.data.findMetaEnvelopesByOntology;
        console.log(`Found ${userIds.length} user profiles`);
        
        // Clear existing cache
        userProfilesCache.clear();
        
        // Fetch each user profile
        for (const userId of userIds) {
            try {
                const getUserQuery = `
                    query {
                        getMetaEnvelopeById(id: "${userId}") {
                            id
                            ontology
                            parsed
                            envelopes {
                                id
                                ontology
                                value
                                valueType
                            }
                        }
                    }
                `;
                
                const userResponse = await axios.post(`${EVault_BASE_URL}/graphql`, {
                    query: getUserQuery
                });
                
                const userData = userResponse.data.data.getMetaEnvelopeById;
                if (userData && userData.parsed) {
                    userProfilesCache.set(userId, userData.parsed);
                }
            } catch (error) {
                console.error(`Error fetching user profile ${userId}:`, error.message);
            }
        }
        
        console.log(`Cached ${userProfilesCache.size} user profiles`);
    } catch (error) {
        console.error('Error fetching user profiles:', error.message);
    }
}

// Function to perform full data refresh
async function refreshAllData() {
    await fetchRegistryData();
    await fetchUserProfiles();
}

// Search function for registry entries
function searchRegistry(query, searchType = 'all') {
    const searchTerm = query.toLowerCase();
    
    return registryCache.filter(entry => {
        switch (searchType) {
            case 'ename':
                return entry.ename.toLowerCase().includes(searchTerm);
            case 'w3id':
                return entry.ename.toLowerCase().includes(searchTerm);
            case 'uri':
                return entry.uri.toLowerCase().includes(searchTerm);
            case 'evault':
                return entry.evault.toLowerCase().includes(searchTerm);
            default:
                return (
                    entry.ename.toLowerCase().includes(searchTerm) ||
                    entry.uri.toLowerCase().includes(searchTerm) ||
                    entry.evault.toLowerCase().includes(searchTerm)
                );
        }
    });
}

// Search function for user profiles
function searchUserProfiles(query, searchType = 'all') {
    const searchTerm = query.toLowerCase();
    const results = [];
    
    for (const [userId, userData] of userProfilesCache.entries()) {
        let match = false;
        
        switch (searchType) {
            case 'username':
                match = userData.username && userData.username.toLowerCase().includes(searchTerm);
                break;
            case 'displayName':
                match = userData.displayName && userData.displayName.toLowerCase().includes(searchTerm);
                break;
            case 'bio':
                match = userData.bio && userData.bio.toLowerCase().includes(searchTerm);
                break;
            case 'location':
                match = userData.location && userData.location.toLowerCase().includes(searchTerm);
                break;
            case 'website':
                match = userData.website && userData.website.toLowerCase().includes(searchTerm);
                break;
            default:
                match = (
                    (userData.username && userData.username.toLowerCase().includes(searchTerm)) ||
                    (userData.displayName && userData.displayName.toLowerCase().includes(searchTerm)) ||
                    (userData.bio && userData.bio.toLowerCase().includes(searchTerm)) ||
                    (userData.location && userData.location.toLowerCase().includes(searchTerm)) ||
                    (userData.website && userData.website.toLowerCase().includes(searchTerm))
                );
        }
        
        if (match) {
            results.push({
                id: userId,
                ...userData
            });
        }
    }
    
    return results;
}

// API Endpoints

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        registryEntries: registryCache.length,
        userProfiles: userProfilesCache.size,
        lastUpdated: new Date().toISOString()
    });
});

// Search registry entries
app.get('/search/registry', (req, res) => {
    const { q, type } = req.query;
    
    if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    const results = searchRegistry(q, type);
    res.json({
        query: q,
        type: type || 'all',
        count: results.length,
        results
    });
});

// Search user profiles
app.get('/search/users', (req, res) => {
    const { q, type } = req.query;
    
    if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    const results = searchUserProfiles(q, type);
    res.json({
        query: q,
        type: type || 'all',
        count: results.length,
        results
    });
});

// Combined search
app.get('/search', (req, res) => {
    const { q, type } = req.query;
    
    if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    const registryResults = searchRegistry(q, type);
    const userResults = searchUserProfiles(q, type);
    
    res.json({
        query: q,
        type: type || 'all',
        registry: {
            count: registryResults.length,
            results: registryResults
        },
        users: {
            count: userResults.length,
            results: userResults
        }
    });
});

// Get cache statistics
app.get('/cache/stats', (req, res) => {
    res.json({
        registryEntries: registryCache.length,
        userProfiles: userProfilesCache.size,
        lastUpdated: new Date().toISOString()
    });
});

// Manual refresh endpoint
app.post('/refresh', async (req, res) => {
    try {
        await refreshAllData();
        res.json({ 
            success: true, 
            message: 'Cache refreshed successfully',
            registryEntries: registryCache.length,
            userProfiles: userProfilesCache.size
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Start server
async function startServer() {
    // Initial data load
    await refreshAllData();
    
    // Schedule cron job to refresh data every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
        console.log('Running scheduled data refresh...');
        await refreshAllData();
    });
    
    app.listen(PORT, () => {
        console.log(`Search engine service running on port ${PORT}`);
        console.log(`Registry URL: ${REGISTRY_URL}`);
        console.log(`eVault URL: ${EVault_BASE_URL}`);
        console.log(`User Schema ID: ${USER_SCHEMA_ID}`);
    });
}

startServer(); 