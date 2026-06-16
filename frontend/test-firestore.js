import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB0a8AP88OrZLZdx7CYWLQZQfknkwbj6yw",
  authDomain: "trisphere-4b121.firebaseapp.com",
  projectId: "trisphere-4b121",
  storageBucket: "trisphere-4b121.firebasestorage.app",
  messagingSenderId: "906769842576",
  appId: "1:906769842576:web:0b8c46cba1a6d9e7e7b315"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkLogs() {
  console.log("Fetching logs...");
  try {
    const q = query(collection(db, 'errorLogs'), orderBy('timestamp', 'desc'), limit(15));
    const snap = await getDocs(q);
    snap.forEach(doc => {
      const data = doc.data();
      console.log('------------------');
      console.log('Context:', data.context);
      console.log('Message:', data.message);
      console.log('Stack:', data.stack);
    });
    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkLogs();
