const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function normalizeClasses() {
  const usersSnap = await db.collection('users').where('role', '==', 'student').get();
  let count = 0;

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (data.class !== undefined) {
      const normalizedClass = parseInt(data.class);
      if (!isNaN(normalizedClass)) {
        await doc.ref.update({ class: normalizedClass });
        count++;
      }
    }
  }

  console.log(`Normalized class for ${count} students.`);
}

normalizeClasses().catch(console.error);
