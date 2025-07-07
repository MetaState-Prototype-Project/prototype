const axios = require('axios');

const BASE_URL = 'http://localhost:3002';

async function testSearchEngine() {
    console.log('🧪 Testing Search Engine Service...\n');

    try {
        // Test health endpoint
        console.log('1. Testing health endpoint...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Health check passed:', healthResponse.data);
        console.log('');

        // Test cache stats
        console.log('2. Testing cache stats...');
        const statsResponse = await axios.get(`${BASE_URL}/cache/stats`);
        console.log('✅ Cache stats:', statsResponse.data);
        console.log('');

        // Test registry search
        console.log('3. Testing registry search...');
        const registryResponse = await axios.get(`${BASE_URL}/search/registry?q=test`);
        console.log('✅ Registry search:', registryResponse.data);
        console.log('');

        // Test user search
        console.log('4. Testing user search...');
        const userResponse = await axios.get(`${BASE_URL}/search/users?q=test`);
        console.log('✅ User search:', userResponse.data);
        console.log('');

        // Test combined search
        console.log('5. Testing combined search...');
        const combinedResponse = await axios.get(`${BASE_URL}/search?q=test`);
        console.log('✅ Combined search:', combinedResponse.data);
        console.log('');

        console.log('🎉 All tests passed! Search engine service is working correctly.');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

// Run tests
testSearchEngine(); 