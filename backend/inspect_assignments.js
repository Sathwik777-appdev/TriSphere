import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function inspectAssignments() {
    try {
        if (!getApps().length) {
            initializeApp();
        }
        const db = getFirestore();
        
        console.log('--- Inspecting Assignments in Firestore ---');
        
        const assignmentsSnapshot = await db.collection('assignments').get();
        if (assignmentsSnapshot.empty) {
            console.log('No assignments found.');
            process.exit(0);
        }
        
        console.log(`Found ${assignmentsSnapshot.docs.length} assignments:`);
        assignmentsSnapshot.docs.forEach((doc, idx) => {
            const data = doc.data();
            console.log(`\n[${idx + 1}] ID: ${doc.id}`);
            console.log(`    Title/Chapter: ${data.assignmentTitle || data.chapterName || 'N/A'}`);
            console.log(`    Subject: ${data.subject}`);
            console.log(`    Class: ${data.class} (${typeof data.class})`);
            console.log(`    dueDate: ${data.dueDate} (${typeof data.dueDate})`);
            if (data.dueDate && data.dueDate.toDate) {
                console.log(`    dueDate (parsed toDate): ${data.dueDate.toDate().toISOString()}`);
            }
            console.log(`    createdAt: ${data.createdAt} (${typeof data.createdAt})`);
            if (data.createdAt && data.createdAt.toDate) {
                console.log(`    createdAt (parsed toDate): ${data.createdAt.toDate().toISOString()}`);
            }
            console.log(`    timestamp: ${data.timestamp} (${typeof data.timestamp})`);
        });
        
        console.log('\n--- Inspection Complete ---');
        process.exit(0);
    } catch (error) {
        console.error('❌ Inspection failed:', error);
        process.exit(1);
    }
}

inspectAssignments();
