import express from 'express';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { chatWithFallback, callGeminiAPI } from '../utils/groqFallback.js';
import { verifyAuth } from '../utils/authMiddleware.js';

dotenv.config();

const router = express.Router();

// Strict rate-limiting for LLM API endpoints to prevent financial abuse
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 80, // Limit each IP to 80 AI requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'You are asking questions too fast. Please take a short break before chatting again.' }
});

router.use(aiLimiter);

// Initialize Groq Clients (Dual-Key Routing)
const groqFree = new Groq({
    apiKey: (process.env.GROQ_API_KEY || '').trim()
});

const groqPaid = process.env.GROQ_API_KEY_PAID ? new Groq({
    apiKey: process.env.GROQ_API_KEY_PAID.trim()
}) : null;

const groqClients = { free: groqFree, paid: groqPaid };

// Safety Guardrails & Content Classification Filters
const crisisKeywords = /\b(kill myself|suicide|suicidal|end it all|want to die|disappear|no point|self.?harm|hurting myself|cut myself|nobody cares|nobody would care|hate myself)\b/i;
const adultObsceneKeywords = /\b(porn|sex|pornography|naked|erotic|kamasutra|boobs|penis|vagina|fuck|bitch|bastard|asshole|dick|pussy)\b/i;

function evaluateSafety(text) {
    if (crisisKeywords.test(text)) {
        return {
            safe: false,
            reason: 'crisis',
            message: "I hear you, and you matter. Please know that you are not alone. I encourage you to speak to a trusted teacher, parent, or counselor who can help support you right now. If you are in India, you can also call iCall at 9152987821 (free and confidential)."
        };
    }
    if (adultObsceneKeywords.test(text)) {
        return {
            safe: false,
            reason: 'inappropriate',
            message: "I can only help with homework, school topics, and learning questions. Let's redirect our focus to your studies! What subject are we working on today?"
        };
    }
    return { safe: true };
}

// Daily limits configuration for students
const LIMIT_GRADES_1_3 = 2;
const LIMIT_GRADES_4_5 = 5;
const LIMIT_GRADES_6_10 = 10;

const getDailyLimitForGrade = (rawGrade) => {
  const grade = parseInt(rawGrade, 10);
  if (Number.isNaN(grade)) return LIMIT_GRADES_6_10;
  if (grade >= 1 && grade <= 3) return LIMIT_GRADES_1_3;
  if (grade >= 4 && grade <= 5) return LIMIT_GRADES_4_5;
  return LIMIT_GRADES_6_10;
};

// POST /api/ai/astra
// Open-ended emotional check-in. Student writes freely how they feel; ASTRA
// classifies the emotion + severity, returns an empathetic reply, and flags
// entries that need a human (signs of severe distress, self-harm, etc.) so
// teachers/counselors can follow up.
router.post('/astra', verifyAuth, async (req, res) => {
    try {
        const { feeling, studentName, cameraFrame, cameraFrames, activitySummary } = req.body || {};
        const safeFeeling = String(feeling || '').slice(0, 1500).trim();
        if (safeFeeling.length < 2) {
            return res.status(400).json({ error: 'feeling text is required' });
        }

        // Inappropriate/Adult content check for ASTRA
        const inappropriateCheck = evaluateSafety(safeFeeling);
        if (!inappropriateCheck.safe && inappropriateCheck.reason === 'inappropriate') {
            return res.json({
                emotion: 'neutral',
                severity: 'low',
                needsAttention: false,
                message: "Let's keep our conversation respectful and focused on school life. How has your week been at school?"
            });
        }

        let prompt = `You are ASTRA, a warm, attentive school mentor reading a student's free-text answer to "How are you really feeling today?". Your job is to (1) classify the emotion honestly, (2) flag if a real adult should reach out, (3) reply with deep empathy and tangible motivation.
CRITICAL NAME RULE: You must NEVER address or refer to the student by their real name under any circumstances. You must always refer to them as "BUDDY" (or "buddy") in your response message.

Student name: BUDDY
Their words: """${safeFeeling}"""`;

        if (activitySummary) {
            prompt += `\n\nStudent's learning activity context in the app over the past 7 days:
- Daily Login Streak: ${activitySummary.streak} days
- Current XP Balance: ${activitySummary.xpBalance} XP
- Equipped Profile Avatar: ${activitySummary.equippedAvatar || 'default'} (with ${activitySummary.inventoryCount || 0} items in their reward store inventory)
- Assignments completed: ${activitySummary.assignmentsCompletedCount || 0} completed (${(activitySummary.assignmentsCompletedList || []).join(', ') || 'none'})
- Simulations completed: ${activitySummary.simulationsCompletedCount || 0} completed (${(activitySummary.simulationsCompletedList || []).join(', ') || 'none'})
- Quizzes taken: ${activitySummary.quizzesTakenCount || 0} taken (${(activitySummary.quizzesTakenList || []).map(q => `${q.chapterName} with score ${q.score}%`).join(', ') || 'none'})
- Textbook Notes read: ${(activitySummary.notesReadList || []).join(', ') || 'none'}
- Chatbot Messages sent to Lernix AI: ${activitySummary.chatbotMessagesSent || 0} messages

Instructions for suggesting next steps based on their activity:
1. Praise them if they have high activity (e.g., high login streak, completed assignments/quizzes, bought store items).
2. If they have low activity or seem tired/stressed, suggest one simple, achievable thing to focus on next (e.g., "I notice you read some Physics notes this week, maybe try the 5-question quiz for that chapter to see how it went?" or "Let's take it easy today; maybe just read a quick note on Biology when you feel up to it").
3. Connect their emotional check-in answer with their activity. For example, if they say they feel stressed about exams and they have 0 assignments done, reassure them and suggest starting with one simple notes chapter.
4. Keep the suggestions short and friendly (max 2 sentences for the suggestion part, conforming to the length restrictions).`;
        }

        prompt += `\n\nReply with ONLY a strict JSON object on a single line. No markdown, no preamble.
The JSON must have exactly these keys:
- "emotion": one of "happy" | "excited" | "calm" | "neutral" | "tired" | "stressed" | "anxious" | "sad" | "angry" | "lonely" | "depressed"
- "severity": one of "low" | "moderate" | "high"
- "needsAttention": boolean — set true ONLY if the message hints at any of: self-harm, suicidal thoughts, abuse, severe hopelessness, or someone hurting them. Otherwise false.
- "message": reply text. Max 480 chars. No emojis. Length and content depend on emotion (see TONE BY EMOTION). CRITICAL: Do NOT mention the student's name; always address them as "BUDDY" or "buddy".

TONE BY EMOTION (very important — adapt the message to how they sound):
- happy / excited / calm: 2 sentences. Match their energy briefly + channel into focus.
- neutral / tired: 2 sentences. Steady "small wins compound" energy + one tiny next step.
- stressed / anxious / sad / angry / lonely: 3 sentences. (1) Validate using their own words ("that sounds really hard / it makes sense you feel that way"). (2) ONE motivating reframe — make them feel heard, not lectured. (3) ONE tiny achievable step. Avoid "just cheer up" / toxic positivity.
- depressed / very low (no crisis flag): 3 sentences. Extra warmth + "you matter" + remind them one small thing today is enough.

CRISIS RESPONSE (when needsAttention is true) — make this substantial:
  3-4 sentences (up to 480 chars). It MUST:
  1. Tell them clearly you hear them and they matter.
  2. Reassure them they are NOT alone — but DO NOT mention reporting, teachers, parents, or that anyone else will be told. The student must feel safe sharing without fearing their words will be sent anywhere.
  3. Encourage THEM (their own decision) to reach out to a trusted teacher, parent, friend, or counselor — phrase it as their choice, not something happening to them.
  4. Give the India helpline: iCall 9152987821 (free, confidential).
  5. End with a grounding line — "please reach out to one person today, even one".
  STRICT RULE — NEVER say any of: "I'm letting a teacher know", "I'll tell your parent", "I'm sharing this", "this is being sent", "I'm flagging this", "I'm reporting", or any equivalent phrasing. The student is told nothing about the alert system.
  Example: "Buddy, what you're carrying is real, and I'm so glad you told me. You matter — even on the days that feel impossible. You don't have to face this alone — please reach out to a teacher you trust, a parent, or a friend today. If it helps, you can call iCall at 9152987821 — free and confidential. Reach out to one person today, even just one."

Examples of high severity needsAttention=true: mentions of "want to disappear", "can't go on", "no one would care", "hurting myself", "want to die", being hurt by someone.
Examples of moderate: "really stressed about exams", "fighting with parents", "lonely lately".
Examples of low: "tired", "fine I guess", "good day".`;

        let completionResult = null;
        let framesToSend = [];

        if (Array.isArray(cameraFrames) && cameraFrames.length > 0) {
            framesToSend = cameraFrames.filter(f => typeof f === 'string' && f.startsWith('data:image/'));
        } else if (cameraFrame && typeof cameraFrame === 'string' && cameraFrame.startsWith('data:image/')) {
            framesToSend = [cameraFrame];
        }

        const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
        if (!geminiApiKey) {
            console.warn('[ASTRA] GEMINI_API_KEY is not configured on the server. Skipping Gemini direct calls.');
        }

        if (geminiApiKey && framesToSend.length > 0) {
            try {
                console.log(`[ASTRA] Processing check-in with ${framesToSend.length} camera frames using Gemini 2.5 Flash-Lite...`);
                const visionPrompt = `${prompt}

CRITICAL VISUAL INPUT (Selfie Camera Frames): You are also provided ${framesToSend.length} sequential snapshots of the student's face taken via their selfie camera at regular intervals while they spoke.
Please analyze their facial expressions and emotional trajectory across these frames (e.g. smile, neutral, frown, looking down, tearful, tired, yawning, looking away).
Cross-reference these visual cues with their text feedback:
- If they look visibly sad, anxious, crying, or exhausted in the frames, but say something brief or dismissive like "fine" or "okay", make sure to set severity to at least "moderate" or "high", flag needsAttention if appropriate, and write a reply that gently validates their struggle (e.g. "I noticed you looked a bit down while we were talking, and it is okay to not be okay...").
- If they look happy/smiling across the frames, match their positive energy.
- Respond with standard JSON conforming to the requested schema.`;

                const imageParts = framesToSend.map(frame => ({
                    type: 'image_url',
                    image_url: { url: frame }
                }));

                const completion = await callGeminiAPI(geminiApiKey, {
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: visionPrompt },
                                ...imageParts
                            ]
                        }
                    ],
                    temperature: 0.5,
                    max_tokens: 350,
                    response_format: { type: 'json_object' }
                });
                completionResult = { completion, modelUsed: 'gemini-2.5-flash-lite' };
            } catch (visionErr) {
                console.warn('[ASTRA] Vision completion failed, falling back to text-only:', visionErr.message || visionErr);
                // Fall back to text-only below
            }
        }

        if (!completionResult) {
            console.log('[ASTRA] Processing text-only check-in...');
            if (geminiApiKey) {
                try {
                    console.log('[ASTRA] Trying text-only check-in using Gemini 2.5 Flash-Lite...');
                    const completion = await callGeminiAPI(geminiApiKey, {
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.5,
                        max_tokens: 350,
                        response_format: { type: 'json_object' }
                    });
                    completionResult = { completion, modelUsed: 'gemini-2.5-flash-lite' };
                } catch (geminiErr) {
                    console.warn('[ASTRA] Text-only Gemini check-in failed, falling back to Groq Llama:', geminiErr.message || geminiErr);
                }
            }

            if (!completionResult) {
                console.log('[ASTRA] Trying check-in using Groq Llama...');
                const { completion, modelUsed } = await chatWithFallback(groqClients, {
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.5,
                    max_tokens: 350,
                    response_format: { type: 'json_object' }
                }, {
                    chain: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
                });
                completionResult = { completion, modelUsed };
            }
        }

        const { completion } = completionResult;

        const raw = completion.choices?.[0]?.message?.content || '';
        let parsed = null;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            try {
                const match = raw.match(/\{[\s\S]*\}/);
                parsed = match ? JSON.parse(match[0]) : null;
            } catch (e2) {
                parsed = null;
            }
        }

        // Hard-coded safety net: even if the model fails, scan for crisis
        // keywords ourselves. Better to over-flag than miss one.
        const tripwire = crisisKeywords.test(safeFeeling);

        // Schema validation: ensure essential keys are present and typed correctly
        const hasValidKeys = parsed && 
                             typeof parsed.emotion === 'string' &&
                             typeof parsed.message === 'string';

        if (!hasValidKeys) {
            // Deterministic fallback so the modal never gets stuck.
            const message = tripwire
                ? `Buddy, I'm really glad you shared this with me. You don't have to carry this alone — please reach out to someone you trust today, even one person. In India you can call iCall at 9152987821, free and confidential. You matter.`
                : `Thanks for sharing that with me, buddy. Whatever you're carrying today is real — let's start small. Pick one thing on your list that feels doable, even if it's tiny.`;
            return res.json({
                emotion: tripwire ? 'depressed' : 'neutral',
                severity: tripwire ? 'high' : 'moderate',
                needsAttention: tripwire,
                message,
                fallback: true
            });
        }

        const emotion = String(parsed.emotion).toLowerCase();
        const severity = ['low', 'moderate', 'high'].includes(parsed.severity) ? parsed.severity : 'moderate';
        const needsAttention = Boolean(parsed.needsAttention) || tripwire;
        const message = String(parsed.message).slice(0, 500);

        return res.json({ emotion, severity, needsAttention, message });
    } catch (error) {
        console.error('ASTRA endpoint error:', error);
        // Hard safety net — even if the entire AI stack is down, students
        // still get a warm, human response instead of a broken error screen.
        // This is intentionally deterministic so it never fails.
        const tripwire = crisisKeywords.test(String(req.body?.feeling || ''));
        return res.json({
            emotion: tripwire ? 'depressed' : 'neutral',
            severity: tripwire ? 'high' : 'low',
            needsAttention: tripwire,
            message: tripwire
                ? "Buddy, I'm really glad you shared this with me. You don't have to carry this alone — please reach out to someone you trust today, even one person. In India you can call iCall at 9152987821, free and confidential. You matter."
                : "Thanks for checking in with me today, buddy! I'm always here for you. Whatever you're feeling right now is valid — take a deep breath and know that you've got this. See you tomorrow!",
            fallback: true
        });
    }
});

// POST /api/ai/chat
router.post('/chat', verifyAuth, async (req, res) => {
    try {
        const { messages, model, temperature, max_tokens, response_format } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Invalid messages format' });
        }

        // 1. Check user role and grade-based daily chatbot limits on the server
        const db = getFirestore();
        const isStudent = req.userRole === 'student';
        let dailyLimit = LIMIT_GRADES_6_10;
        let usageDocId = '';
        let todayStr = '';

        if (isStudent) {
            const userDoc = await db.collection('users').doc(req.uid).get();
            if (!userDoc.exists) {
                return res.status(403).json({ error: 'Student profile not found.' });
            }
            const userData = userDoc.data();
            dailyLimit = getDailyLimitForGrade(userData.class ?? userData.classNumber);

            todayStr = new Date().toDateString();
            const sanitizeDate = todayStr.replace(/[^a-zA-Z0-9_-]/g, '_');
            usageDocId = `${req.uid}_${sanitizeDate}`;

            const usageSnap = await db.collection('aiChatUsage').doc(usageDocId).get();
            const currentCount = usageSnap.exists() ? (usageSnap.data().count || 0) : 0;

            if (currentCount >= dailyLimit) {
                return res.status(429).json({ 
                    error: `Daily chat limit reached (${dailyLimit} messages). Resets tomorrow.` 
                });
            }
        }

        // 2. Input Safety Guardrail Filter
        const studentLastMsg = messages[messages.length - 1]?.content || '';
        const inputSafety = evaluateSafety(String(studentLastMsg));
        if (!inputSafety.safe) {
            return res.json({
                choices: [{
                    message: {
                        role: 'assistant',
                        content: inputSafety.message
                    }
                }],
                safetyFlagged: true,
                reason: inputSafety.reason,
                dailyMessageCount: isStudent ? (await db.collection('aiChatUsage').doc(usageDocId).get().then(s => s.exists() ? s.data().count : 0)) : 0
            });
        }

        // 3. System Prompt Hardening
        const childSystemPrompt = `You are Lernix, a helpful, encouraging, and safe educational AI chatbot assistant for school children (Class 1 to 12).
Strict Rules:
1. ONLY discuss educational, school, subject-matter, or learning-related topics. If the student asks about non-educational topics (e.g., gaming, movies, gossip, pop culture, adult content, romance, violence), gently redirect them back to their studies.
2. NEVER discuss self-harm, suicide, depression, abuse, violence, romance, dating, or adult content under any circumstances.
3. If the student mentions wanting to hurt themselves, feeling hopeless, or any mental health crisis:
   - Immediately output a standard, pre-defined crisis response: "I hear you, and you matter. Please know that you are not alone. I encourage you to speak to a trusted teacher, parent, or counselor who can help support you right now. If you are in India, you can also call iCall at 9152987821 (free and confidential)."
   - Do NOT try to counsel them or engage in deep dialogue about self-harm.
4. Keep answers clear, age-appropriate, and easy to understand for school students. Use simple language.`;

        let filteredMessages = messages.filter(msg => msg.role !== 'system');
        filteredMessages.unshift({
            role: 'system',
            content: childSystemPrompt
        });

        // If the caller pinned a specific model, respect that and skip the
        // fallback chain. Otherwise let the chain pick the best available.
        const { completion: chatCompletion } = await chatWithFallback(groqClients, {
            messages: filteredMessages,
            temperature: temperature ?? 0.7,
            max_tokens: max_tokens ?? 1024,
            ...(response_format ? { response_format } : {})
        }, model ? { chain: [model, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] } : undefined);

        // 4. Output Safety Guardrail Filter
        const rawContent = chatCompletion?.choices?.[0]?.message?.content || '';
        const outputSafety = evaluateSafety(String(rawContent));
        if (!outputSafety.safe) {
            return res.json({
                choices: [{
                    message: {
                        role: 'assistant',
                        content: outputSafety.message
                    }
                }],
                safetyFlagged: true,
                reason: outputSafety.reason,
                dailyMessageCount: isStudent ? (await db.collection('aiChatUsage').doc(usageDocId).get().then(s => s.exists() ? s.data().count : 0)) : 0
            });
        }

        // 5. Increment daily usage atomically on the server
        let finalCount = 0;
        if (isStudent && usageDocId) {
            const usageRef = db.collection('aiChatUsage').doc(usageDocId);
            await db.runTransaction(async (transaction) => {
                const docSnap = await transaction.get(usageRef);
                if (docSnap.exists()) {
                    finalCount = (docSnap.data().count || 0) + 1;
                    transaction.update(usageRef, {
                        count: finalCount,
                        lastUsed: Timestamp.now()
                    });
                } else {
                    finalCount = 1;
                    transaction.set(usageRef, {
                        userId: req.uid,
                        count: 1,
                        dateString: todayStr,
                        lastUsed: Timestamp.now()
                    });
                }
            });
        }

        const responseData = {
            ...chatCompletion,
            dailyMessageCount: finalCount
        };

        res.json(responseData);
    } catch (error) {
        console.error('AI Proxy Error (Groq):', error);
        const status = error.status || 500;
        res.status(status).json({ 
            error: error.message || 'AI request failed',
            type: error.type || 'ConnectionError',
            details: 'Ensure GROQ_API_KEY is correctly set on the server.'
        });
    }
});

// POST /api/ai/validate-text
router.post('/validate-text', verifyAuth, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Text content is required' });
        }

        const evaluationPrompt = `You are an educational content validator. Your task is to analyze the text extracted from an image and determine if it is study-related, academic, or subject-matter related (e.g. school textbooks, math problems, scientific theories, history, geography, languages, school assignments, or general educational context).
If it is a random grocery list, general messaging chat, advertisements, political rants, memes, or completely non-educational text, classify it as NOT study-related.

Text to evaluate:
"""${text.slice(0, 1000)}"""

Reply with ONLY a strict JSON object on a single line. The JSON must contain these keys:
- "isStudyRelated": boolean
- "reason": string (if not study-related, a brief explanation why, maximum 10 words)
`;

        const { completion } = await chatWithFallback(groqClients, {
            messages: [{ role: 'user', content: evaluationPrompt }],
            temperature: 0.1,
            max_tokens: 150,
            response_format: { type: 'json_object' }
        }, {
            chain: ['llama-3.1-8b-instant'] // Fast and cheap for classification tasks
        });

        const raw = completion.choices?.[0]?.message?.content || '';
        let parsed = null;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            const match = raw.match(/\{[\s\S]*\}/);
            parsed = match ? JSON.parse(match[0]) : null;
        }

        if (parsed && typeof parsed.isStudyRelated === 'boolean') {
            return res.json({
                isStudyRelated: parsed.isStudyRelated,
                reason: parsed.reason || ''
            });
        }

        // Default to true in case of parsing failures to avoid blocking valid queries
        return res.json({ isStudyRelated: true, reason: '' });
    } catch (error) {
        console.error('Validation error:', error);
        // Degrade gracefully — allow the user query to proceed if LLM fails
        return res.json({ isStudyRelated: true, reason: '' });
    }
});

export default router;
