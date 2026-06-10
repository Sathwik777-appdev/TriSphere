/**
 * One-time backfill: copies `role` from every users/{uid} Firestore doc
 * onto the matching Auth user as a custom claim.
 *
 * Run ONCE from your local machine after deploying syncUserClaims:
 *
 *   1. Firebase Console -> Project Settings -> Service accounts -> Generate new private key
 *      Save the JSON as `serviceAccount.json` in THIS folder (functions/).
 *   2. cd functions && node backfillClaims.js
 *   3. Delete serviceAccount.json when done.
 *
 * Safe to re-run: idempotent (setting the same claim twice is a no-op).
 * Does NOT modify Firestore. Does NOT delete any users.
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const keyPath = path.join(__dirname, 'serviceAccount.json');
if (!fs.existsSync(keyPath)) {
  console.error('Missing functions/serviceAccount.json. See header comment for instructions.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(keyPath)),
});

async function backfill() {
  const snapshot = await admin.firestore().collection('users').get();
  console.log(`Found ${snapshot.size} user docs.`);

  let set = 0, skipped = 0, missingAuth = 0, noRole = 0;

  for (const doc of snapshot.docs) {
    const uid = doc.id;
    const role = doc.data().role;

    if (!role) {
      noRole++;
      continue;
    }

    try {
      const authUser = await admin.auth().getUser(uid);
      const existing = authUser.customClaims || {};
      if (existing.role === role) {
        skipped++;
        continue;
      }
      await admin.auth().setCustomUserClaims(uid, { ...existing, role });
      console.log(`  [${++set}] ${uid.slice(0, 8)}... role=${role}`);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        missingAuth++;
        console.warn(`  Auth user missing for doc ${uid}`);
      } else {
        console.error(`  Error on ${uid}:`, err.message);
      }
    }
  }

  console.log('\nDone.');
  console.log(`  Set: ${set}`);
  console.log(`  Already correct: ${skipped}`);
  console.log(`  Docs without role: ${noRole}`);
  console.log(`  Docs with no matching Auth user: ${missingAuth}`);
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
