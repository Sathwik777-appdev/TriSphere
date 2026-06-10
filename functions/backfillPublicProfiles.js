/**
 * One-time backfill: mirror every users/{uid} doc → publicProfiles/{uid}
 * with only the safe fields the student search overlay needs.
 *
 * Uses your existing gcloud user credentials (`gcloud auth print-access-token`)
 * — no service account JSON needed.
 *
 * Run from project root:
 *   node functions/backfillPublicProfiles.js
 *
 * Idempotent: safe to re-run anytime. Won't touch /users.
 */
const https = require('https');
const { execSync } = require('child_process');

const PROJECT_ID = 'trisphere-4b121';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function getAccessToken() {
  try {
    return execSync('gcloud auth print-access-token', { stdio: ['ignore', 'pipe', 'pipe'] })
      .toString().trim();
  } catch (err) {
    console.error('Failed to get gcloud access token. Are you logged into gcloud?');
    console.error('Run: gcloud auth login');
    process.exit(1);
  }
}

const TOKEN = getAccessToken();

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : BASE + path);
    const opts = {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(opts, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode}: ${chunks}`));
        }
        try { resolve(chunks ? JSON.parse(chunks) : {}); }
        catch (e) { resolve({}); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Firestore REST API uses typed values. Convert a JS value to its REST shape.
function encode(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(encode) } };
  }
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = encode(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

// Decode a Firestore REST typed value back to plain JS.
function decode(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.nullValue !== undefined) return null;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.mapValue) {
    const out = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) out[k] = decode(val);
    return out;
  }
  if (v.arrayValue) {
    return (v.arrayValue.values || []).map(decode);
  }
  return null;
}

function buildPublicProfile(data) {
  return {
    username: String(data.username || ''),
    name: String(data.name || ''),
    role: String(data.role || ''),
    class: data.class ?? null,
    classNumber: data.classNumber ?? null,
    schoolName: String(data.schoolName || ''),
    profilePhoto: data.profilePhoto || null,
    searchUsername: String(data.username || '').toLowerCase(),
    searchName: String(data.name || '').toLowerCase(),
    stats: {
      tasksCompleted: data.stats?.tasksCompleted ?? 0,
      averageScore: data.stats?.averageScore ?? 0,
      streak: data.stats?.streak ?? 0,
      xpBalance: data.stats?.xpBalance ?? 0,
    },
  };
}

async function listUsers(pageToken) {
  const path = `/users?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
  const res = await request('GET', path);
  return {
    docs: (res.documents || []).map(d => ({
      uid: d.name.split('/').pop(),
      data: Object.fromEntries(
        Object.entries(d.fields || {}).map(([k, v]) => [k, decode(v)])
      ),
    })),
    nextPageToken: res.nextPageToken,
  };
}

async function writePublicProfile(uid, profile) {
  // PATCH with updateMask omitted → full replace of the listed fields.
  const fields = Object.fromEntries(
    Object.entries(profile).map(([k, v]) => [k, encode(v)])
  );
  await request('PATCH', `/publicProfiles/${uid}`, { fields });
}

async function main() {
  let total = 0;
  let succeeded = 0;
  let failed = 0;
  let pageToken = null;

  console.log('Starting backfill of publicProfiles…');
  while (true) {
    const page = await listUsers(pageToken);
    if (page.docs.length === 0 && !pageToken) {
      console.log('No users found.');
      break;
    }
    for (const { uid, data } of page.docs) {
      total++;
      try {
        const profile = buildPublicProfile(data);
        await writePublicProfile(uid, profile);
        succeeded++;
        const label = profile.username || profile.name || uid.slice(0, 8);
        const role = profile.role || '(no role)';
        process.stdout.write(`  [${succeeded}] ${label} (${role})\n`);
      } catch (err) {
        failed++;
        console.error(`  Failed for ${uid}:`, err.message);
      }
    }
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }

  console.log('\nDone.');
  console.log(`  Total users:  ${total}`);
  console.log(`  Mirrored:     ${succeeded}`);
  console.log(`  Failed:       ${failed}`);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
