/**
 * List all parent and student accounts so we can manually link them.
 * Uses gcloud user credentials — no service account needed.
 *
 *   node functions/listParentsAndStudents.js
 */
const https = require('https');
const { execSync } = require('child_process');

const PROJECT = 'trisphere-4b121';
const TOKEN = execSync('gcloud auth print-access-token').toString().trim();

function runQuery(role) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: { fieldFilter: { field: { fieldPath: 'role' }, op: 'EQUAL', value: { stringValue: role } } },
      },
    });
    const req = https.request({
      method: 'POST',
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`,
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => resolve(JSON.parse(chunks)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function fld(f, key) {
  const v = f?.[key];
  if (!v) return '';
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.arrayValue) return (v.arrayValue.values || []).map((x) => x.stringValue || '').filter(Boolean);
  return '';
}

(async () => {
  const parents = await runQuery('parent');
  const students = await runQuery('student');

  console.log('\n────────────── PARENTS ──────────────');
  parents.forEach((item) => {
    if (!item.document) return;
    const uid = item.document.name.split('/').pop();
    const f = item.document.fields || {};
    const ids = fld(f, 'childrenIds');
    console.log(`UID: ${uid}`);
    console.log(`  username: ${fld(f, 'username')}`);
    console.log(`  email:    ${fld(f, 'email')}`);
    console.log(`  school:   ${fld(f, 'schoolName')}`);
    console.log(`  childrenIds: ${JSON.stringify(ids)}`);
    console.log('');
  });

  console.log('\n────────────── STUDENTS ──────────────');
  students.forEach((item) => {
    if (!item.document) return;
    const uid = item.document.name.split('/').pop();
    const f = item.document.fields || {};
    console.log(`UID: ${uid}`);
    console.log(`  username: ${fld(f, 'username')}`);
    console.log(`  email:    ${fld(f, 'email')}`);
    console.log(`  class:    ${fld(f, 'class') || fld(f, 'classNumber')}`);
    console.log(`  school:   ${fld(f, 'schoolName')}`);
    console.log(`  parentId: ${fld(f, 'parentId')}`);
    console.log('');
  });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
