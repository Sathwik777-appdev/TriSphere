import cron from 'node-cron';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

/**
 * Initializes and starts all backend cron jobs for Push Notifications.
 */
export const initializeCronJobs = () => {
    console.log('⏰ Initializing push notification cron jobs...');
    
    // 1. ASTRA Check-in and Streak Reminder
    // Schedule: Every day at 16:00 (4:00 PM)
    cron.schedule('0 16 * * *', async () => {
        console.log('⏰ Running ASTRA / Streak Reminder Cron Job...');
        try {
            const db = getFirestore();
            const messaging = getMessaging();
            
            // Get today's date in YYYY-MM-DD format (local timezone)
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;
            
            // Get all students
            const studentsSnapshot = await db.collection('users').where('role', '==', 'student').get();
            const tokensToNotify = [];
            
            for (const studentDoc of studentsSnapshot.docs) {
                const studentId = studentDoc.id;
                const studentData = studentDoc.data();
                
                // If student hasn't enabled push notifications, skip
                if (!studentData.fcmTokens || studentData.fcmTokens.length === 0) continue;
                
                // Check if they checked in today (studentMoods is keyed by `${studentId}_${YYYY-MM-DD}`)
                const moodDocId = `${studentId}_${todayStr}`;
                const moodDoc = await db.collection('studentMoods').doc(moodDocId).get();
                
                if (!moodDoc.exists) {
                    // Send reminder
                    studentData.fcmTokens.forEach(token => {
                        tokensToNotify.push({
                            token,
                            notification: {
                                title: 'ASTRA is waiting for you! 🌟',
                                body: 'Don\'t forget to do your daily emotional check-in to maintain your streak.'
                            }
                        });
                    });
                }
            }
            
            if (tokensToNotify.length > 0) {
                const messages = tokensToNotify.map(item => ({
                    token: item.token,
                    notification: item.notification,
                    data: { route: '/dashboard' }
                }));
                
                // SendAll accepts max 500 messages at a time.
                const chunks = [];
                for (let i = 0; i < messages.length; i += 500) {
                    chunks.push(messages.slice(i, i + 500));
                }
                
                for (const chunk of chunks) {
                    const response = await messaging.sendEach(chunk);
                    console.log(`⏰ Sent ${response.successCount} ASTRA reminders, ${response.failureCount} failed.`);
                }
            } else {
                console.log('⏰ No ASTRA reminders to send today.');
            }
            
        } catch (error) {
            console.error('⏰ Error in ASTRA Reminder Cron Job:', error);
        }
    });

    // 2. Deadline Reminder
    // Schedule: Every day at 18:00 (6:00 PM)
    cron.schedule('0 18 * * *', async () => {
        console.log('⏰ Running Deadline Reminder Cron Job...');
        try {
            const db = getFirestore();
            const messaging = getMessaging();
            
            const now = new Date();
            const tomorrow = new Date();
            tomorrow.setDate(now.getDate() + 1); // 24 hours from now
            
            // Query all assignments
            const assignmentsSnapshot = await db.collection('assignments').get();
            
            // Map assignment to target class + school
            const urgentAssignments = [];
            assignmentsSnapshot.forEach(doc => {
                const data = doc.data();
                if (!data.dueDate) return;
                
                const dueDate = new Date(data.dueDate);
                // If it's due within the next 24 hours (and not already past due)
                if (dueDate > now && dueDate <= tomorrow) {
                    urgentAssignments.push({
                        id: doc.id,
                        title: data.assignmentTitle || data.chapterName,
                        classNum: parseInt(data.class) || data.class,
                        schoolName: data.schoolName
                    });
                }
            });
            
            if (urgentAssignments.length === 0) {
                console.log('⏰ No urgent deadlines today.');
                return;
            }
            
            const tokensToNotify = [];
            
            // Optimize by looping students instead of doing a complex cross-join query
            const studentsSnapshot = await db.collection('users').where('role', '==', 'student').get();
            
            for (const studentDoc of studentsSnapshot.docs) {
                const studentData = studentDoc.data();
                if (!studentData.fcmTokens || studentData.fcmTokens.length === 0) continue;
                
                const studentClass = parseInt(studentData.class) || studentData.class;
                const studentSchool = studentData.schoolName;
                
                // Find any urgent assignments for this student
                const studentAssignments = urgentAssignments.filter(a => 
                    a.classNum === studentClass && (!a.schoolName || a.schoolName === studentSchool)
                );
                
                if (studentAssignments.length > 0) {
                    const titles = studentAssignments.map(a => a.title).join(', ');
                    studentData.fcmTokens.forEach(token => {
                        tokensToNotify.push({
                            token,
                            notification: {
                                title: '⏰ Assignments Due Soon!',
                                body: `You have ${studentAssignments.length} assignment(s) due tomorrow: ${titles}. Don't miss the deadline!`
                            }
                        });
                    });
                }
            }
            
            if (tokensToNotify.length > 0) {
                const messages = tokensToNotify.map(item => ({
                    token: item.token,
                    notification: item.notification,
                    data: { route: '/dashboard' }
                }));
                
                const chunks = [];
                for (let i = 0; i < messages.length; i += 500) {
                    chunks.push(messages.slice(i, i + 500));
                }
                
                for (const chunk of chunks) {
                    const response = await messaging.sendEach(chunk);
                    console.log(`⏰ Sent ${response.successCount} Deadline reminders, ${response.failureCount} failed.`);
                }
            } else {
                console.log('⏰ No deadline reminders matched to active students.');
            }
            
        } catch (error) {
            console.error('⏰ Error in Deadline Reminder Cron Job:', error);
        }
    });
};
