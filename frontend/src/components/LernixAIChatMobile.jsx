import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { chatWithAI, extractTextFromImage } from '../services/aiService';
import { extractTextFromPDF } from '../services/pdfHelper';
import { saveChatSession, getChatSessions, getDailyChatUsage, incrementDailyChatUsage } from '../services/firestoreService';
import { useAuth } from '../hooks/useAuth';
import { safeLocalStorage } from '../utils/storage';
import { warningToast, successToast } from '../utils/toast';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Share } from '@capacitor/share';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { speak, stopSpeaking } from '../utils/browserTTS';
import 'katex/dist/katex.min.css';

let AppPermissions = null;
try {
  if (Capacitor.isNativePlatform()) {
    AppPermissions = registerPlugin('AppPermissions');
  }
} catch (e) {
  console.warn('AppPermissions plugin registration failed, using web fallback:', e);
}

const requestMicPermission = async () => {
  let micGranted = false;
  if (Capacitor.isNativePlatform() && AppPermissions) {
    try {
      const check = await AppPermissions.checkPermissions();
      if (check && check.microphone) {
        micGranted = true;
      } else {
        const res = await AppPermissions.requestPermission({ type: 'microphone' });
        micGranted = !!res.granted;
      }
    } catch (err) {
      console.warn('Native microphone permission request failed:', err);
    }
  } else {
    // Web fallback check
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        micGranted = true;
      } catch (err) {
        console.warn('Web microphone permission denied:', err);
      }
    } else {
      micGranted = true; // speech recognition fallback
    }
  }
  return micGranted;
};

/**
 * Lernix AI — Mobile chat interface.
 * Visual language modelled after ChatGPT mobile:
 *   - Pure dark canvas (#212121)
 *   - User messages = light gray pill bubble, right-aligned, no avatar
 *   - Assistant messages = FULL WIDTH, no bubble, monospace-clean typography
 *   - Action row (copy / 👍 / 👎 / regenerate) sits BELOW assistant turns
 *   - Auto-growing pill input fixed at the bottom
 *   - Welcome screen with suggestion chips when no conversation exists yet
 *   - Slide-in sidebar from the left for chat history
 */

// Daily limit configuration: Exactly matches the student's class number
const getDailyLimitForGrade = (rawGrade) => {
  const grade = parseInt(rawGrade, 10);
  if (Number.isNaN(grade)) return 5; // Default for unknown/guest
  // Max cap at 20 just in case, min 1
  return Math.max(1, Math.min(grade, 20));
};

const SUGGESTIONS = [
  { title: 'Explain a concept', body: 'Explain photosynthesis like I\'m 10' },
  { title: 'Solve a problem',   body: 'Solve: 2x² + 5x − 3 = 0' },
  { title: 'Quick summary',     body: 'Summarize chapter on Newton\'s laws' },
  { title: 'Quiz me',           body: 'Give me 5 quiz questions on cell biology' },
];

const isInitialMessage = (msgs) =>
  msgs.length === 1 && msgs[0].role === 'assistant';

export const LernixAIChatMobile = ({ onBack }) => {
  const { user, userData } = useAuth();
  const userId = userData?.uid || user?.uid || 'guest';

  // Per-user daily message cap derived from grade (class).
  const DAILY_LIMIT = useMemo(
    () => getDailyLimitForGrade(userData?.class ?? userData?.classNumber),
    [userData?.class, userData?.classNumber]
  );

  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! I'm Lernix AI. How can I help with your studies today?" },
  ]);
  const [currentSessionId, setCurrentSessionId] = useState(() => Date.now().toString());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [cloudSessions, setCloudSessions] = useState([]);
  const [dailyCount, setDailyCount] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(null);

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const docInputRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  // ── Mic visualisation refs ──
  // We open our own getUserMedia stream (independent of the SpeechRecognition
  // engine, which manages its own internal capture) so we can pipe it into a
  // WebAudio AnalyserNode and read live amplitude for the icon animation.
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const rafRef = useRef(0);

  // Attachment menu (opens when + is tapped) and mic dictation state.
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);
  // 0..1 normalised loudness — drives the mic icon's scale + glow each frame.
  const [micLevel, setMicLevel] = useState(0);

  // ── Cross-device sync ────────────────────────────────────────────────
  const fetchHistory = async () => {
    if (!userId || userId === 'guest') return;
    try {
      const sessions = await getChatSessions(userId);
      setCloudSessions(sessions);
      return sessions;
    } catch (err) {
      console.warn('Mobile cloud history fetch failed', err);
      return [];
    }
  };

  useEffect(() => {
    if (userId && userId !== 'guest') {
      fetchHistory().then(sessions => {
        if (sessions && sessions.length > 0) {
          const latest = sessions[0];
          const updatedAtMs = latest.updatedAt?.toMillis?.() || 0;
          const isRecent = (Date.now() - updatedAtMs) < 60 * 60 * 1000;
          if (isRecent && Array.isArray(latest.messages)) {
            setMessages(latest.messages);
            setCurrentSessionId(latest.sessionId);
          }
        }
      });
      // Fetch daily count from Firestore
      getDailyChatUsage(userId).then(count => {
        setDailyCount(count);
      });
    } else {
      setDailyCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, currentSessionId]);

  // Keep screen awake while studying/chatting
  useEffect(() => {
    const lockScreen = async () => {
      try { await KeepAwake.keepAwake(); } catch (e) {}
    };
    lockScreen();
    return () => {
      try { KeepAwake.allowSleep(); } catch (e) {}
    };
  }, []);

  useEffect(() => {
    if (showHistory) fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistory]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length > 1 && userId !== 'guest') {
      saveChatSession(userId, currentSessionId, messages);

      // Instantly update the local cloudSessions state so the hamburger menu list updates immediately
      const firstUserMsg = messages.find(m => m.role === 'user')?.content || 'New Chat';
      const title = firstUserMsg.substring(0, 40) + (firstUserMsg.length > 40 ? '...' : '');

      setCloudSessions(prev => {
        const sessionIndex = prev.findIndex(s => s.sessionId === currentSessionId);
        const updatedSession = {
          sessionId: currentSessionId,
          userId,
          title,
          messages,
          updatedAt: { toDate: () => new Date(), toMillis: () => Date.now() }, // mock timestamp for instant local rendering
        };
        let newSessions;
        if (sessionIndex >= 0) {
          newSessions = [...prev];
          newSessions[sessionIndex] = updatedSession;
        } else {
          newSessions = [updatedSession, ...prev];
        }
        return newSessions.sort((a, b) => {
          const timeA = a.updatedAt?.toMillis?.() || 0;
          const timeB = b.updatedAt?.toMillis?.() || 0;
          return timeB - timeA;
        });
      });
    }
  }, [messages, userId, currentSessionId]);



  // ── Auto-grow textarea ─────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const next = Math.min(ta.scrollHeight, 140); // cap at ~5 lines
    ta.style.height = `${next}px`;
  }, [input]);

  const processFile = async (file) => {
    setIsAnalysing(true);
    try {
      if (file.type.startsWith('image/')) {
        warningToast('Extracting text from image... 🔍');
        return await extractTextFromImage(file);
      } else if (file.type === 'application/pdf') {
        warningToast('Reading PDF (this may take a moment)... 📄');
        return await extractTextFromPDF(file);
      } else {
        // Text files
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }
    } catch (error) {
      console.error('File processing error:', error);
      throw error;
    } finally {
      setIsAnalysing(false);
    }
  };

  const sendMessage = async (text) => {
    const trimmed = (text ?? '').trim();
    if ((!trimmed && !selectedFile) || loading || isAnalysing) return;
    if (dailyCount >= DAILY_LIMIT) {
      warningToast(`Daily limit reached (${DAILY_LIMIT} messages). Resets tomorrow.`);
      return;
    }

    const currentInput = trimmed;
    const currentFile = selectedFile;

    // Process file attachment first if present
    let fileContent = '';
    if (currentFile) {
      try {
        fileContent = await processFile(currentFile);

        if (fileContent && fileContent.trim().length > 0) {
          const charCount = fileContent.trim().length;
          if (charCount > 500) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `⚠️ **PDF/Image Content Too Large**: The extracted content (${charCount} characters) exceeds the 500-character limit for this chat. Please upload a smaller section of notes.`
            }]);
            setSelectedFile(null); // Clear attachment since it's rejected
            return;
          }
        }
      } catch (err) {
        console.error('Attachment processing error:', err);
        // Show validation/processing error toast and abort
        warningToast(err.message || 'Could not process the attached file.');
        return;
      }
    }

    // Since validation succeeded, proceed with sending
    const uiMessage = currentFile ? `${currentInput}\n\n📎 [Attached: ${currentFile.name}]` : currentInput;
    const userMsg = { role: 'user', content: uiMessage };

    // Update message log immediately
    setMessages(prev => [...prev, userMsg]);
    
    // Increment both locally and in Firestore database immediately
    setDailyCount(prev => prev + 1);
    incrementDailyChatUsage(userId).catch(e => console.error('Failed to increment usage', e));

    setInput('');
    setSelectedFile(null);
    setLoading(true);

    try {
      let userContent = currentInput;
      if (currentFile && fileContent) {
        const safeContent = fileContent.substring(0, 500);
        userContent = `${currentInput}\n\n--- ATTACHED FILE CONTEXT ---\nFile: ${currentFile.name}\n\n${safeContent}\n\n[End of File]`;
      }

      const chatHistory = messages.map(m => ({ role: m.role, content: m.content }));
      chatHistory.push({ role: 'user', content: userContent });

      // Call chatbot API with 3-second delay for smoother UX (similar to desktop)
      const [responseObj] = await Promise.all([
        chatWithAI(chatHistory),
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);

      setMessages(prev => [...prev, { role: 'assistant', content: responseObj.content }]);
    } catch (err) {
      setDailyCount(prev => Math.max(0, prev - 1)); // Revert local count if response fails
      const isLimitError = err.message && (
        err.message.includes('limit') || 
        err.message.includes('too fast') || 
        err.message.includes('short break') ||
        err.message.includes('limit reached')
      );
      const isNetworkError = !navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('network');
      
      let errorMessage = '⚠️ Server Busy: Sorry for the inconvenience. Due to a high volume of students currently using the chatbot, our servers are temporarily busy. Please wait a moment and try again shortly.';
      if (isLimitError) {
        errorMessage = `⚠️ ${err.message}`;
      } else if (isNetworkError) {
        errorMessage = '⚠️ Network Connection Error: Please check your internet connection and try again.';
      }

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: errorMessage },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e) => {
    if (e) e.preventDefault();
    try {
      Haptics.impact({ style: ImpactStyle.Light });
      playBeep(1200, 30, 0.03); // Soft, satisfying "pop" sound
    } catch (err) {}
    sendMessage(input);
  };

  const handleNewChat = () => {
    setMessages([
      { role: 'assistant', content: "Hello again! I'm Lernix AI. Ready for a new study session?" },
    ]);
    setCurrentSessionId(Date.now().toString());
    setShowHistory(false);
  };

  const loadSession = (session) => {
    setMessages(session.messages);
    setCurrentSessionId(session.sessionId);
    setShowHistory(false);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB size limit
        warningToast('❌ File too large. Please upload a file smaller than 10MB.');
        return;
      }
      setSelectedFile(file);
      warningToast(`File selected: ${file.name}`);
    }
    e.target.value = '';
  };

  // ── Mic / speech-to-text ──
  // Tap once to start, tap again to stop.
  // On start we:
  //   1) play a short ascending beep (ChatGPT-style "ready" tone)
  //   2) request mic permission via getUserMedia
  //   3) pipe the stream into a WebAudio AnalyserNode so we can animate
  //      the mic icon proportional to your speaking volume
  //   4) hand the mic to SpeechRecognition for transcription
  // On stop we play a short descending beep, kill the analyser RAF loop,
  // close the AudioContext and release the mic tracks.
  const playBeep = (frequency, durationMs = 90, gain = 0.06) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      g.gain.value = gain;
      osc.connect(g);
      g.connect(ctx.destination);
      const now = ctx.currentTime;
      // Tiny attack/release so it doesn't click.
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain, now + 0.01);
      g.gain.linearRampToValueAtTime(0, now + durationMs / 1000);
      osc.start(now);
      osc.stop(now + durationMs / 1000 + 0.02);
      // Auto-close so we don't leak AudioContexts.
      osc.onended = () => { try { ctx.close(); } catch (e) {} };
    } catch (e) { /* sound is non-essential — never block the mic */ }
  };

  const stopMicAnalyser = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    setMicLevel(0);
  };

  const startMicAnalyser = () => {
    let active = true;
    const tick = () => {
      if (!active) return;
      // Generate simulated organic voice wave fluctuation between 0.15 and 0.45
      const time = Date.now() / 150;
      const wave = Math.abs(Math.sin(time) * 0.2 + Math.cos(time * 0.7) * 0.1) + 0.15;
      setMicLevel(wave);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const toggleMic = async () => {
    // ── STOP ──
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch (e) {}
      return;
    }

    // ── START ──
    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      warningToast('Microphone access is blocked. Please allow microphone permission in settings.');
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      warningToast('Voice input not supported on this browser.');
      return;
    }
    playBeep(880, 90);
    try {
      const r = new SR();
      r.lang = 'en-IN';
      r.continuous = true;
      r.interimResults = true;
      let finalText = '';
      
      r.onstart = () => {
        console.log('[LernixChatMobile] Speech recognition started');
      };
      r.onresult = (event) => {
        console.log('[LernixChatMobile] Speech recognition result received');
        let finalTrans = '';
        let interimTrans = '';
        for (let i = 0; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTrans += (finalTrans ? ' ' : '') + text.trim();
          } else {
            interimTrans += (interimTrans ? ' ' : '') + text.trim();
          }
        }
        const live = (finalTrans + ' ' + interimTrans).trim();
        setInput(live);
      };
      r.onerror = (e) => {
        const code = e?.error || 'unknown';
        console.error('[LernixChatMobile] Speech recognition error:', code);
        if (code === 'no-speech' || code === 'aborted') return;
        
        let msg = 'Voice input failed.';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          msg = 'Microphone access is blocked. Please allow mic permission in settings.';
        } else if (code === 'network') {
          msg = 'Speech recognition needs internet access.';
        } else if (code === 'audio-capture') {
          msg = 'No microphone detected.';
        }
        warningToast(msg);
        stopMicAnalyser();
        setIsListening(false);
      };
      r.onend = () => {
        console.log('[LernixChatMobile] Speech recognition ended');
        stopMicAnalyser();
        playBeep(440, 100);
        setIsListening(false);
      };
      r.start();
      recognitionRef.current = r;
      setIsListening(true);
      // Kick off the live amplitude analyser. Independent of SR — purely
      // for the visual animation. Errors are non-fatal.
      startMicAnalyser();
    } catch (err) {
      console.error('[LernixChatMobile] Could not start speech recognition:', err);
      warningToast('Could not start voice input.');
      stopMicAnalyser();
      setIsListening(false);
    }
  };

  // Clean up speech and the analyser if the component unmounts.
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch (e) {}
      stopMicAnalyser();
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSpeak = async (text, messageIndex) => {
    if (!text) return;

    if (speakingIndex === messageIndex && speaking) {
      await stopSpeaking();
      setSpeaking(false);
      setSpeakingIndex(null);
      return;
    }

    // Stop current speech if any
    await stopSpeaking();
    setSpeaking(true);
    setSpeakingIndex(messageIndex);

    // Clean text from HTML tags and markdown
    const cleanText = text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\*\*/g, '') // Remove bold markers
      .replace(/\*/g, '') // Remove italic markers
      .replace(/`/g, '') // Remove code markers
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/\n\n/g, '. ') // Replace double line breaks with periods
      .replace(/\n/g, ' '); // Replace single line breaks with spaces

    try {
      await speak(cleanText, {
        rate: 0.9,
        preferFemale: true,
        lang: 'en-IN'
      });
      setSpeaking(false);
      setSpeakingIndex(null);
    } catch (e) {
      console.error('Lernix AI mobile speech error:', e);
      setSpeaking(false);
      setSpeakingIndex(null);
    }
  };

  // ── Attachment menu actions ──
  const openCamera   = () => { setShowAttachMenu(false); cameraInputRef.current?.click(); };
  const openGallery  = () => { setShowAttachMenu(false); fileInputRef.current?.click(); };
  const openDocument = () => { setShowAttachMenu(false); docInputRef.current?.click(); };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    successToast('Copied');
  };

  const shareText = async (text) => {
    try {
      await Share.share({
        title: 'Lernix AI',
        text: text,
        dialogTitle: 'Share this response'
      });
    } catch (e) {
      console.warn('Share error', e);
    }
  };

  const regenerateLast = async () => {
    // Strip the last assistant message and resend the last user message.
    const lastUserIdx = messages.findLastIndex
      ? messages.findLastIndex(m => m.role === 'user')
      : (() => {
          let i = messages.length - 1;
          while (i >= 0 && messages[i].role !== 'user') i--;
          return i;
        })();
    if (lastUserIdx < 0) return;
    const trimmed = messages.slice(0, lastUserIdx + 1);
    setMessages(trimmed);
    setLoading(true);
    try {
      const response = await chatWithAI(trimmed.map(m => ({ role: m.role, content: m.content })));
      setMessages(prev => [...prev, { role: 'assistant', content: response.content || response }]);
    } catch (err) {
      const isLimitError = err.message && (
        err.message.includes('limit') || 
        err.message.includes('too fast') || 
        err.message.includes('short break') ||
        err.message.includes('limit reached')
      );
      const isNetworkError = !navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('network');
      
      let errorMessage = '⚠️ Server Busy: Sorry for the inconvenience. Due to a high volume of students currently using the chatbot, our servers are temporarily busy. Please wait a moment and try again shortly.';
      if (isLimitError) {
        errorMessage = `⚠️ ${err.message}`;
      } else if (isNetworkError) {
        errorMessage = '⚠️ Network Connection Error: Please check your internet connection and try again.';
      }
      setMessages(prev => [...prev, { role: 'assistant', content: errorMessage }]);
    } finally {
      setLoading(false);
    }
  };

  const showWelcome = isInitialMessage(messages) && !isAnalysing;
  const sendDisabled = (!input.trim() && !selectedFile) || loading || isAnalysing;

  return (
    <div className="lernix-mobile" style={S.container}>
      {/* ─────────────── SIDEBAR ─────────────── */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              style={S.scrim}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              style={S.sidebar}
            >
              <div style={S.sidebarHeaderContainer}>
                <div style={S.sidebarHead}>
                  <button onClick={() => setShowHistory(false)} style={S.iconBtn} aria-label="Close">
                    <IconX />
                  </button>
                  <button onClick={handleNewChat} style={S.iconBtn} aria-label="New chat">
                    <IconEdit />
                  </button>
                </div>

                <button onClick={handleNewChat} className="lernix-new-chat" style={S.newChatRow}>
                  <IconEdit />
                  <span>New chat</span>
                </button>

                <div style={S.sectionLabel}>Recent</div>
              </div>

              <div style={S.historyList}>
                {cloudSessions.length === 0 && (
                  <div style={S.emptyHistory}>No chats yet — say hi to get started.</div>
                )}
                {cloudSessions.map((session, idx) => {
                  const isActive = session.sessionId === currentSessionId;
                  return (
                    <button
                      key={session.sessionId || idx}
                      className={`lernix-history${isActive ? ' is-active' : ''}`}
                      onClick={() => loadSession(session)}
                      style={{
                        ...S.historyItem,
                        background: isActive ? '#2f2f2f' : 'transparent',
                      }}
                    >
                      <span style={S.historyTitle}>{session.title || 'Previous chat'}</span>
                      <span style={S.historyDate}>
                        {session.updatedAt?.toDate?.().toLocaleDateString([], {
                          month: 'short', day: 'numeric',
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div style={S.sidebarFooter}>
                <div style={S.sidebarUser}>
                  <div style={S.userBadge}>{(userData?.username || 'S')[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.userName}>{userData?.username || 'Student'}</div>
                    <div style={S.userMeta}>{dailyCount}/{DAILY_LIMIT} today</div>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ─────────────── HEADER ─────────────── */}
      {/* Hamburger pinned to the left edge, title centered, no pen button.
          "New chat" lives inside the sidebar that the hamburger opens. */}
      <header style={S.header}>
        <button
          onClick={() => setShowHistory(true)}
          className="lernix-iconbtn"
          style={S.iconBtn}
          aria-label="History"
        >
          <IconMenu />
        </button>
        <div style={S.headerTitleBlock}>
          <div style={S.headerTitle}>Lernix AI</div>
          <div style={S.headerSubtitle}>Powered by Yugnext-AI Solutions</div>
        </div>
        {onBack ? (
          <button
            onClick={onBack}
            className="lernix-iconbtn"
            style={{
              position: 'absolute',
              top: '50%',
              right: '12px',
              transform: 'translateY(-50%)',
              background: '#ef4444',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '6px 14px',
              width: 'auto',
              height: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '13px',
              fontWeight: 'bold',
              border: 'none',
              zIndex: 10,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back
          </button>
        ) : (
          <div style={S.headerSpacer} aria-hidden />
        )}
      </header>

      {/* ─────────────── BODY ─────────────── */}
      <div style={S.body}>
        {showWelcome ? (
          <WelcomeScreen onPick={(text) => sendMessage(text)} firstName={(userData?.username || 'there').split(' ')[0]} />
        ) : (
          <div style={S.thread}>
            {messages.map((msg, i) => (
               <MessageRow
                key={i}
                role={msg.role}
                content={msg.content}
                isLastAssistant={i === messages.length - 1 && msg.role === 'assistant' && i > 0}
                onCopy={() => copyToClipboard(msg.content)}
                onShare={() => shareText(msg.content)}
                onRegenerate={regenerateLast}
                onSpeak={() => handleSpeak(msg.content, i)}
                isSpeaking={speakingIndex === i && speaking}
              />
            ))}
            {isAnalysing && (
              <div style={S.thinkingRow}>
                <div style={S.aiDot} />
                <span style={{ color: '#a78bfa', fontSize: '13px', marginLeft: '6px', marginRight: '6px' }}>
                  Analysing attachment...
                </span>
                <Thinking />
              </div>
            )}
            {loading && (
              <div style={S.thinkingRow}>
                <div style={S.aiDot} />
                <Thinking />
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* ─────────────── INPUT ─────────────── */}
      <div style={S.inputDock}>
        {/* Selected File Preview */}
        {selectedFile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#2f2f2f',
            padding: '6px 12px',
            borderRadius: '16px',
            marginBottom: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            alignSelf: 'flex-start',
            width: 'fit-content',
            maxWidth: '100%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            <span style={{
              color: '#fff',
              fontSize: '13px',
              fontWeight: '500',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '180px'
            }}>
              {selectedFile.name}
            </span>
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              disabled={loading || isAnalysing}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                cursor: (loading || isAnalysing) ? 'not-allowed' : 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '4px'
              }}
              aria-label="Remove attachment"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        <form onSubmit={handleSend} style={S.inputPill}>
          {/* + button — opens an attachment menu (camera / gallery / file) */}
          <button
            type="button"
            className="lernix-pill"
            onClick={() => setShowAttachMenu(true)}
            disabled={loading || isAnalysing}
            style={{
              ...S.plusBtn,
              opacity: (loading || isAnalysing) ? 0.5 : 1,
              cursor: (loading || isAnalysing) ? 'not-allowed' : 'pointer'
            }}
            aria-label="Attach"
          >
            <IconPlus />
          </button>

          {/* Hidden inputs the attachment menu triggers */}
          <input
            type="file" ref={cameraInputRef}
            onChange={handleFile}
            style={{ display: 'none' }}
            accept="image/*" capture="environment"
          />
          <input
            type="file" ref={fileInputRef}
            onChange={handleFile}
            style={{ display: 'none' }}
            accept="image/*"
          />
          <input
            type="file" ref={docInputRef}
            onChange={handleFile}
            style={{ display: 'none' }}
            accept=".pdf,.txt,.doc,.docx,image/*"
          />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || isAnalysing}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask anything"
            enterKeyHint="send"
            rows={1}
            style={{
              ...S.textarea,
              cursor: (loading || isAnalysing) ? 'not-allowed' : 'text'
            }}
          />

          {/* Mic button — speech-to-text with live amplitude ring.
              The outer ring glows + scales proportional to your voice
              volume (micLevel 0..1 from the WebAudio analyser). Icon
              itself stays steady so the tap target doesn't move. */}
          <button
            type="button"
            className="lernix-pill"
            onClick={toggleMic}
            disabled={loading || isAnalysing}
            style={{
              ...S.micBtn,
              position: 'relative',
              background: isListening ? '#ef4444' : 'transparent',
              color: isListening ? '#fff' : 'rgba(255,255,255,0.78)',
              transition: 'background 0.18s ease, color 0.18s ease',
              cursor: (loading || isAnalysing) ? 'not-allowed' : 'pointer',
              opacity: (loading || isAnalysing) ? 0.5 : 1
            }}
            aria-label={isListening ? 'Stop dictation' : 'Voice input'}
          >
            {/* Amplitude ring — only when listening. Scales from 1.0 to
                ~1.9 as the analyser reports louder input. */}
            {isListening && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  transform: `scale(${1 + micLevel * 0.9})`,
                  background:
                    'radial-gradient(circle, rgba(239,68,68,0.55) 0%, rgba(239,68,68,0) 70%)',
                  opacity: 0.55 + micLevel * 0.45,
                  transition: 'transform 80ms linear, opacity 80ms linear',
                }}
              />
            )}
            <span
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: isListening ? `scale(${1 + micLevel * 0.25})` : 'none',
                transition: 'transform 80ms linear',
              }}
            >
              <IconMic />
            </span>
          </button>

          <button
            type={sendDisabled ? 'button' : 'submit'}
            className={sendDisabled ? 'lernix-send-idle' : 'lernix-send-active'}
            disabled={sendDisabled}
            style={{
              ...S.sendBtn,
              background: sendDisabled ? '#3a3a3a' : '#ffffff',
              color: sendDisabled ? '#7a7a7a' : '#000000',
              cursor: sendDisabled ? 'not-allowed' : 'pointer',
            }}
            aria-label={loading ? 'Stop' : 'Send'}
          >
            {loading ? <IconStop /> : <IconArrowUp />}
          </button>
        </form>
        <p style={S.disclaimer}>
          Lernix AI can make mistakes. Check important info.
        </p>
      </div>

      {/* ── Attachment menu (bottom sheet) ─────────────────────────────── */}
      <AnimatePresence>
        {showAttachMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setShowAttachMenu(false)}
            style={S.attachBackdrop}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              style={S.attachSheet}
            >
              <div style={S.attachGrabber} />
              <AttachOption
                icon={<IconCamera />}
                label="Take photo"
                desc="Use your camera"
                onClick={openCamera}
              />
              <AttachOption
                icon={<IconImage />}
                label="Photo library"
                desc="Pick from your gallery"
                onClick={openGallery}
              />
              <AttachOption
                icon={<IconFile />}
                label="Upload file"
                desc="PDF, doc, image"
                onClick={openDocument}
              />
              <button
                onClick={() => setShowAttachMenu(false)}
                className="lernix-attach-cancel"
                style={S.attachCancel}
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Welcome screen — shown when no conversation exists yet
// ─────────────────────────────────────────────────────────────────────────────
const WelcomeScreen = ({ onPick, firstName }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    style={S.welcome}
  >
    <div style={S.welcomeBadge}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id="lernix-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#67e8f9" />
          </linearGradient>
        </defs>
        <path
          d="M12 2L9.4 8.6L2 9.3L7.5 14.1L5.8 21.4L12 17.7L18.2 21.4L16.5 14.1L22 9.3L14.6 8.6L12 2Z"
          fill="url(#lernix-grad)"
          stroke="url(#lernix-grad)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    </div>
    <h2 style={S.welcomeTitle}>How can I help, {firstName}?</h2>
    <div style={S.suggestionGrid}>
      {SUGGESTIONS.map(s => (
        <button
          key={s.title}
          className="lernix-suggest"
          onClick={() => onPick(s.body)}
          style={S.suggestionCard}
        >
          <span style={S.suggestionTitle}>{s.title}</span>
          <span style={S.suggestionBody}>{s.body}</span>
        </button>
      ))}
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Message row — user (bubble) vs assistant (full width, action icons below)
// ─────────────────────────────────────────────────────────────────────────────
const MessageRow = ({ role, content, isLastAssistant, onCopy, onShare, onRegenerate, onSpeak, isSpeaking }) => {
  const [liked, setLiked] = useState(null); // null | 'up' | 'down'

  if (role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        style={S.userRow}
      >
        <div style={S.userBubble}>{content}</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      style={S.assistantRow}
    >
      <div style={S.assistantHead}>
        <div style={S.aiDot} />
        <span style={S.assistantLabel}>Lernix AI</span>
      </div>
      <div style={S.assistantBody} className="selectable-text">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            p:  ({ children }) => <p style={S.mdP}>{children}</p>,
            h1: ({ children }) => <h1 style={S.mdH1}>{children}</h1>,
            h2: ({ children }) => <h2 style={S.mdH2}>{children}</h2>,
            h3: ({ children }) => <h3 style={S.mdH3}>{children}</h3>,
            ul: ({ children }) => <ul style={S.mdList}>{children}</ul>,
            ol: ({ children }) => <ol style={S.mdList}>{children}</ol>,
            li: ({ children }) => <li style={S.mdLi}>{children}</li>,
            code: ({ inline, children }) =>
              inline
                ? <code style={S.mdInlineCode}>{children}</code>
                : <pre style={S.mdPre}><code style={S.mdBlockCode}>{children}</code></pre>,
            a: ({ children, href }) => (
              <a href={href} target="_blank" rel="noreferrer" style={S.mdLink}>
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      <div style={S.actionRow}>
        <button
          className="lernix-action"
          onClick={onSpeak}
          style={{ ...S.actionBtn, color: isSpeaking ? '#a78bfa' : 'rgba(255,255,255,0.5)' }}
          aria-label={isSpeaking ? 'Stop speaking' : 'Listen to response'}
        >
          {isSpeaking ? <IconVolumeMute /> : <IconVolume />}
        </button>
        <button className="lernix-action" onClick={onCopy} style={S.actionBtn} aria-label="Copy">
          <IconCopy />
        </button>
        <button className="lernix-action" onClick={onShare} style={S.actionBtn} aria-label="Share">
          <IconShare />
        </button>
        <button
          className="lernix-action"
          onClick={() => setLiked(liked === 'up' ? null : 'up')}
          style={{ ...S.actionBtn, color: liked === 'up' ? '#fff' : 'rgba(255,255,255,0.5)' }}
          aria-label="Good response"
        >
          <IconThumbUp />
        </button>
        <button
          className="lernix-action"
          onClick={() => setLiked(liked === 'down' ? null : 'down')}
          style={{ ...S.actionBtn, color: liked === 'down' ? '#fff' : 'rgba(255,255,255,0.5)' }}
          aria-label="Bad response"
        >
          <IconThumbDown />
        </button>
        {isLastAssistant && (
          <button className="lernix-action" onClick={onRegenerate} style={S.actionBtn} aria-label="Regenerate">
            <IconRefresh />
          </button>
        )}
      </div>
    </motion.div>
  );
};

// Three-dot pulsing "thinking" indicator (ChatGPT-style)
const Thinking = () => (
  <div style={S.thinkingDots}>
    <span style={{ ...S.thinkingDot, animationDelay: '0ms' }} />
    <span style={{ ...S.thinkingDot, animationDelay: '160ms' }} />
    <span style={{ ...S.thinkingDot, animationDelay: '320ms' }} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SVG icons — line style, 20px, ChatGPT-like
// ─────────────────────────────────────────────────────────────────────────────
const IconMenu = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="6"  x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const IconEdit = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
  </svg>
);
const IconX = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M6 6l12 12M6 18L18 6" />
  </svg>
);
const IconPlus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconArrowUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);
const IconStop = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
const IconVolume = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);
const IconVolumeMute = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);
const IconCopy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const IconShare = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);
const IconThumbUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9A2 2 0 0 0 19.66 9z" />
    <line x1="7" y1="22" x2="7" y2="11" />
  </svg>
);
const IconThumbDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9A2 2 0 0 0 4.34 15z" />
    <line x1="17" y1="2" x2="17" y2="13" />
  </svg>
);
const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const IconMic = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8"  y1="23" x2="16" y2="23" />
  </svg>
);
const IconCamera = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);
const IconImage = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
const IconFile = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

// ── Attachment menu row ──
const AttachOption = ({ icon, label, desc, onClick }) => (
  <button
    onClick={onClick}
    className="lernix-attach-row"
    style={attachRowStyle}
  >
    <div style={attachIconStyle}>{icon}</div>
    <div style={{ flex: 1, textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
      <span style={attachLabelStyle}>{label}</span>
      <span style={attachDescStyle}>{desc}</span>
    </div>
  </button>
);

const attachRowStyle = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14,
  padding: '14px 14px',
  gap: 14,
  marginBottom: 8,
  cursor: 'pointer',
  color: '#f1f5f9',
  fontFamily: '"Inter","SF Pro Text",sans-serif',
  textAlign: 'left',
  appearance: 'none',
  WebkitAppearance: 'none',
};
const attachIconStyle = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: 'rgba(255,255,255,0.06)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  flexShrink: 0,
};
const attachLabelStyle = {
  display: 'block',
  fontSize: 14,
  fontWeight: 700,
  color: '#fff',
  lineHeight: 1.2,
  marginBottom: 2,
};
const attachDescStyle = {
  display: 'block',
  fontSize: 12,
  color: 'rgba(255,255,255,0.55)',
  lineHeight: 1.3,
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const BG = '#212121';
const BG_DEEP = '#1a1a1a';
const FG = '#ececec';
const USER_BUBBLE = '#2f2f2f';

const FONT = '"Inter", "SF Pro Text", "Söhne", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const S = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: BG,
    color: FG,
    fontFamily: FONT,
    position: 'relative',
    overflow: 'hidden',
  },

  // ── Sidebar ──
  scrim: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 90,
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '82%',
    maxWidth: 320,
    background: BG_DEEP,
    zIndex: 91,
    display: 'flex',
    flexDirection: 'column',
    padding: '14px 12px 0',
    boxShadow: '6px 0 24px rgba(0,0,0,0.5)',
  },
  sidebarHeaderContainer: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  sidebarHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    padding: '2px 4px',
  },
  newChatRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '12px 14px',
    background: 'transparent',
    border: 'none',
    color: FG,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: 12,
    marginBottom: 14,
    transition: 'background 0.15s',
    appearance: 'none',
    WebkitAppearance: 'none',
    fontFamily: FONT,
    textAlign: 'left',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    margin: '2px 10px 8px',
  },
  historyList: { flex: 1, overflowY: 'auto', paddingRight: 4 },
  historyItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    marginBottom: 2,
    transition: 'background 0.15s',
    color: FG,
    fontFamily: FONT,
    appearance: 'none',
    WebkitAppearance: 'none',
    textAlign: 'left',
  },
  historyTitle: {
    fontSize: 13.5,
    fontWeight: 500,
    color: FG,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  historyDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.42)',
  },
  emptyHistory: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.42)',
    textAlign: 'center',
    padding: '32px 16px',
    lineHeight: 1.5,
  },
  sidebarFooter: {
    borderTop: '1px solid rgba(255,255,255,0.06)',
    padding: '12px 4px calc(12px + env(safe-area-inset-bottom, 0px))',
    marginTop: 8,
    flexShrink: 0,
  },
  sidebarUser: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 8px',
    borderRadius: 10,
  },
  userBadge: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #a78bfa, #6366f1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
    flexShrink: 0,
  },
  userName: {
    fontSize: 13.5,
    fontWeight: 600,
    color: FG,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.42)',
    marginTop: 2,
  },

  // ── Header — strict single-row layout ──
  // Explicit flex-direction:row + flex-wrap:nowrap prevents anything
  // weird (like a too-aggressive global button rule) from making the
  // icon button and title stack vertically.
  header: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 8px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
    position: 'relative',
  },
  // Stacks the brand name + "Powered by Yugnext-AI Solutions" subtitle.
  // Takes ALL remaining horizontal space between the hamburger on the left
  // and the spacer on the right — visually centered between them.
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: FONT,
    lineHeight: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: FG,
    letterSpacing: '-0.01em',
    lineHeight: 1.15,
    fontFamily: FONT,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.42)',
    marginTop: 2,
    letterSpacing: 0.2,
    fontFamily: FONT,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  // Invisible 38×38 placeholder mirroring the hamburger's width so the
  // title sits dead-center across the screen.
  headerSpacer: {
    width: 38,
    height: 38,
    flexShrink: 0,
  },
  modelTag: {
    fontSize: 10.5,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.50)',
    background: 'rgba(255,255,255,0.06)',
    padding: '2px 6px',
    borderRadius: 6,
    letterSpacing: 0.2,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: 'transparent',
    border: 'none',
    color: FG,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    appearance: 'none',
    WebkitAppearance: 'none',
    WebkitTapHighlightColor: 'transparent',
  },

  // ── Body ──
  body: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
  },
  thread: {
    padding: '16px 14px 12px',
    maxWidth: 760,
    margin: '0 auto',
  },

  // ── Welcome ── (compact — fits comfortably above the input pill)
  welcome: {
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px 14px 24px',
    gap: 10,
  },
  welcomeBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 20px rgba(167, 139, 250, 0.18)',
    marginBottom: 2,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 600,
    margin: 0,
    color: FG,
    textAlign: 'center',
    letterSpacing: '-0.015em',
    marginBottom: 8,
    fontFamily: FONT,
  },
  suggestionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
    width: '100%',
    maxWidth: 440,
  },
  suggestionCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    cursor: 'pointer',
    color: FG,
    fontFamily: FONT,
    textAlign: 'left',
    appearance: 'none',
    WebkitAppearance: 'none',
    transition: 'background 0.15s, border-color 0.15s',
    minHeight: 64,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: FG,
    lineHeight: 1.2,
  },
  suggestionBody: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.50)',
    lineHeight: 1.35,
  },

  // ── User message ──
  userRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: 24,
  },
  userBubble: {
    maxWidth: '78%',
    padding: '11px 16px',
    background: USER_BUBBLE,
    borderRadius: 22,
    color: FG,
    fontSize: 15.5,
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: FONT,
  },

  // ── Assistant message ──
  assistantRow: { marginBottom: 28 },
  assistantHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  aiDot: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #a78bfa, #67e8f9)',
    flexShrink: 0,
    boxShadow: '0 0 10px rgba(167,139,250,0.35)',
  },
  assistantLabel: {
    fontSize: 12.5,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.62)',
    letterSpacing: 0.1,
  },
  assistantBody: {
    fontSize: 15.5,
    lineHeight: 1.55,
    color: FG,
    paddingLeft: 0,
  },

  // ── Markdown inside assistant body ──
  mdP:  { margin: '0 0 12px', fontSize: 15.5, lineHeight: 1.55 },
  mdH1: { fontSize: 20, fontWeight: 700, margin: '16px 0 10px' },
  mdH2: { fontSize: 17, fontWeight: 700, margin: '14px 0 8px' },
  mdH3: { fontSize: 15, fontWeight: 700, margin: '12px 0 6px' },
  mdList: { paddingLeft: 22, margin: '0 0 12px' },
  mdLi: { margin: '4px 0' },
  mdInlineCode: {
    background: 'rgba(255,255,255,0.07)',
    padding: '2px 6px',
    borderRadius: 5,
    fontSize: 13.5,
    fontFamily: '"JetBrains Mono", "SF Mono", Menlo, monospace',
    color: '#f4f4f5',
  },
  mdPre: {
    background: 'rgba(0,0,0,0.45)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: '12px 14px',
    overflowX: 'auto',
    margin: '8px 0 14px',
  },
  mdBlockCode: {
    fontFamily: '"JetBrains Mono", "SF Mono", Menlo, monospace',
    fontSize: 13.5,
    color: '#f4f4f5',
    lineHeight: 1.5,
    whiteSpace: 'pre',
  },
  mdLink: {
    color: '#67e8f9',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },

  // ── Action row (copy / like / dislike / regenerate) ──
  actionRow: {
    display: 'flex',
    gap: 4,
    marginTop: 6,
    marginLeft: -8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.50)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.15s, background 0.15s',
    appearance: 'none',
    WebkitAppearance: 'none',
  },

  // ── Thinking indicator ──
  thinkingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
  },
  thinkingDots: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    paddingTop: 2,
  },
  thinkingDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.7)',
    display: 'inline-block',
    animation: 'lernixThinking 1.1s ease-in-out infinite',
  },

  // ── Input dock ──
  inputDock: {
    flexShrink: 0,
    padding: '8px 12px 6px',
    background: BG,
  },
  inputPill: {
    display: 'flex',
    // center keeps everything in a single neat row instead of growing the
    // pill vertically. The textarea auto-grows but caps at maxHeight (140).
    alignItems: 'center',
    background: '#2f2f2f',
    borderRadius: 26,
    padding: '4px 4px 4px 4px',
    gap: 4,
    minHeight: 48,
    boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset',
    flexWrap: 'nowrap',
  },
  plusBtn: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'rgba(255,255,255,0.08)',
    border: 'none', color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, appearance: 'none', WebkitAppearance: 'none',
  },
  textarea: {
    flex: 1,
    minWidth: 0,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#fff',
    fontSize: 15.5,
    fontFamily: FONT,
    padding: '9px 6px',
    resize: 'none',
    lineHeight: 1.4,
    maxHeight: 140,
    overflowY: 'auto',
    appearance: 'none',
    WebkitAppearance: 'none',
  },
  micBtn: {
    width: 36, height: 36, borderRadius: '50%', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    appearance: 'none', WebkitAppearance: 'none',
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: '50%', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.15s, color 0.15s',
    appearance: 'none', WebkitAppearance: 'none',
  },

  // ── Attachment menu (bottom sheet) ──
  attachBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    zIndex: 2300,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  attachSheet: {
    width: '100%',
    maxWidth: 480,
    background: BG,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px 20px 0 0',
    padding: '12px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
    color: '#f1f5f9',
    fontFamily: FONT,
    boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.55)',
  },
  attachGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    background: 'rgba(255, 255, 255, 0.22)',
    margin: '0 auto 14px',
  },
  attachCancel: {
    marginTop: 4,
    width: '100%',
    padding: '12px',
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.10)',
    color: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT,
  },

  disclaimer: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.34)',
    textAlign: 'center',
    margin: '8px 0 0',
    fontFamily: FONT,
  },
};

// Keyframes for the thinking-dots animation — injected once.
if (typeof document !== 'undefined' && !document.getElementById('lernix-mobile-kf')) {
  const style = document.createElement('style');
  style.id = 'lernix-mobile-kf';
  style.textContent = `
    @keyframes lernixThinking {
      0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
      40%           { opacity: 1;    transform: translateY(-2px); }
    }
    /* Strip the global body.X button {!important} cosmic gradient from
       every button inside the Lernix mobile chat. Our React inline styles
       supply the correct background per button; we just need to defeat
       the !important from index.css with equal-or-higher specificity. */
    body .lernix-mobile button,
    body.standard-theme .lernix-mobile button,
    body.dark-theme .lernix-mobile button {
      background: transparent !important;
      background-image: none !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      padding: 0 !important;
      min-height: 0 !important;
      color: inherit !important;
      font-weight: inherit !important;
      transform: none !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    /* Re-apply the per-button paint from the inline style (which is now
       safely on top because the global !important above only sets a few
       baseline properties — inline still wins for shape + bg). */
    body .lernix-mobile button.lernix-pill {
      background: rgba(255,255,255,0.08) !important;
      border-radius: 50% !important;
    }
    body .lernix-mobile button.lernix-send-active {
      background: #ffffff !important;
      border-radius: 50% !important;
    }
    body .lernix-mobile button.lernix-send-idle {
      background: #3a3a3a !important;
      border-radius: 50% !important;
    }
    /* Attachment menu rows — inline style supplies the dark card paint */
    body button.lernix-attach-row,
    body.standard-theme button.lernix-attach-row,
    body.dark-theme button.lernix-attach-row {
      background: rgba(255,255,255,0.04) !important;
      border: 1px solid rgba(255,255,255,0.06) !important;
      border-radius: 14px !important;
      padding: 14px 14px !important;
    }
    body button.lernix-attach-row:hover {
      background: rgba(255,255,255,0.07) !important;
    }
    body button.lernix-attach-cancel,
    body.standard-theme button.lernix-attach-cancel,
    body.dark-theme button.lernix-attach-cancel {
      background: transparent !important;
      border: 1px solid rgba(255,255,255,0.10) !important;
      border-radius: 14px !important;
      padding: 12px !important;
    }

    /* index.css's mobile media query forces min-height:44px + padding on
       every <textarea> + button, which made the Lernix input pill look
       enormous and "zoomed". Override JUST inside our component. */
    body .lernix-mobile textarea,
    body.standard-theme .lernix-mobile textarea,
    body.dark-theme .lernix-mobile textarea {
      min-height: 0 !important;
      padding: 8px 6px !important;
      font-size: 15px !important;
      line-height: 1.4 !important;
      border: none !important;
      outline: none !important;
      background: transparent !important;
      box-shadow: none !important;
      resize: none !important;
    }
    body .lernix-mobile button.lernix-pill,
    body .lernix-mobile button.lernix-send-active,
    body .lernix-mobile button.lernix-send-idle {
      width: 36px !important;
      height: 36px !important;
      min-width: 36px !important;
      min-height: 36px !important;
      padding: 0 !important;
    }
    /* Top-bar hamburger button — same 38×38 size, rounded corners, kept
       compact against the global mobile button rule. */
    body .lernix-mobile button.lernix-iconbtn,
    body.standard-theme .lernix-mobile button.lernix-iconbtn,
    body.dark-theme .lernix-mobile button.lernix-iconbtn {
      width: 38px !important;
      height: 38px !important;
      min-width: 38px !important;
      min-height: 38px !important;
      padding: 0 !important;
      border-radius: 10px !important;
    }
    body .lernix-mobile button.lernix-suggest {
      background: rgba(255,255,255,0.04) !important;
      border: 1px solid rgba(255,255,255,0.07) !important;
      border-radius: 16px !important;
      padding: 14px 14px !important;
    }
    body .lernix-mobile button.lernix-history {
      border-radius: 10px !important;
      padding: 10px 12px !important;
    }
    body .lernix-mobile button.lernix-history.is-active {
      background: #2f2f2f !important;
    }
    body .lernix-mobile button.lernix-new-chat {
      padding: 12px 14px !important;
      border-radius: 12px !important;
    }
    body .lernix-mobile button.lernix-action {
      border-radius: 8px !important;
      padding: 0 !important;
    }
    body .lernix-mobile button:hover { box-shadow: none !important; transform: none !important; }
    body .lernix-mobile button.lernix-suggest:hover,
    body .lernix-mobile button.lernix-suggest:active {
      background: rgba(255,255,255,0.07) !important;
    }
    body .lernix-mobile button.lernix-action:hover {
      color: #fff !important;
      background: rgba(255,255,255,0.06) !important;
    }
    body .lernix-mobile button.lernix-history:hover {
      background: rgba(255,255,255,0.05) !important;
    }
  `;
  document.head.appendChild(style);
}
