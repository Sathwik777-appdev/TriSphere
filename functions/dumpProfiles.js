const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');

const t = execSync('gcloud auth print-access-token').toString().trim();
function get(path) {
  return new Promise((res, rej) => {
    https.get(
      'https://firestore.googleapis.com/v1/projects/trisphere-4b121/databases/(default)/documents' + path,
      { headers: { Authorization: 'Bearer ' + t } },
      (r) => {
        let d = '';
        r.on('data', (c) => (d += c));
        r.on('end', () => res(JSON.parse(d)));
      }
    );
  });
}

(async () => {
  const r = await get('/publicProfiles?pageSize=100');
  const lines = [`Total docs: ${(r.documents || []).length}`];
  (r.documents || []).forEach((d) => {
    const uid = d.name.split('/').pop();
    const f = d.fields || {};
    lines.push(
      `${uid.slice(0, 8)} | username=${JSON.stringify(f.username?.stringValue)} | role=${JSON.stringify(f.role?.stringValue)} | school=${JSON.stringify(f.schoolName?.stringValue)} | searchU=${JSON.stringify(f.searchUsername?.stringValue)}`
    );
  });
  fs.writeFileSync('/tmp/profiles-dump.txt', lines.join('\n'));
  console.log('WROTE', lines.length, 'lines to /tmp/profiles-dump.txt');
})();
