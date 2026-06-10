
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function testConnection() {
    try {
        if (!getApps().length) {
            initializeApp();
        }
        const db = getFirestore();
        
        console.log('--- Testing Firestore Connection ---');
        
        // 1. List collections (at least top level)
        const collections = await db.listCollections();
        console.log('Available Collections:', collections.map(c => c.id));
        
        // 2. Fetch sample from 'users'
        const usersSnapshot = await db.collection('users').limit(1).get();
        if (!usersSnapshot.empty) {
            console.log('Successfully fetched sample user:', usersSnapshot.docs[0].id);
        } else {
            console.log('Users collection is empty or inaccessible');
        }
        
        // 3. Fetch sample from 'quizResults'
        const quizSnapshot = await db.collection('quizResults').limit(1).get();
        if (!quizSnapshot.empty) {
            console.log('Successfully fetched sample quizResult:', quizSnapshot.docs[0].id);
        } else {
            console.log('quizResults collection is empty or inaccessible');
        }

        console.log('--- Connection Test Complete ---');
        process.exit(0);
    } catch (error) {
        console.error('❌ Connection test failed:', error.message);
        process.exit(1);
    }
}

testConnection();
