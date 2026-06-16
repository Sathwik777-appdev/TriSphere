import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../styles/theme';
import { API_BASE_URL } from '../utils/apiBase';
import { registerPlugin, Capacitor } from '@capacitor/core';
import {
    speak as browserSpeak,
    stopSpeaking,
    isBrowserTTSAvailable,
    describeAvailableVoices,
} from '../utils/browserTTS';

let AppPermissions = null;
if (Capacitor.isNativePlatform()) {
    try {
        AppPermissions = registerPlugin('AppPermissions');
    } catch (e) {
        console.warn('AppPermissions plugin registration failed, using web fallback:', e);
    }
}

/**
 * ASTRA — voice-to-voice daily emotional check-in.
 *
 * Professional UI:
 *  • Cinematic gradient backdrop with drifting orbs
 *  • Animated avatar with state-driven halo (idle / listening / thinking / speaking)
 *  • Live audio level visualizer (during LISTENING)
 *  • Chat-bubble transcripts (alternating sides + role tags)
 *  • Question progress pill ("Question 2 of 3")
 *  • Privacy badge — never tell students their words leave the conversation
 *  • Google Sans typography to match the rest of the brand
 */

const todayKey = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const STATE = {
    INTRO: 'intro',
    READY: 'ready',         // Mic is OFF, waiting for the user to tap "Tap to talk".
    LISTENING: 'listening', // Mic is ON, capturing the student's voice.
    THINKING: 'thinking',
    SPEAKING: 'speaking',
    ENDED: 'ended',
    ERROR: 'error',
};

// Friendly labels for each phase — shown on the status pill.
const STATE_LABEL = {
    [STATE.INTRO]:     { text: 'Ready when you are', color: colors.accent.blue },
    [STATE.READY]:     { text: 'Tap mic to talk',    color: colors.accent.blue },
    [STATE.LISTENING]: { text: 'Listening…',         color: colors.accent.success },
    [STATE.THINKING]:  { text: 'Thinking…',          color: colors.accent.indigo },
    [STATE.SPEAKING]:  { text: 'Speaking…',          color: colors.accent.purple },
    [STATE.ENDED]:     { text: 'All done',           color: colors.accent.success },
    [STATE.ERROR]:     { text: 'Connection issue',   color: colors.accent.error },
};

export default function AstraCheckIn() {
    const { user, userData } = useAuth();
    const [open, setOpen] = useState(false);
    const [state, setState] = useState(STATE.INTRO);
    const [transcripts, setTranscripts] = useState([]);
    const [history, setHistory] = useState([]);
    const [error, setError] = useState('');
    const [turn, setTurn] = useState(1);
    const [activitySummary, setActivitySummary] = useState(null);

    const audioRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const streamRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const vadRafRef = useRef(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const transcriptRef = useRef(null);
    // SpeechRecognition handle — used for on-device transcription so we
    // never have to upload audio to the backend. Saves the round-trip,
    // works offline (in Chromium-based browsers), and dodges the missing
    // /api/astra-voice handler entirely.
    const recognitionRef = useRef(null);
    const finalTranscriptRef = useRef('');
    // Interim transcript — the engine's "best guess so far" before it
    // finalizes a chunk. Critical because tapping "Tap to send" can
    // stop the engine BEFORE it finalizes the current utterance, so
    // we have to fall back to the latest interim on stop() or the
    // student's words get dropped.
    const interimTranscriptRef = useRef('');
    // Live transcript bound to React state — rendered as a preview
    // pill while LISTENING so the student SEES their words appearing
    // in real time. Without this, mobile users have no on-screen
    // signal that recognition is even running.
    const [livePreview, setLivePreview] = useState('');
    // Info about which TTS voice will speak ASTRA's lines — shown as
    // a subtitle so the student can immediately see if they're on an
    // Indian-English voice or a fallback. Wrong-accent pronunciations
    // of Indian names are the #1 sign that the device doesn't have an
    // en-IN voice pack installed.
    const [voiceInfo, setVoiceInfo] = useState(null);

    const finalSummaryRef = useRef({
        emotion: 'neutral',
        severity: 'moderate',
        needsAttention: false,
        message: '',
    });

    // Camera States and Refs for Emotion Tracking
    const [useCamera, setUseCamera] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const videoStreamRef = useRef(null);
    const capturedFramesRef = useRef([]);
    const captureIntervalRef = useRef(null);

    const firstName = (userData?.username || user?.displayName || 'friend').split(' ')[0];

    const loadTelemetrySummary = async (uid) => {
        if (!uid) return;
        try {
            console.log('[ASTRA] Fetching 7-day student learning telemetry...');
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            // Parallel queries
            const [
                submissionsSnap,
                simSnap,
                quizSnap,
                activitySnap,
                storeDoc
            ] = await Promise.all([
                getDocs(query(collection(db, 'studentSubmissions'), where('studentId', '==', uid), limit(100))),
                getDocs(query(collection(db, 'simulationSubmissions'), where('studentId', '==', uid), limit(100))),
                getDocs(query(collection(db, 'quizResults'), where('studentId', '==', uid), limit(100))),
                getDocs(query(collection(db, 'studentActivity'), where('studentId', '==', uid), limit(100))),
                getDoc(doc(db, 'userStore', uid))
            ]);

            // Compile chatbot messages (7 daily doc reads)
            const chatCountPromises = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toDateString();
                const sanitizeDate = dateStr.replace(/[^a-zA-Z0-9_-]/g, '_');
                const docId = `${uid}_${sanitizeDate}`;
                chatCountPromises.push(getDoc(doc(db, 'aiChatUsage', docId)));
            }
            const chatSnaps = await Promise.all(chatCountPromises);
            let chatbotMessagesSent = 0;
            chatSnaps.forEach(snap => {
                if (snap.exists()) {
                    chatbotMessagesSent += snap.data().count || 0;
                }
            });

            // 1. Assignments
            const assignmentsCompletedList = [];
            submissionsSnap.docs.forEach(doc => {
                const data = doc.data();
                const submittedAt = new Date(data.submittedAt);
                if (submittedAt >= oneWeekAgo) {
                    assignmentsCompletedList.push(data.assignmentTitle || 'Untitled Assignment');
                }
            });
            const assignmentsCompletedCount = assignmentsCompletedList.length;

            // 2. Simulations
            const simulationsCompletedList = [];
            simSnap.docs.forEach(doc => {
                const data = doc.data();
                const submittedAt = data.submittedAt?.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt);
                if (submittedAt >= oneWeekAgo) {
                    simulationsCompletedList.push(data.assignmentTitle || 'Untitled Lab');
                }
            });
            const simulationsCompletedCount = simulationsCompletedList.length;

            // 3. Quizzes
            const quizzesTakenList = [];
            quizSnap.docs.forEach(doc => {
                const data = doc.data();
                const completedAtDate = data.completedAt?.toDate ? data.completedAt.toDate() : new Date(data.completedAt);
                if (completedAtDate >= oneWeekAgo && !data.malpractice) {
                    quizzesTakenList.push({
                        chapterName: data.chapterName || 'Untitled Quiz',
                        score: data.score || 0
                    });
                }
            });
            const quizzesTakenCount = quizzesTakenList.length;

            // 4. Notes read
            const notesReadList = [];
            activitySnap.docs.forEach(doc => {
                const data = doc.data();
                const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
                if (timestamp >= oneWeekAgo && (data.action === 'notes_read' || data.action === 'notes_ongoing_read')) {
                    if (data.subject && !notesReadList.includes(data.subject)) {
                        notesReadList.push(data.subject);
                    }
                }
            });

            // 5. User Store (XP / Avatar)
            let streak = userData?.stats?.streak || 0;
            let xpBalance = 0;
            let equippedAvatar = 'default';
            let inventoryCount = 0;
            if (storeDoc.exists()) {
                const data = storeDoc.data();
                xpBalance = data.xpBalance || 0;
                equippedAvatar = data.equippedItems?.avatar || 'default';
                inventoryCount = (data.ownedItems || []).length;
            }

            const summary = {
                streak,
                xpBalance,
                equippedAvatar,
                inventoryCount,
                assignmentsCompletedCount,
                assignmentsCompletedList,
                simulationsCompletedCount,
                simulationsCompletedList,
                quizzesTakenCount,
                quizzesTakenList,
                notesReadList,
                chatbotMessagesSent
            };

            console.log('[ASTRA] Compiled activity summary:', summary);
            setActivitySummary(summary);
        } catch (err) {
            console.error('[ASTRA] Error compiling learning activity summary:', err);
        }
    };

    // ── Auto-open once per day ──────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const decide = async () => {
            if (!user?.uid || userData?.role !== 'student') return;
            try {
                const id = `${user.uid}_${todayKey()}`;
                const snap = await getDoc(doc(db, 'studentMoods', id));
                if (!cancelled && !snap.exists()) setOpen(true);
            } catch (e) {
                console.warn('AstraCheckIn: mood doc check failed', e);
            }
        };
        decide();
        return () => { cancelled = true; };
    }, [user?.uid, userData?.role]);

    useEffect(() => {
        if (!open) return;
        if (user?.uid) {
            loadTelemetrySummary(user.uid);
        }
        if (!audioRef.current) audioRef.current = new Audio();
        // Resolve which TTS voice will be used so we can surface it
        // in the UI. Done on every modal open because the voice list
        // can change (e.g. user just installed a voice pack and
        // reopened the app).
        if (isBrowserTTSAvailable()) {
            describeAvailableVoices(true)
                .then(setVoiceInfo)
                .catch(() => setVoiceInfo(null));
        }
        return () => {
            try { audioRef.current?.pause(); } catch (e) {}
            if (audioRef.current) audioRef.current.src = '';
            // Also cancel any in-flight browser-TTS utterance so the
            // user doesn't keep hearing ASTRA after they close the
            // modal mid-reply.
            stopSpeaking();
            stopMicStream();
            stopCamera();
            setActivitySummary(null);
        };
    }, [open, user?.uid]);

    // External event so anyone can re-open the modal (e.g. the dashboard card).
    useEffect(() => {
        const handleOpen = () => setOpen(true);
        window.addEventListener('open-astra', handleOpen);
        return () => window.removeEventListener('open-astra', handleOpen);
    }, []);

    // Auto-scroll transcripts.
    useEffect(() => {
        if (transcriptRef.current) {
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
        }
    }, [transcripts]);

    const stopMicStream = () => {
        stopFrameCapture();
        // Stop the SpeechRecognition engine first so it releases its
        // internal mic before we tear down our visualization stream.
        try {
            if (recognitionRef.current) {
                recognitionRef.current.onend = null; // prevent re-entry
                recognitionRef.current.onresult = null;
                recognitionRef.current.onerror = null;
                recognitionRef.current.abort?.();
            }
        } catch (e) {}
        recognitionRef.current = null;
        try {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        } catch (e) {}
        try { streamRef.current?.getTracks?.().forEach(t => t.stop()); } catch (e) {}
        streamRef.current = null;
        mediaRecorderRef.current = null;
        if (vadRafRef.current) cancelAnimationFrame(vadRafRef.current);
        try { audioContextRef.current?.close?.(); } catch (e) {}
        audioContextRef.current = null;
        setAudioLevel(0);
    };

    const startCamera = async () => {
        try {
            console.log('[ASTRA] Starting camera for emotion tracking...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 320 },
                    height: { ideal: 240 }
                }
            });
            videoStreamRef.current = stream;
            setTimeout(() => {
                if (videoRef.current && videoStreamRef.current) {
                    videoRef.current.srcObject = videoStreamRef.current;
                    setCameraActive(true);
                    setCameraError(null);
                    console.log('[ASTRA] Camera streaming successfully');
                } else {
                    console.warn('[ASTRA] videoRef not ready yet');
                }
            }, 100);
        } catch (err) {
            console.error('[ASTRA] Camera access failed:', err);
            setCameraError('Camera access failed or blocked. Proceeding with voice only.');
            setCameraActive(false);
            setUseCamera(false);
        }
    };

    const stopCamera = () => {
        console.log('[ASTRA] Stopping camera...');
        try {
            if (videoStreamRef.current) {
                videoStreamRef.current.getTracks().forEach(track => track.stop());
                videoStreamRef.current = null;
            }
        } catch (e) {
            console.warn('[ASTRA] Error stopping camera tracks:', e);
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
    };

    const startFrameCapture = () => {
        capturedFramesRef.current = [];
        if (captureIntervalRef.current) {
            clearInterval(captureIntervalRef.current);
        }

        if (!cameraActive || !useCamera) {
            console.log('[ASTRA] Camera not active, skipping periodic capture');
            return;
        }

        console.log('[ASTRA] Starting periodic frame capture...');
        
        // Capture initial frame
        captureSingleFrame();

        // Capture every 1200ms
        captureIntervalRef.current = setInterval(() => {
            if (capturedFramesRef.current.length >= 15) {
                console.log('[ASTRA] Max frames (15) reached, stopping interval');
                if (captureIntervalRef.current) {
                    clearInterval(captureIntervalRef.current);
                    captureIntervalRef.current = null;
                }
                return;
            }
            captureSingleFrame();
        }, 1200);
    };

    const captureSingleFrame = () => {
        if (videoRef.current && canvasRef.current && cameraActive) {
            try {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                canvas.width = 160;
                canvas.height = 120;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const frame = canvas.toDataURL('image/jpeg', 0.4);
                capturedFramesRef.current.push(frame);
                console.log(`[ASTRA] Captured frame #${capturedFramesRef.current.length}`);
            } catch (e) {
                console.warn('[ASTRA] Failed to capture periodic frame:', e);
            }
        }
    };

    const stopFrameCapture = () => {
        if (captureIntervalRef.current) {
            console.log('[ASTRA] Stopping periodic frame capture');
            clearInterval(captureIntervalRef.current);
            captureIntervalRef.current = null;
        }
    };

    // ── VAD loop: drives audioLevel for the visualizer ──────────────────────
    const startVadLoop = (stream) => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioCtx();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            analyserRef.current = analyser;
            const data = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
                analyser.getByteFrequencyData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i++) sum += data[i];
                const avg = sum / data.length;
                setAudioLevel(avg);
                vadRafRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) {
            console.warn('VAD init failed', e);
        }
    };

    // Manual push-to-talk mic flow:
    //   • startListening()  — user tapped "Tap to talk" → mic ON,
    //                          recognition runs in continuous mode and
    //                          will only stop when the user taps the
    //                          mic button again.
    //   • stopListening()   — user tapped "Tap to send" → recognition
    //                          stops, the captured transcript flows
    //                          into sendToAstra() → ASTRA replies.
    //
    // We deliberately avoid `continuous: false` (which auto-ends on
    // silence) because students often pause mid-sentence to think and
    // we don't want ASTRA jumping in. The student decides when they're
    // done speaking.
    const startListening = async () => {
        if (state === STATE.THINKING || state === STATE.SPEAKING || state === STATE.LISTENING) return;

        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            setError('Voice input isn\'t supported on this browser. Please use Chrome.');
            setState(STATE.ERROR);
            return;
        }

        // IMPORTANT — do NOT call getUserMedia here.
        //
        // We used to acquire a parallel mic stream for the audio-level
        // visualizer, but on many Android Chromium builds holding a
        // getUserMedia stream prevents SpeechRecognition from capturing
        // audio at all — onresult never fires and the live preview
        // stays blank with no error surfaced. Letting SpeechRecognition
        // own the mic exclusively is the only reliable path. The orb
        // still animates with a time-based pulse via framer-motion, just
        // not audio-reactive.

        try {
            const recognition = new SR();
            recognition.lang = 'en-IN';
            recognition.continuous = true;        // keep listening through pauses
            recognition.interimResults = true;    // capture partials so we don't lose words
            recognition.maxAlternatives = 1;

            finalTranscriptRef.current = '';
            interimTranscriptRef.current = '';
            setLivePreview('');

            // Diagnostic events — give us a paper trail in the
            // console so we can tell whether the engine ever actually
            // started capturing audio. Especially useful on mobile
            // where DevTools isn't available without remote debug.
            recognition.onstart = () => {
                console.log('[ASTRA] recognition.start fired');
            };
            recognition.onaudiostart = () => {
                console.log('[ASTRA] mic stream live, capturing audio');
            };
            recognition.onspeechstart = () => {
                console.log('[ASTRA] speech detected');
            };
            recognition.onnomatch = () => {
                console.warn('[ASTRA] onnomatch — engine couldn\'t recognise anything');
            };

             recognition.onresult = (evt) => {
                 let finalTrans = '';
                 let interimTrans = '';
                 for (let i = 0; i < evt.results.length; i++) {
                     const text = evt.results[i][0].transcript;
                     if (evt.results[i].isFinal) {
                         finalTrans += (finalTrans ? ' ' : '') + text.trim();
                     } else {
                         interimTrans += (interimTrans ? ' ' : '') + text.trim();
                     }
                 }
                 finalTranscriptRef.current = finalTrans;
                 interimTranscriptRef.current = interimTrans;
                 setLivePreview((finalTrans + ' ' + interimTrans).trim());
             };

            recognition.onerror = (evt) => {
                const code = evt?.error || 'unknown';
                console.warn('[ASTRA] recognition error:', code);
                // "no-speech" can fire on long silent gaps with
                // `continuous: true` on some Chromium builds — swallow
                // it and let the user keep going.
                if (code === 'no-speech' || code === 'aborted') return;
                // Surface a specific message per error code so the
                // student knows what to fix. Most common on mobile:
                //   not-allowed / service-not-allowed → mic permission
                //   network                            → recognition
                //                                       service offline
                //   audio-capture                       → no mic hardware
                let msg;
                if (code === 'not-allowed' || code === 'service-not-allowed') {
                    msg = 'Microphone access is blocked. Open phone Settings → Apps → TriSphere → Permissions → Microphone, allow it, then come back.';
                } else if (code === 'network') {
                    msg = 'Speech recognition needs internet. Reconnect and try again.';
                } else if (code === 'audio-capture') {
                    msg = 'No microphone detected on this device.';
                } else if (code === 'language-not-supported') {
                    msg = 'Indian English voice input isn\'t available on this device.';
                } else {
                    msg = `Voice input failed (${code}). Tap retry to try again.`;
                }
                setError(msg);
                setState(STATE.ERROR);
            };

            recognition.onend = async () => {
                // onend fires either:
                //   (a) the user tapped Stop & Send  → process transcript
                //   (b) the browser killed the session unexpectedly →
                //       same handling, transcript may be empty
                //
                // Fall back to the interim buffer if no final chunks
                // were committed yet — happens often when stop() is
                // called mid-sentence, especially with `continuous:
                // true`. Without this fallback, students get a silent
                // "ASTRA didn't reply" experience.
                const finalText = (finalTranscriptRef.current || '').trim();
                const interimText = (interimTranscriptRef.current || '').trim();
                const text = finalText || interimText;
                console.log('[ASTRA] recognition end — final:', JSON.stringify(finalText), 'interim:', JSON.stringify(interimText));
                stopMicStream();
                if (!text) {
                    // Nothing captured — drop back to READY so the
                    // user can try again with a tap.
                    setState(STATE.READY);
                    return;
                }
                setState(STATE.THINKING);
                await sendToAstra(text);
            };

            recognition.start();
            recognitionRef.current = recognition;
            setState(STATE.LISTENING);
            startFrameCapture();
        } catch (err) {
            console.error('SpeechRecognition init failed', err);
            setError('Microphone access is needed for the voice check-in.');
            setState(STATE.ERROR);
        }
    };

    // User tapped the mic toggle while LISTENING → stop and send.
    const stopListening = () => {
        if (state !== STATE.LISTENING) return;
        try {
            recognitionRef.current?.stop?.();
        } catch (e) {
            // .stop() throws if already stopped — harmless.
        }
        // onend handler (above) takes it from here.
    };

    // Single button → calls the right one based on current state.
    const toggleMic = () => {
        if (state === STATE.LISTENING) stopListening();
        else if (state === STATE.READY) startListening();
    };

    // Back-compat alias for code paths that referenced the old name
    // (e.g. the retry button). They now just enter READY — the user
    // taps the mic to start.
    const beginAutoListen = () => setState(STATE.READY);

    // ── TTS playback ────────────────────────────────────────────────────────
    // Cloud-TTS round-trips were adding 2–4 seconds to every ASTRA reply.
    // We now use the device's built-in speech synthesis (free, ~100 ms
    // latency, works offline) and only fall back to the Cloud audio blob
    // if the browser engine refuses to speak — extremely rare on Chromium
    // (which is what your Play Store TWA runs on), more relevant on
    // ancient browsers we shouldn't optimize for.
    const playBase64Audio = (base64) => {
        return new Promise((resolve) => {
            if (!audioRef.current || !base64) return resolve();
            audioRef.current.src = `data:audio/wav;base64,${base64}`;
            audioRef.current.onended = resolve;
            audioRef.current.play().catch(resolve);
        });
    };

    const speakReply = async (text, fallbackBase64) => {
        setState(STATE.SPEAKING);
        if (isBrowserTTSAvailable()) {
            const result = await browserSpeak(text, {
                lang: 'en-IN',
                preferFemale: true,
                rate: 1.0,
            });
            // If browser TTS succeeds, we are done
            if (result.ok && result.reason !== 'timeout') return;
        }
        
        // Browser TTS unavailable, blocked, or timed out mid-flight
        try {
            if (!navigator.onLine) {
                console.warn('ASTRA: Offline, skipping Cloud TTS fallback fetch');
                return;
            }
            if (fallbackBase64) {
                await playBase64Audio(fallbackBase64);
                return;
            }
            
            // On-the-fly Cloud TTS fallback
            const res = await fetch(`${API_BASE_URL}/api/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, gender: 'female', userId: user?.uid || 'anonymous' }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.audio) await playBase64Audio(data.audio);
            }
        } catch (e) {
            console.warn('ASTRA: Cloud TTS fallback failed', e);
        }
    };

    const speakIntroGreeting = async () => {
        const intro = "Hii buddy, I'm ASTRA. Tell me — how are you really feeling today?";
        setTranscripts([{ role: 'astra', text: intro }]);
        
        // speakReply now handles both browser TTS and the Cloud fallback internally.
        await speakReply(intro, null);
        beginAutoListen();
    };

    const [audioUnlocked, setAudioUnlocked] = useState(false);
    const handleBegin = async () => {
        setError(null);
        setCameraError(null);

        // 1. Request Microphone permission natively if on Android/iOS
        let micGranted = false;
        if (Capacitor.isNativePlatform() && AppPermissions) {
            try {
                const res = await AppPermissions.requestPermission({ type: 'microphone' });
                micGranted = !!res.granted;
            } catch (err) {
                console.warn('Native microphone permission request failed:', err);
            }
        } else {
            // Web fallback check
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(t => t.stop());
                    micGranted = true;
                } catch (err) {
                    console.warn('Web microphone permission denied:', err);
                }
            } else {
                micGranted = true; // speech recognition fallback
            }
        }

        if (!micGranted) {
            setError("Without microphone access, this feature won't work. Please allow microphone permission and try again.");
            setState(STATE.ERROR);
            return;
        }

        // 2. Request Camera permission if useCamera toggle is active
        if (useCamera) {
            let cameraGranted = false;
            if (Capacitor.isNativePlatform() && AppPermissions) {
                try {
                    const res = await AppPermissions.requestPermission({ type: 'camera' });
                    cameraGranted = !!res.granted;
                } catch (err) {
                    console.warn('Native camera permission request failed:', err);
                }
            } else {
                // Web check
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                        stream.getTracks().forEach(t => t.stop());
                        cameraGranted = true;
                    } catch (err) {
                        console.warn('Web camera permission check failed:', err);
                    }
                }
            }

            if (cameraGranted) {
                startCamera();
            } else {
                setCameraError("Without camera access, visual emotion tracking won't work. Proceeding with voice only.");
                setUseCamera(false);
            }
        }

        setAudioUnlocked(true);
        // Synchronous unlock to bypass browser autoplay policies
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            const unlock = new SpeechSynthesisUtterance('');
            unlock.volume = 0;
            window.speechSynthesis.speak(unlock);
        }
        speakIntroGreeting();
    };

    /**
     * sendToAstra(transcript)
     *
     * Now takes a raw transcript string (from SpeechRecognition) and
     * hits the working `/api/ai/astra` text endpoint. The endpoint
     * returns `{ emotion, severity, needsAttention, message }` — no
     * server-side audio is produced, since we synthesize the reply
     * locally via browser TTS.
     */
    const sendToAstra = async (transcript) => {
        const text = String(transcript || '').trim();
        if (!text) {
            setState(STATE.READY);
            return;
        }

        // Ensure we have at least one frame if camera is active
        if (cameraActive && capturedFramesRef.current.length === 0) {
            captureSingleFrame();
        }

        const frames = [...capturedFramesRef.current];
        const cameraFrame = frames.length > 0 ? frames[frames.length - 1] : null;
        
        // Reset frame buffer for the next conversation turn
        capturedFramesRef.current = [];

        // 30-second hard timeout on the AI call so a slow / hung
        // Cloud Run instance never leaves the student staring at
        // "Thinking…" for minutes. AbortController fires `aborted`
        // which the catch branch picks up below.
        const abort = new AbortController();
        const timeoutId = setTimeout(() => abort.abort(), 30000);

        try {
            const token = user ? await user.getIdToken() : null;
            const res = await fetch(`${API_BASE_URL}/api/ai/astra`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    feeling: text,
                    studentName: firstName,
                    cameraFrame,
                    cameraFrames: frames,
                    activitySummary,
                }),
                signal: abort.signal,
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const baseReply = data?.message || "I'm here. Tell me more.";

            // ── Multi-turn glue ─────────────────────────────────────
            // Every ASTRA session is capped at exactly 3 questions —
            // turn 1 (intro) + 2 follow-ups + a closing on turn 3 —
            // regardless of whether the student's words triggered the
            // crisis flag. The crisis signal still gets persisted (see
            // persistMood) so admins and the linked parent are notified
            // out-of-band; we just don't drag the in-app conversation
            // longer because that can feel like ASTRA is interrogating
            // a student already in distress.
            const isCrisis = !!data.needsAttention;
            const maxTurns = 3;
            const FOLLOW_UPS = isCrisis
                ? [
                    'Tell me a little more about what brought this on.',
                    'Is there someone in your life you feel safe with right now?',
                  ]
                : [
                    'What\'s been weighing on you the most today?',
                    'Anything else you\'d like to share with me?',
                  ];
            const followUp = turn < maxTurns ? FOLLOW_UPS[turn - 1] : null;
            const reply = followUp ? `${baseReply} ${followUp}` : baseReply;

            setTranscripts((t) => [
                ...t,
                { role: 'student', text },
                { role: 'astra', text: reply },
            ]);
            setHistory((h) => [
                ...h,
                { role: 'user', content: text },
                { role: 'assistant', content: reply },
            ]);

            finalSummaryRef.current = {
                emotion: data.emotion || 'neutral',
                severity: data.severity || 'moderate',
                needsAttention: !!data.needsAttention,
                message: reply,
            };

            // Speak the reply (with the follow-up appended) via
            // browser TTS. No backend audio arrives any more — the
            // endpoint is text-only — so there's no fallback base64.
            await speakReply(reply, null);

            if (turn >= maxTurns) {
                setState(STATE.ENDED);
                await persistMood();
                window.dispatchEvent(new Event('astra-completed'));
                setTimeout(() => setOpen(false), 1800);
            } else {
                setTurn((n) => n + 1);
                // Drop back to READY so the student knows it's their
                // turn to talk. They tap the mic button to continue.
                setState(STATE.READY);
            }
        } catch (e) {
            console.error('ASTRA chat failed:', e);
            const isNetworkError = !navigator.onLine || e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError') || e.message?.includes('network');
            const isLimitError = e.message?.includes('limit') || e.message?.includes('too fast') || e.message?.includes('short break');
            
            if (isLimitError) {
                setError(e.message);
            } else if (isNetworkError) {
                setError('Network Connection Error: Please check your internet connection and try again.');
            } else {
                setError('ASTRA is currently busy. Please try again after a few minutes!');
            }
            setState(STATE.ERROR);
        }
    };

    const persistMood = async () => {
        try {
            const docId = `${user.uid}_${todayKey()}`;
            await setDoc(doc(db, 'studentMoods', docId), {
                userId: user.uid,
                studentName: userData?.username || firstName,
                date: todayKey(),
                modality: useCamera ? 'voice_camera' : 'voice',
                transcripts,
                emotion: finalSummaryRef.current.emotion,
                severity: finalSummaryRef.current.severity,
                needsAttention: finalSummaryRef.current.needsAttention,
                message: finalSummaryRef.current.message,
                createdAt: serverTimestamp(),
            });
        } catch (e) {
            console.error('[ASTRA] persistMood failed, could not save check-in state to Firestore:', e);
        }
    };

    // On any close — record that ASTRA was offered today so we don't reopen
    // on every refresh.
    const handleClose = async () => {
        stopCamera();
        stopFrameCapture();
        try {
            if (user?.uid) {
                const docId = `${user.uid}_${todayKey()}`;
                const existing = await getDoc(doc(db, 'studentMoods', docId));
                if (!existing.exists()) {
                    await setDoc(doc(db, 'studentMoods', docId), {
                        userId: user.uid,
                        studentName: userData?.username || firstName,
                        date: todayKey(),
                        modality: 'skipped',
                        emotion: 'unknown',
                        severity: 'low',
                        needsAttention: false,
                        createdAt: serverTimestamp(),
                        skipped: true
                    });
                }
            }
        } catch (e) {
            console.error('[ASTRA] Failed to record skipped state:', e);
        }
        setOpen(false);
    };

    if (!open) return null;

    const phase = STATE_LABEL[state] || STATE_LABEL[STATE.INTRO];
    const totalTurns = 3;
    const currentTurn = Math.min(turn, totalTurns);

    // Audio-level driven pulse scale (0..1 → 1.0..1.18)
    const pulseScale = 1 + Math.min(audioLevel / 600, 0.18);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={S.backdrop}
            >
                {/* Cinematic drifting orbs */}
                <div style={S.orbA} aria-hidden />
                <div style={S.orbB} aria-hidden />
                <div style={S.orbC} aria-hidden />

                <motion.div
                    initial={{ scale: 0.92, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.96, y: 10, opacity: 0 }}
                    transition={{ type: 'spring', damping: 22, stiffness: 220 }}
                    style={S.card}
                >
                    {/* Top bar */}
                    <div style={S.topBar}>
                        <div style={{ width: 32, height: 32, flexShrink: 0, visibility: 'hidden' }} />
                        <div style={S.brandRow}>
                            <span style={S.brandDot} />
                            <span style={S.brandTitle}>ASTRA</span>
                            <span style={S.brandSub}>Daily check-in</span>
                        </div>
                        <div role="button" tabIndex={0} onClick={handleClose} style={S.closeBtn} aria-label="Close">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M6 6l12 12M6 18L18 6" />
                            </svg>
                        </div>
                    </div>

                    {/* Stage area */}
                    <div style={S.stage}>
                        {/* Halo — rotates based on state, color shifts per phase */}
                        <motion.div
                            style={{
                                ...S.halo,
                                background: `conic-gradient(from 0deg, ${phase.color}66, transparent 35%, ${phase.color}66 70%, transparent)`,
                            }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                        />

                        {/* Audio-reactive ring (only while listening) */}
                        {state === STATE.LISTENING && (
                            <div
                                style={{
                                    ...S.audioRing,
                                    borderColor: `${phase.color}80`,
                                    transform: `scale(${pulseScale})`,
                                }}
                            />
                        )}

                        {/* Avatar - breathing */}
                        <motion.div
                            animate={{
                                y: [0, -8, 0],
                            }}
                            transition={{
                                duration: 4,
                                repeat: Infinity,
                                ease: 'easeInOut',
                            }}
                            style={{ ...S.avatarWrap, background: 'transparent', padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            {/* Rotating Outer Ring */}
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    borderRadius: '50%',
                                    background: 'conic-gradient(from 0deg, transparent 0%, #3b82f6 25%, #8b5cf6 50%, #f472b6 75%, transparent 100%)',
                                    zIndex: 0
                                }}
                            />
                            {/* The Crystal Image */}
                            <img src="/astra.png" alt="ASTRA" style={{ ...S.avatar, position: 'relative', zIndex: 1, border: 'none' }} />
                        </motion.div>

                        {/* Mirrored FaceTime Video bubble for emotion tracking */}
                        {cameraActive && (
                            <div style={S.selfieBubbleWrap}>
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    style={S.selfieVideo}
                                />
                                {/* Laser Scanning effect overlay */}
                                <div style={S.scanningOverlay}>
                                    <div style={S.scanningLine} />
                                    <span style={S.scanningText}>ANALYZING</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Status row */}
                    <div style={S.statusRow}>
                        <motion.span
                            key={state}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                ...S.statusPill,
                                color: phase.color,
                                borderColor: `${phase.color}55`,
                                background: `${phase.color}14`,
                            }}
                        >
                            <span style={{ ...S.statusDot, background: phase.color }} />
                            {phase.text}
                        </motion.span>

                        {audioUnlocked && state !== STATE.ENDED && state !== STATE.ERROR && (
                            <span style={S.turnPill}>Question {currentTurn} of {totalTurns}</span>
                        )}
                    </div>

                    {/* Voice hint — surfaced so the student knows what
                        accent they're hearing. If the device fell back
                        from en-IN, we show an amber tip that explains
                        how to fix the name-mispronunciation issue. */}
                    {voiceInfo?.selectedVoice && (
                        <div style={S.voiceHintRow}>
                            <span style={{
                                ...S.voiceHint,
                                ...(voiceInfo.hasEnIN
                                    ? S.voiceHintOk
                                    : S.voiceHintWarn),
                            }}>
                                {voiceInfo.hasEnIN
                                    ? `🎙 Voice: ${voiceInfo.selectedVoice.name} (${voiceInfo.selectedVoice.lang})`
                                    : `⚠️ No Indian-English voice installed. Names may sound off. To fix: Phone Settings → System → Languages & input → Speech → Text-to-speech → Install English (India).`}
                            </span>
                        </div>
                    )}

                    {/* Body */}
                    {!audioUnlocked ? (
                        <div style={S.introBody}>
                            <h2 style={S.introTitle}>
                                Hii buddy <span style={S.wave}>👋</span>
                            </h2>
                            <p style={S.introText}>
                                Take a quiet minute. I'll ask you three short questions about how
                                you're feeling today. No right answers — just talk to me.
                            </p>
                            <div style={S.privacyBadge}>
                                <span style={S.lockIcon}>🔒</span>
                                <div>
                                    <strong style={S.privacyTitle}>Just between us</strong>
                                    <p style={S.privacyText}>
                                        Whatever you share stays private. I'm only here to listen.
                                    </p>
                                </div>
                            </div>

                            {/* Selfie camera option for emotion tracking */}
                            <div style={S.cameraCard}>
                                <div style={S.cameraHeader}>
                                    <label style={S.cameraToggleLabel}>
                                        <input
                                            type="checkbox"
                                            checked={useCamera}
                                            onChange={(e) => setUseCamera(e.target.checked)}
                                            style={S.cameraCheckbox}
                                        />
                                        <span style={S.cameraToggleTitle}>📸 Enable selfie camera for emotion tracking</span>
                                    </label>
                                </div>
                                <p style={S.cameraText}>
                                    ASTRA will analyze your expression to understand your emotions better and customize support. Ephemeral processing: your images are never stored or shared.
                                </p>
                            </div>

                            {cameraError && (
                                <div style={S.errorBox}>
                                    <span>⚠️</span>
                                    <span>{cameraError}</span>
                                </div>
                            )}

                            <button onClick={handleBegin} style={S.beginBtn}>
                                <span style={S.beginDot} />
                                Start check-in
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Transcript */}
                            <div ref={transcriptRef} style={S.transcriptBox}>
                                {transcripts.map((line, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.25 }}
                                        style={{
                                            ...S.bubble,
                                            ...(line.role === 'astra' ? S.bubbleAstra : S.bubbleUser),
                                        }}
                                    >
                                        <span style={S.bubbleRole}>
                                            {line.role === 'astra' ? 'ASTRA' : 'You'}
                                        </span>
                                        <p style={S.bubbleText}>{line.text}</p>
                                    </motion.div>
                                ))}
                                {state === STATE.THINKING && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        style={{ ...S.bubble, ...S.bubbleAstra }}
                                    >
                                        <span style={S.bubbleRole}>ASTRA</span>
                                        <div style={S.thinkingDots}>
                                            <span style={S.dot} />
                                            <span style={{ ...S.dot, animationDelay: '0.15s' }} />
                                            <span style={{ ...S.dot, animationDelay: '0.3s' }} />
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Live transcript preview — visible only
                                while LISTENING. Gives the student a
                                real-time, on-screen signal that
                                recognition is receiving their voice.
                                Crucial on mobile where DevTools isn't
                                available to debug silent failures. */}
                            {state === STATE.LISTENING && (
                                <div style={S.livePreviewWrap}>
                                    <span style={S.livePreviewLabel}>You're saying</span>
                                    <p style={S.livePreviewText}>
                                        {livePreview
                                            ? livePreview
                                            : '…waiting for you to speak'}
                                    </p>
                                </div>
                            )}

                            {/* Mic toggle — push-to-talk. The student
                                taps once to start speaking, taps again to
                                send. Hidden while ASTRA is thinking or
                                speaking so the student can't interrupt
                                mid-reply. */}
                            {(state === STATE.READY || state === STATE.LISTENING) && (
                                <div style={S.micWrap}>
                                    <motion.button
                                        onClick={toggleMic}
                                        style={{
                                            ...S.micBtn,
                                            ...(state === STATE.LISTENING ? S.micBtnActive : S.micBtnIdle),
                                        }}
                                        animate={{
                                            scale: state === STATE.LISTENING ? [1, 1.06, 1] : 1,
                                            boxShadow: state === STATE.LISTENING
                                                ? [
                                                    '0 0 0 0 rgba(239,68,68,0.55)',
                                                    '0 0 0 14px rgba(239,68,68,0)',
                                                  ]
                                                : '0 10px 28px rgba(16,185,129,0.35)',
                                        }}
                                        transition={{
                                            duration: 1.4,
                                            repeat: state === STATE.LISTENING ? Infinity : 0,
                                            ease: 'easeInOut',
                                        }}
                                        whileTap={{ scale: 0.95 }}
                                        aria-label={
                                            state === STATE.LISTENING
                                                ? 'Stop and send your message'
                                                : 'Start talking to ASTRA'
                                        }
                                    >
                                        <span style={S.micGlyph}>
                                            {state === STATE.LISTENING ? '⏹' : '🎤'}
                                        </span>
                                        <span style={S.micLabel}>
                                            {state === STATE.LISTENING
                                                ? 'Tap to send'
                                                : 'Tap to talk'}
                                        </span>
                                    </motion.button>
                                    <p style={S.micHint}>
                                        {state === STATE.LISTENING
                                            ? 'Take your time. Tap when you\'re done.'
                                            : 'Tap the mic and tell ASTRA how you\'re feeling.'}
                                    </p>
                                </div>
                            )}

                            {state === STATE.ERROR && (
                                <div style={S.errorBox}>
                                    <span>⚠️</span>
                                    <span>{error || 'Something went wrong.'}</span>
                                    <button onClick={startListening} style={S.retryBtn}>Retry</button>
                                </div>
                            )}
                        </>
                    )}
                </motion.div>
            </motion.div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
        </AnimatePresence>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — brand-aligned (blue → indigo → purple, Google Sans, glass surfaces)
// ─────────────────────────────────────────────────────────────────────────────
const S = {
    backdrop: {
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: 'radial-gradient(ellipse at top, rgba(15,23,42,0.92) 0%, rgba(5,7,18,0.98) 60%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflow: 'hidden',
        fontFamily: '"Google Sans", "Product Sans", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    },
    // Drifting decorative orbs — pure visual depth.
    orbA: {
        position: 'absolute',
        top: '-160px',
        left: '-120px',
        width: '480px',
        height: '480px',
        background: 'radial-gradient(circle, rgba(59,130,246,0.25), transparent 70%)',
        filter: 'blur(60px)',
        animation: 'astraOrbDriftA 22s ease-in-out infinite',
        pointerEvents: 'none',
    },
    orbB: {
        position: 'absolute',
        bottom: '-180px',
        right: '-140px',
        width: '520px',
        height: '520px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.25), transparent 70%)',
        filter: 'blur(70px)',
        animation: 'astraOrbDriftB 26s ease-in-out infinite',
        pointerEvents: 'none',
    },
    orbC: {
        position: 'absolute',
        top: '40%',
        left: '50%',
        width: '320px',
        height: '320px',
        background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)',
        filter: 'blur(50px)',
        transform: 'translate(-50%, -50%)',
        animation: 'astraOrbPulse 6s ease-in-out infinite',
        pointerEvents: 'none',
    },

    // ── Card ──
    card: {
        position: 'relative',
        width: '100%',
        maxWidth: 440,
        maxHeight: '92vh',
        background:
            'linear-gradient(135deg, rgba(15,23,42,0.85), rgba(20,28,55,0.92))',
        border: '1px solid rgba(99,102,241,0.28)',
        borderRadius: 28,
        padding: '20px 22px 24px',
        color: '#f1f5f9',
        boxShadow:
            '0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(99,102,241,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },

    // ── Top bar ──
    topBar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        width: '100%',
    },
    brandRow: { display: 'flex', alignItems: 'center', gap: 10 },
    brandDot: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        boxShadow: '0 0 12px rgba(139,92,246,0.6)',
    },
    brandTitle: {
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: 3,
        color: '#fff',
    },
    brandSub: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.45)',
        marginLeft: 4,
        fontWeight: 500,
        letterSpacing: 0.4,
        whiteSpace: 'nowrap',
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: '#cbd5e1',
        width: 32,
        height: 32,
        flexShrink: 0,
        borderRadius: 10,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
    },

    // ── Stage (avatar + halos) ──
    stage: {
        position: 'relative',
        width: 130,
        height: 130,
        margin: '4px auto 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    halo: {
        position: 'absolute',
        inset: -12,
        borderRadius: '50%',
        filter: 'blur(14px)',
        opacity: 0.85,
        pointerEvents: 'none',
    },
    audioRing: {
        position: 'absolute',
        inset: -4,
        borderRadius: '50%',
        border: '2px solid',
        transition: 'transform 80ms ease-out',
        pointerEvents: 'none',
    },
    avatarWrap: {
        position: 'relative',
        width: 106,
        height: 106,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #3b82f6, #6366f1, #8b5cf6)',
        padding: 3,
        boxShadow: '0 0 40px rgba(99,102,241,0.4)',
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        objectFit: 'cover',
        border: '3px solid #0f172a',
        background: '#0f172a',
    },

    // ── Status row ──
    statusRow: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
        flexWrap: 'wrap',
    },
    statusPill: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.4,
        border: '1px solid',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        animation: 'astraPulse 1.4s ease-in-out infinite',
    },
    turnPill: {
        padding: '6px 12px',
        borderRadius: 99,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
        color: 'rgba(255,255,255,0.65)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.4,
    },

    // ── Intro body ──
    introBody: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '4px 4px 0',
        flex: 1,
        overflowY: 'auto',
    },
    introTitle: {
        fontSize: 20,
        fontWeight: 800,
        margin: 0,
        textAlign: 'center',
        letterSpacing: '-0.015em',
        color: '#fff',
    },
    wave: { display: 'inline-block', animation: 'astraWave 2.2s ease-in-out infinite' },
    introText: {
        margin: 0,
        textAlign: 'center',
        color: 'rgba(255,255,255,0.72)',
        fontSize: 13.5,
        lineHeight: 1.45,
        padding: '0 6px',
    },
    privacyBadge: {
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        padding: '8px 12px',
        borderRadius: 14,
        background: 'rgba(59,130,246,0.08)',
        border: '1px solid rgba(59,130,246,0.20)',
        marginTop: 4,
    },
    lockIcon: { fontSize: 16, lineHeight: 1, marginTop: 2 },
    privacyTitle: {
        fontSize: 12.5,
        fontWeight: 700,
        color: '#bfdbfe',
        display: 'block',
        marginBottom: 2,
    },
    privacyText: {
        margin: 0,
        fontSize: 11.5,
        color: 'rgba(255,255,255,0.6)',
        lineHeight: 1.45,
    },
    beginBtn: {
        marginTop: 6,
        padding: '10px 18px',
        border: 'none',
        borderRadius: 14,
        background: 'linear-gradient(135deg, #3b82f6, #6366f1, #8b5cf6)',
        backgroundSize: '200% 100%',
        color: '#fff',
        fontWeight: 700,
        fontSize: 14,
        letterSpacing: 0.3,
        cursor: 'pointer',
        boxShadow: '0 8px 28px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        transition: 'transform 0.15s ease, background-position 0.4s ease',
    },
    beginDot: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 0 10px rgba(255,255,255,0.8)',
    },
    skipBtn: {
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.45)',
        fontSize: 13,
        cursor: 'pointer',
        marginTop: 2,
        padding: 6,
    },

    // ── Transcript ──
    transcriptBox: {
        flex: 1,
        minHeight: 180,
        maxHeight: 260,
        overflowY: 'auto',
        padding: '4px 2px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        scrollbarWidth: 'thin',
    },
    bubble: {
        maxWidth: '88%',
        padding: '10px 14px',
        borderRadius: 16,
        fontSize: 13.5,
        lineHeight: 1.45,
    },
    bubbleAstra: {
        alignSelf: 'flex-start',
        background: 'rgba(99,102,241,0.16)',
        border: '1px solid rgba(99,102,241,0.30)',
        color: '#e0e7ff',
        borderBottomLeftRadius: 6,
    },
    bubbleUser: {
        alignSelf: 'flex-end',
        background: 'rgba(59,130,246,0.22)',
        border: '1px solid rgba(59,130,246,0.40)',
        color: '#dbeafe',
        borderBottomRightRadius: 6,
    },
    bubbleRole: {
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: 1.6,
        opacity: 0.7,
        textTransform: 'uppercase',
        display: 'block',
        marginBottom: 4,
    },
    bubbleText: { margin: 0, whiteSpace: 'pre-wrap' },
    thinkingDots: { display: 'inline-flex', gap: 5, padding: '4px 0' },
    dot: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: '#a5b4fc',
        display: 'inline-block',
        animation: 'astraDot 1.2s ease-in-out infinite',
    },

    // ── Error ──
    errorBox: {
        marginTop: 12,
        padding: '12px 14px',
        borderRadius: 12,
        background: 'rgba(239,68,68,0.10)',
        border: '1px solid rgba(239,68,68,0.30)',
        color: '#fecaca',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    retryBtn: {
        marginLeft: 'auto',
        background: 'rgba(239,68,68,0.20)',
        border: '1px solid rgba(239,68,68,0.40)',
        color: '#fecaca',
        padding: '6px 12px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
    },

    // ── Mic toggle (push-to-talk) ──────────────────────────────────────
    // Big pill button placed below the transcript so the student
    // always knows how to control the conversation. Two visual states:
    //   • Idle (READY)     — emerald, calm shadow, mic glyph
    //   • Active (LISTENING) — red, pulsing halo, stop glyph
    // The pulsing animation is driven by framer-motion (in the JSX).
    micWrap: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        marginTop: 16,
        marginBottom: 8,
    },
    micBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        minWidth: 220,
        padding: '14px 26px',
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        fontFamily: '"Google Sans", "Inter", sans-serif',
        fontSize: 15,
        fontWeight: 800,
        letterSpacing: 0.3,
        color: '#ffffff',
        transition: 'background 160ms ease',
    },
    micBtnIdle: {
        background: 'linear-gradient(135deg, #10b981, #059669)',
    },
    micBtnActive: {
        background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    },
    micGlyph: { fontSize: 22, lineHeight: 1 },
    micLabel: { fontSize: 14, fontWeight: 800, letterSpacing: 0.3 },
    micHint: {
        margin: 0,
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
    },

    // Live transcript preview — soft glass card with a small uppercase
    // label and the engine's interim text. Updates in real time as
    // the student speaks. Empty-state placeholder copy ("…waiting for
    // you to speak") gives an instant signal that the mic is on but
    // nothing has been captured yet — useful when debugging on a
    // phone with no DevTools.
    voiceHintRow: {
        display: 'flex',
        justifyContent: 'center',
        marginTop: 6,
        marginBottom: 4,
        padding: '0 14px',
    },
    voiceHint: {
        fontSize: 10.5,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 999,
        border: '1px solid',
        letterSpacing: 0.2,
        textAlign: 'center',
        lineHeight: 1.4,
        maxWidth: '100%',
    },
    voiceHintOk: {
        background: 'rgba(34, 197, 94, 0.08)',
        color: '#86efac',
        borderColor: 'rgba(34, 197, 94, 0.30)',
    },
    voiceHintWarn: {
        background: 'rgba(251, 191, 36, 0.08)',
        color: '#fcd34d',
        borderColor: 'rgba(251, 191, 36, 0.30)',
        fontSize: 10,
        lineHeight: 1.5,
    },
    livePreviewWrap: {
        marginTop: 14,
        padding: '12px 14px',
        background: 'rgba(99, 102, 241, 0.10)',
        border: '1px solid rgba(99, 102, 241, 0.28)',
        borderRadius: 12,
        textAlign: 'center',
    },
    livePreviewLabel: {
        display: 'block',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        color: '#a5b4fc',
        marginBottom: 4,
    },
    livePreviewText: {
        margin: 0,
        fontSize: 14,
        lineHeight: 1.5,
        color: '#e2e8f0',
        wordBreak: 'break-word',
    },
    cameraCard: {
        marginTop: 6,
        padding: '8px 12px',
        borderRadius: 14,
        background: 'rgba(99, 102, 241, 0.08)',
        border: '1px solid rgba(99, 102, 241, 0.20)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    cameraHeader: {
        display: 'flex',
        alignItems: 'center',
    },
    cameraToggleLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        width: '100%',
    },
    cameraCheckbox: {
        width: 16,
        height: 16,
        accentColor: '#8b5cf6',
        cursor: 'pointer',
    },
    cameraToggleTitle: {
        fontSize: 13,
        fontWeight: 700,
        color: '#e0e7ff',
    },
    cameraText: {
        margin: 0,
        fontSize: 11.5,
        color: 'rgba(255, 255, 255, 0.55)',
        lineHeight: 1.45,
    },
    selfieBubbleWrap: {
        position: 'absolute',
        bottom: -6,
        right: -6,
        width: 76,
        height: 76,
        borderRadius: '50%',
        border: '2px solid #8b5cf6',
        boxShadow: '0 8px 20px rgba(0,0,0,0.6), 0 0 15px rgba(139,92,246,0.4)',
        overflow: 'hidden',
        background: '#000',
        zIndex: 10,
    },
    selfieVideo: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: 'scaleX(-1)',
    },
    scanningOverlay: {
        position: 'absolute',
        inset: 0,
        background: 'rgba(139, 92, 246, 0.05)',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scanningLine: {
        position: 'absolute',
        left: 0,
        width: '100%',
        height: '1.5px',
        background: 'linear-gradient(90deg, transparent, #c084fc, transparent)',
        boxShadow: '0 0 6px #c084fc',
        animation: 'astraScanLine 2.5s linear infinite',
    },
    scanningText: {
        fontSize: 7,
        fontWeight: 900,
        letterSpacing: 0.6,
        color: '#c084fc',
        background: 'rgba(15,23,42,0.85)',
        padding: '1px 3px',
        borderRadius: 3,
        textTransform: 'uppercase',
        border: '0.5px solid rgba(139,92,246,0.2)',
        marginTop: 40,
    },
};

// Inject keyframes once (idempotent guard).
if (typeof document !== 'undefined' && !document.getElementById('astra-keyframes')) {
    const style = document.createElement('style');
    style.id = 'astra-keyframes';
    style.textContent = `
        @keyframes astraOrbDriftA {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(40px, 30px); }
        }
        @keyframes astraOrbDriftB {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(-30px, -40px); }
        }
        @keyframes astraOrbPulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
            50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.95; }
        }
        @keyframes astraPulse {
            0%, 100% { opacity: 0.55; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.4); }
        }
        @keyframes astraDot {
            0%, 100% { opacity: 0.3; transform: translateY(0); }
            30% { opacity: 1; transform: translateY(-3px); }
        }
        @keyframes astraWave {
            0%, 60%, 100% { transform: rotate(0); }
            10%, 30% { transform: rotate(14deg); }
            20% { transform: rotate(-8deg); }
        }
        @keyframes astraScanLine {
            0% { top: 0%; }
            50% { top: 100%; }
            100% { top: 0%; }
        }
    `;
    document.head.appendChild(style);
}
