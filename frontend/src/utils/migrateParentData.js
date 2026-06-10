import { db } from '../services/firebase';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

/**
 * One-time migration script to add parent information to existing student documents
 * Run this once from the Admin Dashboard to fix students showing "N/A" for parent details
 */
export async function migrateParentDataToStudents() {
  const results = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  try {
    console.log('🔄 Starting parent data migration...');

    // Get all students
    const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
    const studentsSnapshot = await getDocs(studentsQuery);
    results.total = studentsSnapshot.size;

    console.log(`📊 Found ${results.total} students to check`);

    // Get all parents
    const parentsQuery = query(collection(db, 'users'), where('role', '==', 'parent'));
    const parentsSnapshot = await getDocs(parentsQuery);
    const parents = [];
    
    parentsSnapshot.forEach(doc => {
      parents.push({ id: doc.id, ...doc.data() });
    });

    console.log(`👨‍👩‍👧 Found ${parents.length} parents`);

    // Update each student
    for (const studentDoc of studentsSnapshot.docs) {
      const studentData = studentDoc.data();
      const studentId = studentDoc.id;

      // Skip if already has parent info
      if (studentData.parentId && studentData.parentName && studentData.parentEmail) {
        console.log(`⏭️ Skipping ${studentData.username} - already has parent info`);
        results.skipped++;
        continue;
      }

      // Find parent with this student in their children array
      const parent = parents.find(p => 
        p.children && p.children.some(child => child.id === studentId)
      );

      if (parent) {
        try {
          await updateDoc(doc(db, 'users', studentId), {
            parentId: parent.id,
            parentName: parent.username,
            parentEmail: parent.email
          });

          console.log(`✅ Updated ${studentData.username} with parent ${parent.username}`);
          results.updated++;
        } catch (error) {
          console.error(`❌ Failed to update ${studentData.username}:`, error);
          results.errors.push({
            student: studentData.username,
            error: error.message
          });
        }
      } else {
        console.warn(`⚠️ No parent found for ${studentData.username} (${studentId})`);
        results.errors.push({
          student: studentData.username,
          error: 'No parent found'
        });
      }
    }

    console.log('\n📈 Migration Complete!');
    console.log(`Total students: ${results.total}`);
    console.log(`Updated: ${results.updated}`);
    console.log(`Skipped: ${results.skipped}`);
    console.log(`Errors: ${results.errors.length}`);

    if (results.errors.length > 0) {
      console.log('\n⚠️ Errors:');
      results.errors.forEach(err => {
        console.log(`  - ${err.student}: ${err.error}`);
      });
    }

    return results;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
