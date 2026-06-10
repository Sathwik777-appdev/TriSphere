import express from 'express';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { generateStudentPDF, generateAIRemark, getGrade } from '../services/pdfService.js';
import { parseFirestoreDate } from '../utils/dateUtils.js';
import { verifyAuth } from '../utils/authMiddleware.js';


const router = express.Router();

/**
 * Middleware: Verify Firebase ID token from Authorization header.
 */

/**
 * Helper: Check if today is within the download window (25th to last day of month).
 */
function isDownloadWindowOpen() {
    const now = new Date();
    const day = now.getDate();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return day >= 25 && day <= lastDay;
}

/**
 * Helper: Get the month name and year for the report period.
 */
function getReportPeriod() {
    const now = new Date();
    // If we're between 25th and end of month, the report is for the current month
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return { month: monthNames[now.getMonth()], year: now.getFullYear() };
}

/**
 * Helper: Get default subjects for a class level.
 */
function getSubjectsByClass(classNumber) {
    const classNum = parseInt(classNumber) || 10;
    
    // Primary (Class 1-5)
    if (classNum >= 1 && classNum <= 5) {
        return ['Mathematics', 'English', 'Science', 'Social Studies', 'Computer Science', 'Hindi', 'EVS'];
    }
    // Middle (Class 6-8)
    if (classNum >= 6 && classNum <= 8) {
        return ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History & Civics', 'Geography', 'English', 'Computer Science'];
    }
    // Secondary (Class 9-10)
    if (classNum >= 9 && classNum <= 10) {
        return ['Mathematics', 'Computer Applications', 'Physics', 'Chemistry', 'Biology', 'History & Civics', 'Geography', 'English'];
    }
    
    // Fallback/Default (same as secondary)
    return ['Mathematics', 'Computer Applications', 'Physics', 'Chemistry', 'Biology', 'History & Civics', 'Geography', 'English'];
}

/**
 * Helper: Fetch all data needed for a student report.
 */
async function fetchStudentReportData(db, studentId, classNumber, schoolName, cachedClassQuizzes = null) {
    const { month, year } = getReportPeriod();

    // 1. Get student info
    const studentDoc = await db.collection('users').doc(studentId).get();
    if (!studentDoc.exists) throw new Error('Student not found');
    const student = studentDoc.data();

    // 2. Get quiz results for this student in the current month
    const monthStart = new Date(year, new Date().getMonth(), 1);
    const monthEnd = new Date(year, new Date().getMonth() + 1, 0, 23, 59, 59);

    const quizSnapshot = await db.collection('quizResults')
        .where('studentId', '==', studentId)
        .where('completedAt', '>=', Timestamp.fromDate(monthStart))
        .where('completedAt', '<=', Timestamp.fromDate(monthEnd))
        .get();

    const monthlyQuizzes = quizSnapshot.docs.map(doc => doc.data());


    // 3. Aggregate subject scores
    const subjectMap = {};
    const defaultSubjects = getSubjectsByClass(student.class || classNumber);
    
    // Pre-initialize subject map with default subjects
    defaultSubjects.forEach(s => {
        subjectMap[s] = { totalScore: 0, totalMax: 0, count: 0 };
    });

    monthlyQuizzes.forEach(q => {
        const subj = q.subject || 'General';
        if (!subjectMap[subj]) {
            subjectMap[subj] = { totalScore: 0, totalMax: 0, count: 0 };
        }
        subjectMap[subj].totalScore += (q.score || 0);
        subjectMap[subj].totalMax += (q.totalQuestions || q.total || 10);
        subjectMap[subj].count++;
    });

    const subjectScores = [];
    // First, add default subjects in order
    defaultSubjects.forEach(s => {
        const data = subjectMap[s];
        subjectScores.push({
            subject: s,
            marks: data.totalScore,
            total: data.totalMax || 100 // Use 100 as base if no quizzes for this subject
        });
    });

    // Then, add any extra subjects found in quizzes
    Object.keys(subjectMap).forEach(s => {
        if (!defaultSubjects.includes(s)) {
            const data = subjectMap[s];
            subjectScores.push({
                subject: s,
                marks: data.totalScore,
                total: data.totalMax || 100
            });
        }
    });

    const totalMarks = subjectScores.reduce((sum, s) => sum + s.marks, 0);
    const maxMarks = subjectScores.reduce((sum, s) => sum + s.total, 0);
    const percentage = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;
    const grade = getGrade(percentage);

    // 4. Attendance from activityLogs (unique login days this month)
    const activitySnapshot = await db.collection('activityLogs')
        .where('userId', '==', studentId)
        .where('timestamp', '>=', monthStart)
        .where('timestamp', '<=', monthEnd)
        .get();

    const uniqueDays = new Set();
    activitySnapshot.docs.forEach(doc => {
        const ts = parseFirestoreDate(doc.data().timestamp);
        if (ts) uniqueDays.add(ts.toDateString());
    });


    const totalSchoolDays = Math.min(new Date().getDate(), monthEnd.getDate()); // days so far or total
    const workingDays = Math.round(totalSchoolDays * 5 / 7); // approximate working days
    const presentDays = uniqueDays.size;
    const absentDays = Math.max(0, workingDays - presentDays);
    const attendancePercent = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;

    // Build weekly attendance data (4 weeks)
    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    const weeklyPresent = [0, 0, 0, 0];
    const weeklyAbsent = [0, 0, 0, 0];

    uniqueDays.forEach(dayStr => {
        const d = new Date(dayStr);
        const weekIndex = Math.min(3, Math.floor((d.getDate() - 1) / 7));
        weeklyPresent[weekIndex]++;
    });

    for (let i = 0; i < 4; i++) {
        const daysInWeek = i < 3 ? 5 : Math.max(1, workingDays - 15); // approximate
        weeklyAbsent[i] = Math.max(0, Math.min(5, daysInWeek) - weeklyPresent[i]);
    }

    const attendanceData = {
        labels: weeks,
        present: weeklyPresent,
        absent: weeklyAbsent
    };

    // 5. Previous month quiz data for trend comparison
    const prevMonthStart = new Date(year, new Date().getMonth() - 1, 1);
    const prevMonthEnd = new Date(year, new Date().getMonth(), 0, 23, 59, 59);

    const prevQuizSnapshot = await db.collection('quizResults')
        .where('studentId', '==', studentId)
        .where('completedAt', '>=', Timestamp.fromDate(prevMonthStart))
        .where('completedAt', '<=', Timestamp.fromDate(prevMonthEnd))
        .get();

    const prevMonthQuizzes = prevQuizSnapshot.docs.map(doc => doc.data());


    const prevSubjectMap = {};
    prevMonthQuizzes.forEach(q => {
        const subj = q.subject || 'General';
        if (!prevSubjectMap[subj]) {
            prevSubjectMap[subj] = { totalScore: 0, totalMax: 0 };
        }
        prevSubjectMap[subj].totalScore += (q.score || 0);
        prevSubjectMap[subj].totalMax += (q.totalQuestions || q.total || 10);
    });

    const marksTrend = {
        subjects: subjectScores.map(s => s.subject),
        current: subjectScores.map(s => s.total > 0 ? Math.round((s.marks / s.total) * 100) : 0),
        previous: subjectScores.map(s => {
            const prev = prevSubjectMap[s.subject];
            return prev && prev.totalMax > 0 ? Math.round((prev.totalScore / prev.totalMax) * 100) : 0;
        })
    };

    // 6. Class comparison (student avg vs class avg vs topper)
    const classStr = String(classNumber);
    const classInt = parseInt(classNumber);

    let allDocs = [];
    if (cachedClassQuizzes) {
        allDocs = cachedClassQuizzes;
    } else {
        const allClassQuizzes = await db.collection('quizResults')
            .where('class', '==', classInt)
            .where('completedAt', '>=', Timestamp.fromDate(monthStart))
            .where('completedAt', '<=', Timestamp.fromDate(monthEnd))
            .get();

        const allClassQuizzes2 = await db.collection('quizResults')
            .where('class', '==', classStr)
            .where('completedAt', '>=', Timestamp.fromDate(monthStart))
            .where('completedAt', '<=', Timestamp.fromDate(monthEnd))
            .get();

        allDocs = [...allClassQuizzes.docs, ...allClassQuizzes2.docs];
    }
    const studentScores = {};
    const seen = new Set();

    allDocs.forEach(doc => {
        if (seen.has(doc.id)) return;
        seen.add(doc.id);
        const data = doc.data();
        const sid = data.studentId;
        if (!sid) return;
        if (!studentScores[sid]) studentScores[sid] = { total: 0, max: 0 };
        studentScores[sid].total += (data.score || 0);
        studentScores[sid].max += (data.totalQuestions || data.total || 10);
    });

    const allPercentages = Object.values(studentScores)
        .filter(s => s.max > 0)
        .map(s => Math.round((s.total / s.max) * 100));

    const classAvg = allPercentages.length > 0
        ? Math.round(allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length)
        : 0;
    const topperAvg = allPercentages.length > 0 ? Math.max(...allPercentages) : 0;

    const classComparison = {
        student: percentage,
        classAvg,
        topper: topperAvg
    };

    // 7. AI Remark
    const aiRemark = await generateAIRemark(student.username || 'Student', subjectScores, attendancePercent);

    return {
        studentName: student.username || student.name || 'Student',
        className: String(student.class || classNumber),
        section: student.section || '',
        month,
        year,
        schoolName: student.schoolName || schoolName || 'TriSphere Academy',
        profilePhoto: student.profilePic || student.photoURL || null,
        subjectScores,
        totalMarks,
        maxMarks,
        percentage,
        grade,
        attendanceData,
        attendancePercent: Math.min(attendancePercent, 100),
        marksTrend,
        classComparison,
        aiRemark
    };
}

// ==================== API ROUTES ====================

/**
 * GET /api/reports/status
 * Check download window status and report availability.
 */
router.get('/status', (req, res) => {
    const windowOpen = isDownloadWindowOpen();
    const { month, year } = getReportPeriod();
    res.json({
        downloadEnabled: windowOpen,
        reportPeriod: `${month} ${year}`,
        message: windowOpen
            ? 'Reports are available for download.'
            : 'Reports will be available for download from the 25th of every month.'
    });
});

/**
 * POST /api/reports/generate
 * Generate a single student report PDF.
 * Body: { studentId, classNumber, schoolName }
 */
router.post('/generate', verifyAuth, async (req, res) => {
    const { studentId, classNumber, schoolName } = req.body;

    if (!studentId) {
        return res.status(400).json({ error: 'studentId is required.' });
    }

    try {
        const db = getFirestore();

        // Verify caller permissions
        const callerDoc = await db.collection('users').doc(req.uid).get();
        if (!callerDoc.exists) return res.status(403).json({ error: 'User not found.' });

        const callerRole = callerDoc.data().role;
        const isParent = callerRole === 'parent';
        const isTeacher = callerRole === 'teacher';
        const isAdmin = callerRole === 'principal' || callerRole === 'admin';
        const isDev = callerRole === 'developer';

        // Parents can only download their child's report within the window
        if (isParent) {
            if (!isDownloadWindowOpen()) {
                return res.status(403).json({
                    error: 'Reports will be available for download from the 25th of every month.'
                });
            }
            // Verify this is their child (linked in their user document)
            const childIds = callerDoc.data()?.childrenIds || callerDoc.data()?.childIds || [];
            if (!childIds.includes(studentId)) {
                return res.status(403).json({ error: 'You can only view your own child\'s report.' });
            }
        }

        if (!isTeacher && !isAdmin && !isParent && !isDev) {
            return res.status(403).json({ error: 'Insufficient permissions.' });
        }

        console.log(`📄 Generating report for student: ${studentId}`);
        const reportData = await fetchStudentReportData(db, studentId, classNumber, schoolName);
        const pdfBuffer = await generateStudentPDF(reportData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="report_${studentId}_${reportData.month}_${reportData.year}.pdf"`);
        res.send(Buffer.from(pdfBuffer));

        console.log(`✅ Report generated for ${reportData.studentName}`);
    } catch (error) {
        console.error('Report generation error:', error);
        res.status(500).json({ error: 'Failed to generate report: ' + error.message });
    }
});

/**
 * POST /api/reports/generate-batch
 * Generate reports for all students in a class.
 * Body: { classNumber, schoolName }
 * Returns a ZIP file with all student PDFs.
 */
router.post('/generate-batch', verifyAuth, async (req, res) => {
    const { classNumber, schoolName } = req.body;

    if (!classNumber) {
        return res.status(400).json({ error: 'classNumber is required.' });
    }

    try {
        const db = getFirestore();

        // Only teachers, admins, and devs can batch generate
        const callerDoc = await db.collection('users').doc(req.uid).get();
        if (!callerDoc.exists) return res.status(403).json({ error: 'User not found.' });

        const callerRole = callerDoc.data().role;
        if (!['teacher', 'principal', 'admin', 'developer'].includes(callerRole)) {
            return res.status(403).json({ error: 'Only teachers and admins can generate class reports.' });
        }

        // Get all students in this class
        const classInt = parseInt(classNumber);
        const classStr = String(classNumber);


        let studentsQuery = db.collection('users').where('role', '==', 'student');
        if (schoolName) studentsQuery = studentsQuery.where('schoolName', '==', schoolName);

        const snapshot = await studentsQuery.get();
        const students = snapshot.docs.filter(doc => {
            const c = doc.data().class;
            return c === classInt || String(c) === classStr;
        });

        if (students.length === 0) {
            return res.status(404).json({ error: 'No students found for this class.' });
        }

        console.log(`📦 Batch generating reports for ${students.length} students in class ${classNumber}`);

        // Prefetch class quizzes once to avoid O(N^2) query explosion
        const { month: reportMonth, year: reportYear } = getReportPeriod();
        const monthStart = new Date(reportYear, new Date().getMonth(), 1);
        const monthEnd = new Date(reportYear, new Date().getMonth() + 1, 0, 23, 59, 59);

        const allClassQuizzes = await db.collection('quizResults')
            .where('class', '==', classInt)
            .where('completedAt', '>=', Timestamp.fromDate(monthStart))
            .where('completedAt', '<=', Timestamp.fromDate(monthEnd))
            .get();

        const allClassQuizzes2 = await db.collection('quizResults')
            .where('class', '==', classStr)
            .where('completedAt', '>=', Timestamp.fromDate(monthStart))
            .where('completedAt', '<=', Timestamp.fromDate(monthEnd))
            .get();

        const cachedClassQuizzes = [...allClassQuizzes.docs, ...allClassQuizzes2.docs];

        // Dynamic import of archiver for ZIP
        const archiver = (await import('archiver')).default;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="class_${classNumber}_reports_${getReportPeriod().month}_${getReportPeriod().year}.zip"`);

        const archive = archiver('zip', { zlib: { level: 5 } });
        archive.pipe(res);

        for (const studentDoc of students) {
            try {
                const reportData = await fetchStudentReportData(db, studentDoc.id, classNumber, schoolName, cachedClassQuizzes);
                const pdfBuffer = await generateStudentPDF(reportData);
                const safeName = (reportData.studentName || studentDoc.id).replace(/[^a-zA-Z0-9_-]/g, '_');
                archive.append(Buffer.from(pdfBuffer), { name: `${safeName}_report.pdf` });
                console.log(`  ✅ Generated for ${reportData.studentName}`);
            } catch (err) {
                console.error(`  ❌ Failed for ${studentDoc.id}:`, err.message);
            }
        }

        await archive.finalize();
        console.log(`📦 Batch report ZIP sent for class ${classNumber}`);
    } catch (error) {
        console.error('Batch report error:', error);
        res.status(500).json({ error: 'Failed to generate batch reports: ' + error.message });
    }
});

export default router;
