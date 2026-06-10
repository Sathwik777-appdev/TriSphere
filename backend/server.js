import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit'; // Security
import textToSpeech from '@google-cloud/text-to-speech';
import aiRoutes from './routes/ai.js';
import reportsRoutes from './routes/reports.js';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { verifyAuth } from './utils/authMiddleware.js';
import { initializeCronJobs } from './utils/cronJobs.js';

// Initialize Firebase Admin
let db;
try {
    if (!getApps().length) {
        initializeApp();
        console.log('🔥 Firebase Admin initialized');
    }
    db = getFirestore();
} catch (error) {
    console.warn('⚠️ Failed to initialize Firebase Admin:', error.message);
    console.warn('⚠️ Leaderboard API will return mock/empty data');
}

export { db };

// In-memory cache for leaderboard (per-school)
let leaderboardCaches = {};
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes


// Load environment variables
dotenv.config();

const app = express();
app.set('trust proxy', 1); // Required for express-rate-limit behind Cloud Run
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
console.log(`📡 Configuring CORS for: ${FRONTEND_URL}`);

// Middleware
//
// Build the allowed-origins list with env-awareness so localhost URLs
// (which only matter for `npm run dev`) never end up on the production
// backend. In production a request claiming to come from `localhost`
// is at best a misconfigured proxy and at worst a spoofed origin
// trying to ride your CORS credentials — neither is something the
// deployed API should accept.
const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = [
    FRONTEND_URL,
    'https://trisphere-4b121.web.app',
    'https://trisphere-4b121.firebaseapp.com',
    'http://localhost',
    'https://localhost',
    'capacitor://localhost'
];

const originOption = (origin, callback) => {
    // Allow requests with no origin (such as mobile apps or server-to-server)
    if (!origin) return callback(null, true);
    
    // Allow any localhost port in development, but restrict in production
    const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);
    const isWhitelisted = allowedOrigins.includes(origin);
    
    if (isWhitelisted || (!isProd && isLocalhost)) {
        callback(null, true);
    } else {
        callback(new Error('Not allowed by CORS'));
    }
};

app.use(cors({
    origin: originOption,
    credentials: true
}));
app.use(helmet()); // Add security headers
app.use(express.json());


// Rate limiter for the broad `/api/*` surface — keeps bots from driving
// runaway cost while letting one logged-in student do everything they need
// in a session. 600 req/15min per IP comfortably handles a full ASTRA
// conversation + dashboard polling + AI tutor usage; well below what a bot
// scraping unauth endpoints would do (those used to drive 1000s/min).
const limbo = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});

// A more generous limiter for the voice/audio endpoints, which a single
// student naturally hits ~10-20 times during an ASTRA conversation. Mounted
// before the broad limiter so it wins for these specific routes.
const voiceLimbo = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many voice requests, please try again later.' }
});

app.use('/api/tts', voiceLimbo);
app.use('/api/astra-voice', voiceLimbo);
// Apply general rate limiting to everything else under /api.
app.use('/api', limbo);


// ── Health Check ─────────────────────────────────────────────────────────────
// Public endpoint — no auth required. Used by Cloud Run health checks,
// uptime monitors, and the developer console to verify all services are live.
app.get('/api/health', (req, res) => {
    const groqKey = (process.env.GROQ_API_KEY || '').trim();
    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();

    const groqStatus = groqKey.length > 10 ? 'configured' : 'missing_key';
    const geminiStatus = geminiKey.length > 10 ? 'configured' : 'missing_key';

    const allOk = groqStatus === 'configured';

    res.status(allOk ? 200 : 503).json({
        status: allOk ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor(process.uptime()),
        services: {
            groq: groqStatus,
            gemini: geminiStatus,
        },
        primary_ai: groqStatus === 'configured' ? 'groq-llama' : 'none',
    });
});

// Routes
app.use('/api/ai', aiRoutes);
app.use('/api/reports', reportsRoutes);

// Leaderboard API
app.get('/api/leaderboard', verifyAuth, async (req, res) => {
    const { schoolName } = req.query;
    const now = Date.now();

    
    // Check cache for this specific school
    const cacheKey = schoolName || 'global';
    const cache = leaderboardCaches[cacheKey];
    if (cache && (now - cache.lastUpdated < CACHE_DURATION)) {
        console.log(`⚡ Serving leaderboard from cache for: ${cacheKey}`);
        return res.json(cache.data);
    }

    if (!db) {
        return res.status(503).json({ error: 'Database not connected' });
    }

    try {
        console.log(`🔄 Calculating fresh leaderboard for: ${cacheKey}...`);

        // Parallelize fetching of all data snapshots
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        let studentQuery = db.collection('users').where('role', '==', 'student');
        if (schoolName) {
            studentQuery = studentQuery.where('schoolName', '==', schoolName);
        }

        // Hard caps on full-collection scans as a cost safety net.
        // Why: an attacker who somehow bypasses auth (or a future code path that
        // forgets to gate this handler) cannot drive unbounded Firestore reads.
        const SCAN_LIMIT = 50000;
        const studentsSnapshot = await studentQuery.limit(SCAN_LIMIT).get();

        // 1. Process students
        const studentsByClass = {};
        const studentClassMap = {}; // mapping studentId -> classNum
        const studentIds = [];

        studentsSnapshot.forEach(doc => {
            const data = doc.data();
            const classNum = parseInt(data.class) || data.class;
            if (!studentsByClass[classNum]) studentsByClass[classNum] = [];
            studentsByClass[classNum].push(doc.id);
            studentClassMap[doc.id] = classNum;
            studentIds.push(doc.id);
        });

        // If no students match, we return early with empty leaderboard data
        if (studentIds.length === 0) {
            const emptyResponse = {
                leaderboard: [],
                weeklyActivity: Array(7).fill(0).map((_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - (6 - i));
                    return {
                        date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                        count: 0
                    };
                }),
                lastUpdated: now
            };
            
            leaderboardCaches[cacheKey] = {
                data: emptyResponse,
                lastUpdated: now
            };

            return res.json(emptyResponse);
        }

        // Fetch other collections
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let quizDocs = [];
        let submissionDocs = [];
        let activitySnapshot;

        // If student count is reasonable, query precisely by student IDs to avoid full collection reads
        if (schoolName && studentIds.length <= 300) {
            console.log(`🎯 Optimized Query: Fetching quiz and submissions for ${studentIds.length} students in chunks`);
            
            const queryInChunks = async (collectionName, studentIdField) => {
                const chunks = [];
                for (let i = 0; i < studentIds.length; i += 30) {
                    chunks.push(studentIds.slice(i, i + 30));
                }
                const promises = chunks.map(chunk => 
                    db.collection(collectionName).where(studentIdField, 'in', chunk).limit(SCAN_LIMIT).get()
                );
                const snaps = await Promise.all(promises);
                const results = [];
                snaps.forEach(snap => {
                    snap.forEach(doc => results.push(doc));
                });
                return results;
            };

            [quizDocs, submissionDocs, activitySnapshot] = await Promise.all([
                queryInChunks('quizResults', 'studentId'),
                queryInChunks('studentSubmissions', 'studentId'),
                db.collection('activityLogs').where('timestamp', '>=', sevenDaysAgo).limit(SCAN_LIMIT).get()
            ]);
        } else {
            console.log(`🌐 General Query: Fetching recent 30-day quiz/submissions globally`);
            const [quizSnapshot, submissionsSnapshot, rawActivitySnapshot] = await Promise.all([
                db.collection('quizResults').where('completedAt', '>=', thirtyDaysAgo).limit(SCAN_LIMIT).get(),
                db.collection('studentSubmissions').where('submittedAt', '>=', thirtyDaysAgo).limit(SCAN_LIMIT).get(),
                db.collection('activityLogs').where('timestamp', '>=', sevenDaysAgo).limit(SCAN_LIMIT).get()
            ]);
            
            quizDocs = quizSnapshot.docs;
            submissionDocs = submissionsSnapshot.docs;
            activitySnapshot = rawActivitySnapshot;
        }

        // 2. Process quizzes
        const quizByClass = {};
        const scoresByClass = {};

        quizDocs.forEach(doc => {
            const data = doc.data();
            const classNum = parseInt(data.class) || data.class;
            if (classNum) {
                quizByClass[classNum] = (quizByClass[classNum] || 0) + 1;

                if (!scoresByClass[classNum]) scoresByClass[classNum] = { total: 0, count: 0 };
                if (!data.malpractice) {
                    scoresByClass[classNum].total += (data.score || 0);
                    scoresByClass[classNum].count++;
                }
            }
        });

        // 3. Process submissions
        const submissionsByClass = {};
        submissionDocs.forEach(doc => {
            const data = doc.data();
            const classNum = studentClassMap[data.studentId];
            if (classNum) {
                submissionsByClass[classNum] = (submissionsByClass[classNum] || 0) + 1;
            }
        });

        // 4. Process Activity Logs (already fetched in parallel)
        const activityByClass = {};
        const dailyActivity = Array(7).fill(0).map((_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return {
                date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                count: 0
            };
        });

        activitySnapshot.forEach(doc => {
            const data = doc.data();
            if (!data.timestamp) return; // Skip if no timestamp

            let timestamp;
            if (data.timestamp.toDate) {
                timestamp = data.timestamp.toDate(); // Firebase Timestamp
            } else if (data.timestamp instanceof Date) {
                timestamp = data.timestamp;
            } else {
                timestamp = new Date(data.timestamp); // String or number?
            }

            if (isNaN(timestamp.getTime())) return; // Skip invalid dates

            const classNum = studentClassMap[data.userId];

            if (classNum) {
                activityByClass[classNum] = (activityByClass[classNum] || 0) + 1;
            }

            const daysDiff = Math.floor((now - timestamp.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff >= 0 && daysDiff < 7) {
                dailyActivity[6 - daysDiff].count++;
            }
        });

        // Calculate final data
        const leaderboardData = Object.keys(studentsByClass).map(classNum => {
            const studentCount = studentsByClass[classNum].length;
            const quizzes = quizByClass[classNum] || 0;
            const submissions = submissionsByClass[classNum] || 0;
            const activities = activityByClass[classNum] || 0;

            const avgQuizzes = studentCount ? Math.round((quizzes / studentCount) * 10) / 10 : 0;
            const avgSubmissions = studentCount ? Math.round((submissions / studentCount) * 10) / 10 : 0;

            // Calculate Score (Simple weighted algorithm)
            // Quiz volume: 20%, Submission volume: 30%, Activity: 10%, Average Score: 40%
            const avgScoreData = scoresByClass[classNum];
            const avgQuizScore = avgScoreData && avgScoreData.count > 0
                ? avgScoreData.total / avgScoreData.count
                : 0;

            const score = Math.round(
                (avgQuizzes * 5) +
                (avgSubmissions * 10) +
                (activities * 0.5) +
                (avgQuizScore * 0.5)
            );

            return {
                class: parseInt(classNum),
                studentCount,
                quizzes,
                submissions,
                activities,
                avgQuizzes,
                avgSubmissions,
                score
            };
        });

        // Sort by score
        leaderboardData.sort((a, b) => b.score - a.score);

        const responseData = {
            leaderboard: leaderboardData,
            weeklyActivity: dailyActivity,
            lastUpdated: now
        };

        // Update cache for this school
        leaderboardCaches[cacheKey] = {
            data: responseData,
            lastUpdated: now
        };


        res.json(responseData);

    } catch (error) {
        console.error('Error calculating leaderboard:', error);
        res.status(500).json({ error: 'Failed to calculate leaderboard' });
    }
});

// Password Update API
app.post('/api/user/update-password', verifyAuth, async (req, res) => {
    const { newPassword } = req.body;

    if (!newPassword) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const uid = req.uid;

        // 2. Update the password via Admin SDK
        await getAuth().updateUser(uid, {
            password: newPassword
        });

        // 3. Update the update timestamp in Firestore
        if (db) {
            try {
                await db.collection('users').doc(uid).update({
                    passwordLastChangedAt: new Date()
                });
            } catch (syncErr) {
                console.warn(`Password updated in Auth but Firestore sync failed for ${uid}:`, syncErr.message);
            }
        }

        console.log(`Password updated successfully for user: ${uid}`);
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ error: 'Failed to update password. ' + error.message });
    }
});

// Bulk Student Promotion API (restricted to admins)
app.post('/api/admin/promote-students', verifyAuth, async (req, res) => {
    // 1. Authorization check
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }

    if (!db) {
        return res.status(503).json({ error: 'Database not connected' });
    }

    try {
        const adminId = req.uid;
        
        // 2. Retrieve admin profile to get their schoolName
        const adminDoc = await db.collection('users').doc(adminId).get();
        if (!adminDoc.exists) {
            return res.status(404).json({ error: 'Admin profile not found.' });
        }

        const adminData = adminDoc.data();
        const schoolName = adminData.schoolName;
        if (!schoolName) {
            return res.status(400).json({ error: 'Admin is not associated with a school.' });
        }

        console.log(`🚀 Bulk promotion initiated for school "${schoolName}" by Admin: ${adminData.username || adminId}`);

        // 3. Query all students of this school
        const studentsSnapshot = await db.collection('users')
            .where('schoolName', '==', schoolName)
            .where('role', '==', 'student')
            .limit(10000)
            .get();

        if (studentsSnapshot.empty) {
            return res.json({ success: true, message: 'No students found to promote.', promotedCount: 0, graduatedCount: 0 });
        }

        // 4. Query all parents of this school to update their children records in sync
        const parentsSnapshot = await db.collection('users')
            .where('schoolName', '==', schoolName)
            .where('role', '==', 'parent')
            .limit(10000)
            .get();

        const parentDocs = parentsSnapshot.docs;
        const parentUpdatesMap = new Map();
        parentDocs.forEach(doc => {
            parentUpdatesMap.set(doc.id, { ref: doc.ref, data: doc.data(), needsUpdate: false });
        });

        const studentDocs = studentsSnapshot.docs;
        let promotedCount = 0;
        let graduatedCount = 0;

        const BATCH_LIMIT = 400;
        let batch = db.batch();
        let opCount = 0;

        // Process student promotions
        for (const studentDoc of studentDocs) {
            const studentData = studentDoc.data();
            const currentClass = studentData.class;
            
            if (currentClass === undefined || currentClass === null) continue;

            const classInt = parseInt(currentClass, 10);
            if (isNaN(classInt)) continue;

            let newClass;
            let newRole = studentData.role;

            if (classInt >= 10) {
                newClass = 'Alumni';
                newRole = 'alumni';
                graduatedCount++;
            } else {
                newClass = classInt + 1;
                promotedCount++;
            }

            // Update student
            batch.update(studentDoc.ref, {
                class: newClass,
                role: newRole,
                promotedAt: Timestamp.now(),
                promotedBy: adminData.username || 'Admin'
            });
            opCount++;

            // Track parent updates in memory
            const parentId = studentData.parentId;
            if (parentId && parentUpdatesMap.has(parentId)) {
                const parentRecord = parentUpdatesMap.get(parentId);
                if (Array.isArray(parentRecord.data.children)) {
                    let updated = false;
                    const updatedChildren = parentRecord.data.children.map(child => {
                        if (child.id === studentDoc.id) {
                            updated = true;
                            return { ...child, class: newClass };
                        }
                        return child;
                    });
                    if (updated) {
                        parentRecord.data.children = updatedChildren;
                        parentRecord.needsUpdate = true;
                    }
                }
            }

            if (opCount >= BATCH_LIMIT) {
                await batch.commit();
                batch = db.batch();
                opCount = 0;
            }
        }

        // Commit parent record updates
        for (const [parentId, record] of parentUpdatesMap.entries()) {
            if (record.needsUpdate) {
                batch.update(record.ref, {
                    children: record.data.children
                });
                opCount++;

                if (opCount >= BATCH_LIMIT) {
                    await batch.commit();
                    batch = db.batch();
                    opCount = 0;
                }
            }
        }

        if (opCount > 0) {
            await batch.commit();
        }

        console.log(`✅ Bulk promotion complete. Promoted: ${promotedCount}, Graduated: ${graduatedCount}`);
        res.json({
            success: true,
            message: `Successfully promoted all students for the June 2025 - March 2026 academic year.`,
            promotedCount,
            graduatedCount
        });

    } catch (error) {
        console.error('Error promoting students:', error);
        res.status(500).json({ error: 'Failed to promote students. ' + error.message });
    }
});

// App Version configuration for update gate
const APP_VERSION_CONFIG = {
    latestVersion: '1.0.0',
    minRequiredVersion: '1.0.0',
    androidStoreUrl: 'https://play.google.com/store/apps/details?id=com.trisphere.app',
    iosStoreUrl: 'https://apps.apple.com/us/app/trisphere/id1234567890'
};

// App Version check endpoint (Public)
app.get('/api/app-version', (req, res) => {
    res.json(APP_VERSION_CONFIG);
});

// Text-to-speech fallback API supporting both GCP TTS and public Google Translate fallback
const handleTTS = async (req, res) => {
    const { text, gender = 'female', lang = 'en-IN' } = req.body || {};

    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text is required' });
    }

    try {
        console.log(`[TTS] Request received for text: "${text.slice(0, 40)}..."`);
        
        // 1. Try premium Google Cloud Text-to-Speech
        try {
            const client = new textToSpeech.TextToSpeechClient();
            let languageCode = lang || 'en-IN';
            let voiceName = gender === 'male' ? `${languageCode}-Wavenet-B` : `${languageCode}-Wavenet-D`;
            
            if (languageCode === 'en-US') {
                voiceName = gender === 'male' ? 'en-US-Neural2-D' : 'en-US-Neural2-F';
            }
            const ssmlGender = gender === 'male' ? 'MALE' : 'FEMALE';

            const request = {
                input: { text: text },
                voice: { languageCode, name: voiceName, ssmlGender },
                audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0 },
            };

            const [response] = await client.synthesizeSpeech(request);
            if (response && response.audioContent) {
                const base64Audio = response.audioContent.toString('base64');
                console.log(`[TTS] Synthesized successfully using Google Cloud TTS`);
                return res.json({ audio: base64Audio });
            }
        } catch (gcpError) {
            console.warn('[TTS] Google Cloud TTS failed or not configured, trying public translate fallback:', gcpError.message || gcpError);
        }

        // 2. Fallback to free public Google Translate TTS
        let languageCode = lang || 'en-IN';
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${languageCode}&client=tw-ob&q=${encodeURIComponent(text)}`;
        
        const fetchRes = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!fetchRes.ok) {
            throw new Error(`Public Translation TTS fetch failed with status: ${fetchRes.status}`);
        }

        const arrayBuffer = await fetchRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Audio = buffer.toString('base64');
        console.log(`[TTS] Synthesized successfully using Public Translation TTS fallback`);
        return res.json({ audio: base64Audio });

    } catch (error) {
        console.error('[TTS] Text-to-speech generation failed completely:', error);
        res.status(500).json({ error: 'Text-to-speech generation failed', details: error.message });
    }
};

app.post('/api/tts', handleTTS);
app.post('/api/astra-voice', handleTTS);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'TriSphere backend server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 TriSphere backend server running on port ${PORT}`);
    console.log(`📡 Accepting requests from ${FRONTEND_URL}`);
    initializeCronJobs();
});
