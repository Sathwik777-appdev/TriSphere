
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

async function checkContent() {
  console.log('--- Checking Content for Class 10 Physics ---');
  
  // Try with Number 10
  const tbNum = await db.collection('textbooks')
    .where('class', '==', 10)
    .where('subject', '==', 'Physics')
    .get();
  
  // Try with String "10"
  const tbStr = await db.collection('textbooks')
    .where('class', '==', "10")
    .where('subject', '==', 'Physics')
    .get();
  
  console.log(`Textbooks found (Num 10): ${tbNum.size}`);
  tbNum.forEach(doc => console.log(` - ${doc.data().chapterName}`));
  
  console.log(`Textbooks found (Str "10"): ${tbStr.size}`);
  tbStr.forEach(doc => console.log(` - ${doc.data().chapterName}`));

  const aiNum = await db.collection('aiGeneratedContent')
    .where('class', '==', 10)
    .where('subject', '==', 'Physics')
    .get();

  const aiStr = await db.collection('aiGeneratedContent')
    .where('class', '==', "10")
    .where('subject', '==', 'Physics')
    .get();
  
  console.log(`AI Content found (Num 10): ${aiNum.size}`);
  aiNum.forEach(doc => console.log(` - ${doc.data().chapterName}`));

  console.log(`AI Content found (Str "10"): ${aiStr.size}`);
  aiStr.forEach(doc => console.log(` - ${doc.data().chapterName}`));

  process.exit(0);
}

checkContent().catch(err => {
  console.error(err);
  process.exit(1);
});
