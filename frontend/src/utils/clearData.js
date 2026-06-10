/**
 * Utility to clear all past content and data
 * Run this in browser console: clearAllData()
 */

import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

export const clearAllData = async () => {
  try {
    console.log('🧹 Starting data cleanup...');
    
    // 1. Clear textbooks (and PDFs)
    console.log('📚 Clearing textbooks...');
    const textbooksSnapshot = await getDocs(collection(db, 'textbooks'));
    for (const document of textbooksSnapshot.docs) {
      await deleteDoc(doc(db, 'textbooks', document.id));
    }
    console.log(`✅ Deleted ${textbooksSnapshot.size} textbooks`);
    
    // 2. Clear AI generated content (notes, quiz)
    console.log('🤖 Clearing AI generated content...');
    const aiContentSnapshot = await getDocs(collection(db, 'aiGeneratedContent'));
    for (const document of aiContentSnapshot.docs) {
      await deleteDoc(doc(db, 'aiGeneratedContent', document.id));
    }
    console.log(`✅ Deleted ${aiContentSnapshot.size} AI content items`);
    
    // 3. Clear quiz results
    console.log('📝 Clearing quiz results...');
    const quizResultsSnapshot = await getDocs(collection(db, 'quizResults'));
    for (const document of quizResultsSnapshot.docs) {
      await deleteDoc(doc(db, 'quizResults', document.id));
    }
    console.log(`✅ Deleted ${quizResultsSnapshot.size} quiz results`);
    
    // 4. Clear assignments
    console.log('✍️ Clearing assignments...');
    const assignmentsSnapshot = await getDocs(collection(db, 'assignments'));
    for (const document of assignmentsSnapshot.docs) {
      await deleteDoc(doc(db, 'assignments', document.id));
    }
    console.log(`✅ Deleted ${assignmentsSnapshot.size} assignments`);
    
    // 5. Clear student submissions (grades)
    console.log('🎯 Clearing student submissions...');
    const submissionsSnapshot = await getDocs(collection(db, 'studentSubmissions'));
    for (const document of submissionsSnapshot.docs) {
      await deleteDoc(doc(db, 'studentSubmissions', document.id));
    }
    console.log(`✅ Deleted ${submissionsSnapshot.size} submissions`);
    
    // 6. Clear localStorage
    console.log('💾 Clearing localStorage...');
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('studentStats') || 
        key.includes('teacherStats') || 
        key.includes('quizCompleted') ||
        key.includes('quizBanned') ||
        key.includes('mockTextbooks')
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`✅ Cleared ${keysToRemove.length} localStorage items`);
    
    console.log('🎉 All data cleared successfully!');
    console.log('🔄 Please refresh the page to see changes.');
    
    return {
      success: true,
      message: 'All data cleared successfully! Refresh the page.'
    };
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    return {
      success: false,
      message: 'Error clearing data: ' + error.message
    };
  }
};

// Make it available in browser console
if (typeof window !== 'undefined') {
  window.clearAllData = clearAllData;
}

export default clearAllData;
