import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import fs from 'fs';

const content = fs.readFileSync('src/services/firebase.js', 'utf8');
const configMatch = content.match(/const firebaseConfig = ({[\s\S]*?});/);
if (!configMatch) { console.error('No config found'); process.exit(1); }

let configStr = configMatch[1];
// Replace unquoted keys
configStr = configStr.replace(/([a-zA-Z0-9_]+):/g, '"$1":');
const config = JSON.parse(configStr);

const app = initializeApp(config);
const db = getFirestore(app);

async function checkLogs() {
  const q = query(collection(db, 'errorLogs'), orderBy('timestamp', 'desc'), limit(5));
  const snap = await getDocs(q);
  snap.forEach(doc => console.log(doc.data().message, doc.data().stack, doc.data().context));
  process.exit(0);
}
checkLogs();
