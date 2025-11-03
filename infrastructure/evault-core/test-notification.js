#!/usr/bin/env node

/**
 * Test script for sending notifications via evault-core
 * 
 * Usage:
 * 1. Set NOTIFICATION_SHARED_SECRET in your .env file
 * 2. Run: node test-notification.js
 * 3. Or use curl commands below
 */

import axios from 'axios';

const PROVISIONER_URL = process.env.PROVISIONER_URL || 'http://localhost:3001';
const SHARED_SECRET = process.env.NOTIFICATION_SHARED_SECRET || 'your-secret-here';

// Test data - replace with actual eName from your database
const TEST_ENAME = 'test@example.com'; // Replace with actual eName
const TEST_NOTIFICATION = {
    title: 'Test Notification',
    body: 'This is a test notification from evault-core!',
    data: {
        type: 'test',
        timestamp: new Date().toISOString()
    }
};

async function testNotification() {
    try {
        console.log('🚀 Testing notification system...');
        console.log(`📡 Sending to: ${PROVISIONER_URL}/api/notifications/send`);
        console.log(`👤 Target eName: ${TEST_ENAME}`);
        console.log(`📝 Notification:`, TEST_NOTIFICATION);

        const response = await axios.post(`${PROVISIONER_URL}/api/notifications/send`, {
            eName: TEST_ENAME,
            notification: TEST_NOTIFICATION,
            sharedSecret: SHARED_SECRET
        });

        console.log('✅ Success!', response.data);
    } catch (error: any) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

async function getDeviceStats() {
    try {
        console.log('\n📊 Getting device stats...');
        const response = await axios.get(`${PROVISIONER_URL}/api/devices/stats`);
        console.log('📈 Device Stats:', response.data);
    } catch (error: any) {
        console.error('❌ Error getting stats:', error.response?.data || error.message);
    }
}

// Run tests
async function main() {
    await testNotification();
    await getDeviceStats();
}

main();
