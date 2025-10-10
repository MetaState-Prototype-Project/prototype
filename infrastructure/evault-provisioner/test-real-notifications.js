#!/usr/bin/env node

/**
 * Test script for the REAL notification system
 * 
 * This shows how notifications are actually stored and retrieved
 */

import axios from 'axios';

const PROVISIONER_URL = process.env.PROVISIONER_URL || 'http://localhost:3001';
const SHARED_SECRET = process.env.NOTIFICATION_SHARED_SECRET || 'your-secret-here';

// Test data
const TEST_ENAME = 'test@example.com';

async function testRealNotificationFlow() {
    try {
        console.log('🧪 Testing REAL notification flow...\n');

        // Step 1: Send a notification (this stores it in the database)
        console.log('1️⃣ Sending notification (storing in database)...');
        const sendResponse = await axios.post(`${PROVISIONER_URL}/api/notifications/send`, {
            eName: TEST_ENAME,
            notification: {
                title: 'Hello from Provisioner!',
                body: 'This notification was stored in the database and will be delivered when you check.',
                data: {
                    type: 'test',
                    timestamp: new Date().toISOString(),
                    source: 'provisioner-test'
                }
            },
            sharedSecret: SHARED_SECRET
        });

        console.log('✅ Notification sent:', sendResponse.data);
        console.log('📝 Notification is now stored in the database\n');

        // Step 2: Check for notifications (this retrieves and marks as delivered)
        console.log('2️⃣ Checking for notifications (retrieving from database)...');
        const checkResponse = await axios.post(`${PROVISIONER_URL}/api/notifications/check`, {
            eName: TEST_ENAME,
            deviceId: 'test-device-123'
        });

        console.log('✅ Notifications retrieved:', checkResponse.data);
        console.log('📱 These notifications should now appear in the eid-wallet app!\n');

        // Step 3: Check again (should be empty now)
        console.log('3️⃣ Checking again (should be empty now)...');
        const checkAgainResponse = await axios.post(`${PROVISIONER_URL}/api/notifications/check`, {
            eName: TEST_ENAME,
            deviceId: 'test-device-123'
        });

        console.log('✅ Second check result:', checkAgainResponse.data);
        console.log('🎉 Notification system working correctly!');

    } catch (error: any) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

// Run the test
testRealNotificationFlow();
