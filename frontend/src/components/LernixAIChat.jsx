import React, { useState, useRef, useEffect, useMemo } from 'react';
import { chatWithAI, extractTextFromImage } from '../services/aiService';
import { saveChatSession, getChatSessions, getDailyChatUsage, incrementDailyChatUsage } from '../services/firestoreService';
import { useAuth } from '../hooks/useAuth';
import { safeLocalStorage } from '../utils/storage';
import { warningToast } from '../utils/toast';
import RobotLoader from './RobotLoader';
import { extractTextFromPDF } from '../services/pdfHelper';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useIsMobile } from '../hooks/useMediaQuery';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { speak, stopSpeaking } from '../utils/browserTTS';

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

// Daily limit configuration: Exactly matches the student's class number
const getDailyLimitForGrade = (rawGrade) => {
  const grade = parseInt(rawGrade, 10);
  if (Number.isNaN(grade)) return 5; // Default for unknown/guest
  // Max cap at 20 just in case, min 1
  return Math.max(1, Math.min(grade, 20));
};

export const LernixAIChat = ({ isMaximized = false }) => {
  const { user, userData } = useAuth();
  const userId = userData?.uid || user?.uid || 'guest';

  // Per-user daily message cap is derived from grade (class).
  const DAILY_MESSAGE_LIMIT = useMemo(
    () => getDailyLimitForGrade(userData?.class ?? userData?.classNumber),
    [userData?.class, userData?.classNumber]
  );



  // Text-to-Speech state
  const [speaking, setSpeaking] = useState(false);
  const [currentSpeakingIndex, setCurrentSpeakingIndex] = useState(null);

  // Daily limit tracking
  const getDailyUsage = () => {
    try {
      const today = new Date().toDateString();
      const usage = safeLocalStorage.get(`lernixai_daily_usage_${userId}`);
      if (usage && usage.date === today) {
        return usage.count;
      }
      // Reset if it's a new day
      return 0;
    } catch (error) {
      console.error('Error loading daily usage:', error);
      return 0;
    }
  };

  const saveDailyUsage = (count) => {
    try {
      const today = new Date().toDateString();
      safeLocalStorage.set(`lernixai_daily_usage_${userId}`, {
        date: today,
        count: count
      });
    } catch (error) {
      console.error('Error saving daily usage:', error);
    }
  };

  // Load saved chats list
  const loadSavedChats = () => {
    try {
      const saved = safeLocalStorage.get(`lernixai_chats_list_${userId}`);
      if (Array.isArray(saved)) {
        return saved;
      }
    } catch (error) {
      console.error('Error loading chats list:', error);
    }
    return [];
  };

  // Load specific chat history
  const loadChatHistory = (chatId) => {
    try {
      const saved = safeLocalStorage.get(`lernixai_chat_${userId}_${chatId}`);
      if (Array.isArray(saved)) {
        return saved;
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
    return [
      { role: 'assistant', content: 'Hello! I\'m LernixAI, your AI study assistant. Ask me anything about your studies! 📚' }
    ];
  };

  const isMobile = useIsMobile();

  const [currentChatId, setCurrentChatId] = useState(Date.now());
  const [savedChats, setSavedChats] = useState(loadSavedChats());
  const [messages, setMessages] = useState(loadChatHistory(Date.now()));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dailyMessageCount, setDailyMessageCount] = useState(0);

  // ── Voice dictation state ──
  // Matches the mobile mic experience: start/stop beep, live amplitude
  // ring driven by a WebAudio analyser of our own getUserMedia stream
  // (independent of SpeechRecognition's internal capture).
  const [isListening, setIsListening] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const recognitionRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const rafRef = useRef(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB size limit
        warningToast('❌ File too large. Please upload a file smaller than 10MB.');
        return;
      }
      setSelectedFile(file);
      setShowAttachMenu(false);
      // You can add file preview or processing here
      warningToast(`File selected: ${file.name}`);
    }
  };

  // Open camera modal
  const openCamera = async () => {
    setShowAttachMenu(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      handleSetCameraStream(stream);
      setShowCameraModal(true);
      // Give time for modal to render before setting video source
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error('Camera access error:', err);
      warningToast('Could not access camera. Please check permissions.');
    }
  };

  // Capture photo from video stream
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
          setSelectedFile(file);
          warningToast('Photo captured!');
          closeCamera();
        }
      }, 'image/jpeg', 0.8);
    }
  };

  // Close camera and stop stream
  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      handleSetCameraStream(null);
    }
    setShowCameraModal(false);
  };

  // Handle camera capture from file input (fallback for mobile)
  const handleCameraCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setShowAttachMenu(false);
      // Photo captured confirmation - non-obtrusive
    }
  };

  // Close attach menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showAttachMenu && !e.target.closest('.attach-menu-container')) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showAttachMenu]);

  const cameraStreamRef = useRef(null);

  // Set stream ref alongside state
  const handleSetCameraStream = (stream) => {
    cameraStreamRef.current = stream;
    setCameraStream(stream);
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // ── Cross-device sync ────────────────────────────────────────────────────
  // Pulls the full cloud session list (each item ships its own `messages`),
  // then merges with anything we already have locally so chats from this
  // device that haven't synced yet still show. The normalised shape ALWAYS
  // has `id`, `title`, `timestamp`, and (when from cloud) `messages` — which
  // lets `loadChat` skip localStorage and use the cloud payload directly.
  const fetchCloudHistory = async () => {
    if (!userId || userId === 'guest') return;
    try {
      const cloudHistory = await getChatSessions(userId);
      setSavedChats(prev => {
        const normalisedCloud = cloudHistory.map(s => ({
          id: s.sessionId,
          title: s.title,
          timestamp: s.updatedAt?.toMillis?.() || Date.now(),
          messages: s.messages, // ← keep payload so loadChat can use it directly
          updatedAt: s.updatedAt,
          source: 'cloud',
        }));
        // Preserve any local-only chats not yet in cloud
        const localOnly = prev.filter(p => !normalisedCloud.some(c => c.id === p.id));
        const merged = [...normalisedCloud, ...localOnly];
        return merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      });
    } catch (err) {
      console.warn('Cloud history fetch failed', err);
    }
  };

  // Handle user switching/initial load
  useEffect(() => {
    setSavedChats(loadSavedChats());
    const initialMessage = loadChatHistory(currentChatId);
    setMessages(initialMessage);
    fetchCloudHistory();
    
    // Fetch daily message count from Firestore
    const fetchUsage = async () => {
      if (userId && userId !== 'guest') {
        const usageCount = await getDailyChatUsage(userId);
        setDailyMessageCount(usageCount);
      } else {
        setDailyMessageCount(0);
      }
    };
    fetchUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Refresh cloud history whenever the sidebar opens — chats created on
  // another device show up without a full page reload.
  useEffect(() => {
    if (sidebarOpen) fetchCloudHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarOpen]);

  // Save current chat
  useEffect(() => {
    if (!userId || userId === 'guest') return;

    try {
      // Save messages for current chat (Local)
      safeLocalStorage.set(`lernixai_chat_${userId}_${currentChatId}`, messages);
      
      // Save messages for current chat (Cloud Sync)
      if (messages.length > 1) {
        saveChatSession(userId, currentChatId, messages);
      }

      // Update chat title in the list if there's content
      if (messages.length > 1) {
        const userMessages = messages.filter(m => m.role === 'user');
        if (userMessages.length > 0) {
          const firstUserMessage = userMessages[0]?.content || 'New chat';
          const title = firstUserMessage.substring(0, 30) + (firstUserMessage.length > 30 ? '...' : '');

          setSavedChats(prevChats => {
            const chatIndex = prevChats.findIndex(c => c.id === currentChatId);
            let updatedChats;

            if (chatIndex >= 0) {
              // Update existing chat if title or timestamp changed
              if (prevChats[chatIndex].title === title) return prevChats;
              updatedChats = [...prevChats];
              updatedChats[chatIndex] = { ...prevChats[chatIndex], title, timestamp: Date.now() };
            } else {
              // Add new chat
              updatedChats = [{ id: currentChatId, title, timestamp: Date.now() }, ...prevChats];
            }

            safeLocalStorage.set(`lernixai_chats_list_${userId}`, updatedChats);
            return updatedChats;
          });
        }
      }
    } catch (error) {
      console.error('Error saving chat:', error);
    }
  }, [messages, currentChatId, userId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Convert LaTeX \(...\) and \[...\] notation to $...$ and $$...$$ for KaTeX
  const preprocessLatex = (text) => {
    if (!text) return '';
    return text
      // Block math: \[...\] → $$...$$
      .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$$$1$$$$$$')
      // Inline math: \(...\) → $...$
      .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  };

  // ChatGPT-style markdown + math renderer
  const ChatMessage = React.memo(({ content }) => {
    const processed = useMemo(() => preprocessLatex(content), [content]);
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Styled table
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', margin: '12px 0', borderRadius: '8px', border: '1px solid #444' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead style={{ backgroundColor: '#383838' }}>{children}</thead>
          ),
          th: ({ children }) => (
            <th style={{ padding: '10px 14px', borderBottom: '2px solid #555', textAlign: 'left', color: '#a78bfa', fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap' }}>{children}</th>
          ),
          td: ({ children }) => (
            <td style={{ padding: '8px 14px', borderBottom: '1px solid #3a3a3a', color: '#d1d5db', fontSize: '13px' }}>{children}</td>
          ),
          tr: ({ children }) => (
            <tr style={{ transition: 'background 0.15s' }}>{children}</tr>
          ),
          // Styled code blocks
          code: ({ inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            if (!inline && (match || String(children).includes('\n'))) {
              return (
                <div style={{ position: 'relative', margin: '12px 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #444' }}>
                  {match && (
                    <div style={{ padding: '6px 14px', backgroundColor: '#383838', fontSize: '12px', color: '#888', borderBottom: '1px solid #444', fontFamily: 'monospace' }}>{match[1]}</div>
                  )}
                  <pre style={{ margin: 0, padding: '14px', backgroundColor: '#1e1e1e', overflowX: 'auto' }}>
                    <code style={{ fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace', fontSize: '13px', lineHeight: '1.6', color: '#e6e6e6' }} {...props}>{children}</code>
                  </pre>
                </div>
              );
            }
            return <code style={{ backgroundColor: '#383838', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace', color: '#a78bfa' }} {...props}>{children}</code>;
          },
          // Styled headings with vibrant colors
          h1: ({ children }) => <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#60a5fa', margin: '20px 0 10px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>{children}</h1>,
          h2: ({ children }) => <h2 style={{ fontSize: '19px', fontWeight: '700', color: '#a78bfa', margin: '18px 0 8px' }}>{children}</h2>,
          h3: ({ children }) => <h3 style={{ fontSize: '17px', fontWeight: '600', color: '#34d399', margin: '14px 0 6px' }}>{children}</h3>,
          h4: ({ children }) => <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#fbbf24', margin: '12px 0 4px' }}>{children}</h4>,
          // Styled lists
          ul: ({ children }) => <ul style={{ paddingLeft: '20px', margin: '8px 0', color: '#e5e7eb' }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ paddingLeft: '20px', margin: '8px 0', color: '#e5e7eb' }}>{children}</ol>,
          li: ({ children }) => <li style={{ marginBottom: '4px', lineHeight: '1.7', color: '#d1d5db' }}>{children}</li>,
          // Styled blockquote
          blockquote: ({ children }) => (
            <blockquote style={{ borderLeft: '4px solid #60a5fa', paddingLeft: '16px', margin: '16px 0', color: '#9ca3af', fontStyle: 'italic', backgroundColor: 'rgba(96, 165, 250, 0.1)', padding: '10px 16px', borderRadius: '0 8px 8px 0' }}>{children}</blockquote>
          ),
          // Styled paragraphs
          p: ({ children }) => <p style={{ margin: '8px 0', lineHeight: '1.7', color: '#e5e7eb' }}>{children}</p>,
          // Styled horizontal rule
          hr: () => <hr style={{ border: 'none', borderTop: '1px solid #444', margin: '20px 0' }} />,
          // Styled strong/em with distinct colors
          strong: ({ children }) => <strong style={{ color: '#fcd34d', fontWeight: '700' }}>{children}</strong>,
          em: ({ children }) => <em style={{ color: '#f472b6', fontStyle: 'italic' }}>{children}</em>,
          // Styled links
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none', borderBottom: '1px solid #38bdf8' }}>{children}</a>,
        }}
      >
        {processed}
      </ReactMarkdown>
    );
  });

  // ─── Mic: short beep tones (start = 880Hz, stop = 440Hz) ───
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
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain, now + 0.01);
      g.gain.linearRampToValueAtTime(0, now + durationMs / 1000);
      osc.start(now);
      osc.stop(now + durationMs / 1000 + 0.02);
      osc.onended = () => { try { ctx.close(); } catch (e) {} };
    } catch (e) { /* sound is non-essential */ }
  };

  // ─── Mic: amplitude analyser → drives the icon's scale + glow ring ───
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

  // ─── Mic: toggle dictation (Web Speech API) ───
  const toggleMic = async () => {
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch (e) {}
      return;
    }
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
        console.log('[LernixChat] Speech recognition started');
      };
      r.onresult = (event) => {
        console.log('[LernixChat] Speech recognition result received');
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
        console.error('[LernixChat] Speech recognition error:', code);
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
        console.log('[LernixChat] Speech recognition ended');
        stopMicAnalyser();
        playBeep(440, 100);
        setIsListening(false);
      };
      r.start();
      recognitionRef.current = r;
      setIsListening(true);
      startMicAnalyser();
    } catch (err) {
      console.error('[LernixChat] Could not start speech recognition:', err);
      warningToast('Could not start voice input.');
      stopMicAnalyser();
      setIsListening(false);
    }
  };

  // Cleanup on unmount — never leak the mic.
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch (e) {}
      stopMicAnalyser();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Process attached file
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
      throw new Error('Failed to read file content');
    } finally {
      setIsAnalysing(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();

    if ((!input.trim() && !selectedFile) || dailyMessageCount >= DAILY_MESSAGE_LIMIT || loading || isAnalysing) {
      if (dailyMessageCount >= DAILY_MESSAGE_LIMIT) {
        warningToast(`Daily limit reached: ${DAILY_MESSAGE_LIMIT} messages. Resets at midnight.`);
      }
      return;
    }

    const currentInput = input;
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
        console.error('Attachment error:', err);
        // Show validation/processing error toast and abort
        warningToast(err.message || 'Could not process the attached file.');
        return;
      }
    }

    // Since validation succeeded, proceed with sending the message
    const uiMessage = currentFile ? `${currentInput}\n\n📎 [Attached: ${currentFile.name}]` : currentInput;
    const userMessage = { role: 'user', content: uiMessage };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Increment both locally and in Firestore database immediately
    setDailyMessageCount(prev => prev + 1);
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

      // Prepare chat history for AI
      const chatMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      chatMessages.push({ role: 'user', content: userContent });

      // AI response with minimum 3-second 'thinking' time for UX consistency
      const [responseObj] = await Promise.all([
        chatWithAI(chatMessages),
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);

      setMessages(prev => [...prev, { role: 'assistant', content: responseObj.content }]);

    } catch (err) {
      console.error('Chat error:', err);
      setDailyMessageCount(prev => Math.max(0, prev - 1)); // Revert count if response fails
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

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMessage
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChatHistory = () => {
    if (window.confirm('Clear current chat messages? The chat will remain in history.')) {
      const initialMessage = [
        { role: 'assistant', content: 'Hello! I\'m LernixAI, your AI study assistant. Ask me anything about your studies! 📚' }
      ];
      setMessages(initialMessage);
    }
  };

  const startNewChat = () => {
    const newChatId = Date.now();
    setCurrentChatId(newChatId);
    const initialMessage = [
      { role: 'assistant', content: 'Hello! I\'m LernixAI, your AI study assistant. Ask me anything about your studies! 📚' }
    ];
    setMessages(initialMessage);
  };

  const loadChat = (chatId) => {
    if (!chatId) return;
    setCurrentChatId(chatId);
    // Cross-device: prefer cloud payload if the chat came from Firestore.
    // localStorage on THIS device won't have messages from another device.
    const cloudHit = savedChats.find(c => c.id === chatId && c.messages?.length);
    if (cloudHit) {
      setMessages(cloudHit.messages);
      // Cache locally so subsequent loads are instant + offline-friendly
      try { safeLocalStorage.set(`lernixai_chat_${userId}_${chatId}`, cloudHit.messages); } catch (e) {}
    } else {
      setMessages(loadChatHistory(chatId));
    }
    // Auto-close sidebar on mobile after selecting a chat
    if (isMobile) setSidebarOpen(false);
  };

  const deleteChat = (chatId) => {
    if (window.confirm('Delete this chat?')) {
      safeLocalStorage.remove(`lernixai_chat_${userId}_${chatId}`);
      const updatedChats = savedChats.filter(c => c.id !== chatId);
      setSavedChats(updatedChats);
      safeLocalStorage.set(`lernixai_chats_list_${userId}`, updatedChats);

      if (chatId === currentChatId) {
        startNewChat();
      }
    }
  };

  // Text-to-Speech functions
  const handleSpeak = async (text, messageIndex) => {
    if (!text) return;

    if (currentSpeakingIndex === messageIndex && speaking) {
      await stopSpeaking();
      setSpeaking(false);
      setCurrentSpeakingIndex(null);
      return;
    }

    // Stop current speech if any
    await stopSpeaking();
    setSpeaking(true);
    setCurrentSpeakingIndex(messageIndex);

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
      // Reset only if we are still speaking this specific index
      setSpeaking(false);
      setCurrentSpeakingIndex(null);
    } catch (e) {
      console.error('Lernix AI speech error:', e);
      setSpeaking(false);
      setCurrentSpeakingIndex(null);
    }
  };

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  return (
    <div style={{ ...styles.mainContainer, maxHeight: isMaximized ? 'none' : '800px' }} className="ai-chat-main-container">

      {/* Sidebar */}
      <div
        style={{
          ...styles.sidebar,
          ...(isMobile ? {
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            zIndex: 50,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.3s ease',
            boxShadow: sidebarOpen ? '4px 0 20px rgba(0, 0, 0, 0.4)' : 'none'
          } : {
            ...(sidebarOpen ? {} : { display: 'none' })
          })
        }}
        className="ai-chat-sidebar"
      >
        <div style={styles.sidebarHeader}>
          <button onClick={() => { startNewChat(); if (isMobile) setSidebarOpen(false); }} style={styles.newChatButton}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New chat
          </button>
          <div style={styles.sidebarTitle}>Your chats</div>
        </div>

        <div style={styles.sidebarHistoryList}>
          {savedChats.map(chat => (
            <div
              key={chat.id}
              style={{
                ...styles.chatHistoryItem,
                ...(chat.id === currentChatId ? styles.activeChatItem : {})
              }}
              onClick={() => loadChat(chat.id)}
            >
              <div style={styles.chatItemContent}>
                <span style={styles.chatTitle}>{chat.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                  style={styles.deleteChatButton}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.sidebarFooter}>
          <div style={styles.userProfile}>
            <div style={styles.userAvatar}>You</div>
            <span style={styles.userName}>{userData?.email || user?.email || 'Student'}</span>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={styles.container} className="ai-chat-container">
        {/* Header */}
        <div style={styles.header} className="ai-chat-header">
          <div style={{ ...styles.headerContent, maxWidth: isMaximized ? '100%' : '768px' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={styles.toggleSidebar}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <div style={styles.headerTitle}>
              <div style={styles.modelBadge}>
                <span>LernixAI</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ChatGPT-style messages */}
        <div style={styles.chatHistory} className="ai-chat-history">
          {messages.length === 1 && messages[0].role === 'assistant' ? (
            // Empty state with prompt
            <div style={styles.emptyState}>
              <div style={styles.emptyStateLogo}>
                <div style={styles.logoPulse} />
                <span style={{ fontSize: '48px', position: 'relative', zIndex: 1 }}>🤖</span>
              </div>
              <h1 style={{ ...styles.emptyStateTitle, fontSize: isMaximized ? '48px' : '32px' }} className="empty-state-title">What can I help with?</h1>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  ...styles.messageRow,
                  backgroundColor: msg.role === 'assistant' ? '#2f2f2f' : 'transparent',
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{
                  ...styles.messageContainer,
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                }}>
                    <div style={styles.avatar}>
                      {msg.role === 'user' ? (
                        <div style={styles.userAvatarIcon}>
                          <span style={{ fontSize: '12px' }}>👤</span>
                        </div>
                      ) : (
                        <div style={styles.aiAvatarIcon}>
                          <span style={{ fontSize: '12px' }}>🤖</span>
                        </div>
                      )}
                    </div>
                  <div style={styles.messageContent}>
                    <div style={{ ...styles.messageText, fontSize: isMaximized ? '18px' : '15px' }} className="lernix-md-content">
                      <div className="selectable-text">
                        <ChatMessage content={msg.content} />
                      </div>
                    </div>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => handleSpeak(msg.content, idx)}
                        style={{
                          ...styles.speakButton,
                          ...(currentSpeakingIndex === idx && speaking ? styles.speakButtonActive : {})
                        }}
                        title={currentSpeakingIndex === idx && speaking ? "Stop speaking" : "Listen to response"}
                      >
                        {currentSpeakingIndex === idx && speaking ? '⏸️' : '🔊'} Listen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {isAnalysing ? (
            <div style={{ ...styles.messageRow, backgroundColor: '#2f2f2f' }}>
              <div style={styles.messageContainer}>
                <div style={styles.avatar}>
                  <div style={styles.aiAvatarIcon}>
                    <span style={{ fontSize: '12px' }}>🤖</span>
                  </div>
                </div>
                <div style={styles.messageContent}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <RobotLoader size={180} showText={false} />
                    <div style={{ color: '#00ffff', fontWeight: 'bold', fontSize: '14px', letterSpacing: '1px' }}>
                      LERNIX IS ANALYSING YOUR FILE...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : loading && (
            <div style={{ ...styles.messageRow, backgroundColor: '#2f2f2f' }}>
              <div style={styles.messageContainer}>
                <div style={styles.avatar}>
                  <div style={styles.aiAvatarIcon}>
                    <span style={{ fontSize: '12px' }}>🤖</span>
                  </div>
                </div>
                <div style={styles.messageContent}>
                  <RobotLoader size={200} showText={true} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* ChatGPT-style input */}
        {/* Hidden file inputs */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          accept="image/*,application/pdf,.doc,.docx,.txt"
        />
        <input
          type="file"
          ref={cameraInputRef}
          style={{ display: 'none' }}
          onChange={handleCameraCapture}
          accept="image/*"
          capture="environment"
        />

        <div style={styles.inputWrapper} className="ai-chat-input-wrapper">
          <form onSubmit={handleSendMessage} style={styles.inputContainer} className="ai-chat-input-container">
            <div style={styles.inputBox} className="ai-chat-input-box">
              <div className="attach-menu-container" style={{ position: 'relative' }}>
                <button
                  type="button"
                  disabled={loading || isAnalysing || dailyMessageCount >= DAILY_MESSAGE_LIMIT}
                  style={{
                    ...styles.attachButton,
                    opacity: (loading || isAnalysing || dailyMessageCount >= DAILY_MESSAGE_LIMIT) ? 0.5 : 1,
                    cursor: (loading || isAnalysing || dailyMessageCount >= DAILY_MESSAGE_LIMIT) ? 'not-allowed' : 'pointer'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAttachMenu(!showAttachMenu);
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>

                {/* Attachment Menu Popup */}
                {showAttachMenu && (
                  <div style={styles.attachMenuPopup}>
                    <button
                      type="button"
                      style={styles.attachMenuItem}
                      onClick={openCamera}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <span>Take Photo</span>
                    </button>
                    <button
                      type="button"
                      style={styles.attachMenuItem}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                      </svg>
                      <span>Add File</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Selected File Preview - ADDED THIS */}
              {selectedFile && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#383838',
                  padding: '6px 12px',
                  borderRadius: '16px',
                  marginRight: '8px',
                  marginBottom: '4px',
                  border: '1px solid #4d4d4f',
                  maxWidth: '200px'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  </svg>
                  <span style={{
                    color: '#fff',
                    fontSize: '13px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '140px'
                  }}>
                    {selectedFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#888',
                      cursor: 'pointer',
                      padding: '0',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder={dailyMessageCount >= DAILY_MESSAGE_LIMIT ? `Daily limit reached (${DAILY_MESSAGE_LIMIT} messages). Resets at midnight.` : `Ask anything (${DAILY_MESSAGE_LIMIT - dailyMessageCount} remaining today)`}
                style={{ ...styles.textarea, fontSize: isMaximized ? '18px' : '15px' }}
                disabled={loading || isAnalysing || dailyMessageCount >= DAILY_MESSAGE_LIMIT}
                rows={1}
              />

              {/* Mic button — speech-to-text with start/stop beep and a
                  live amplitude ring that scales with your voice volume.
                  Sits between the textarea and the send button. */}
              <button
                type="button"
                onClick={toggleMic}
                disabled={loading || isAnalysing || dailyMessageCount >= DAILY_MESSAGE_LIMIT}
                style={{
                  ...styles.micButton,
                  ...(isListening ? styles.micButtonActive : {}),
                  opacity: (loading || isAnalysing || dailyMessageCount >= DAILY_MESSAGE_LIMIT) ? 0.5 : 1,
                  cursor: (loading || isAnalysing || dailyMessageCount >= DAILY_MESSAGE_LIMIT) ? 'not-allowed' : 'pointer'
                }}
                aria-label={isListening ? 'Stop dictation' : 'Voice input'}
                title={isListening ? 'Stop dictation' : 'Voice input'}
              >
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </span>
              </button>

              <button
                type="submit"
                disabled={loading || isAnalysing || dailyMessageCount >= DAILY_MESSAGE_LIMIT || (!input.trim() && !selectedFile)}
                style={{
                  ...styles.sendButton,
                  ...((loading || isAnalysing || dailyMessageCount >= DAILY_MESSAGE_LIMIT || (!input.trim() && !selectedFile)) ? styles.sendButtonDisabled : {})
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Camera Modal */}
      {showCameraModal && (
        <div style={styles.cameraModalOverlay}>
          <div style={styles.cameraModal}>
            <div style={styles.cameraHeader}>
              <span style={styles.cameraTitle}>Take Photo</span>
              <button onClick={closeCamera} style={styles.cameraCloseBtn}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={styles.cameraContainer}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={styles.cameraVideo}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
            <div style={styles.cameraControls}>
              <button onClick={capturePhoto} style={styles.captureButton}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  mainContainer: {
    display: 'flex',
    height: '100%',
    maxHeight: '100%',
    backgroundColor: '#212121',
    position: 'relative',
    overflow: 'hidden'
  },
  sidebar: {
    width: '260px',
    backgroundColor: '#171717',
    borderRight: '1px solid #2f2f2f',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0
  },
  sidebarHeader: {
    padding: '12px 12px 4px 12px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarHistoryList: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 12px 12px 12px',
  },
  newChatButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: 'transparent',
    border: '1px solid #4d4d4f',
    borderRadius: '8px',
    color: '#ececec',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '16px',
    transition: 'background-color 0.2s'
  },
  sidebarSection: {
    marginTop: '8px'
  },
  sidebarTitle: {
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#8e8ea0',
    textTransform: 'uppercase'
  },
  chatHistoryItem: {
    padding: '10px 12px',
    fontSize: '14px',
    color: '#ececec',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    marginBottom: '4px',
    position: 'relative'
  },
  activeChatItem: {
    backgroundColor: '#2f2f2f'
  },
  chatItemContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px'
  },
  chatTitle: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  deleteChatButton: {
    padding: '4px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#8e8ea0',
    cursor: 'pointer',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    opacity: 1,
    transition: 'opacity 0.2s, background-color 0.2s'
  },
  sidebarFooter: {
    borderTop: '1px solid #2f2f2f',
    padding: '12px',
    flexShrink: 0
  },
  userProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    backgroundColor: '#19c37d',
    color: '#fff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '600'
  },
  userName: {
    fontSize: '14px',
    color: '#ececec',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#212121',
    position: 'relative'
  },
  header: {
    borderBottom: '1px solid #2f2f2f',
    padding: '12px 16px',
    backgroundColor: '#212121',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    flexShrink: 0
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    maxWidth: '768px',
    margin: '0 auto'
  },
  toggleSidebar: {
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#ececec',
    display: 'flex',
    alignItems: 'center',
    transition: 'background-color 0.2s'
  },
  headerTitle: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center'
  },
  modelBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: 'transparent',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#ececec',
    cursor: 'pointer'
  },
  chatHistory: {
    flex: 1,
    overflowY: 'auto',
    backgroundColor: '#212121'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '40px 20px'
  },
  emptyStateTitle: {
    fontSize: '32px',
    fontWeight: '600',
    color: '#ececec',
    marginBottom: '20px'
  },
  messageRow: {
    width: '100%',
    padding: '16px 0',
    transition: 'all 0.3s ease',
    backdropFilter: 'blur(5px)'
  },
  messageContainer: {
    maxWidth: '768px',
    width: '100%',
    margin: '0 auto',
    padding: '0 16px',
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start'
  },
  avatar: {
    flexShrink: 0,
    width: '32px',
    height: '32px'
  },
  userAvatarIcon: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    color: '#fff',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '700',
    boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  aiAvatarIcon: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: '700',
    boxShadow: '0 4px 10px rgba(139, 92, 246, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  emptyStateLogo: {
    position: 'relative',
    width: '100px',
    height: '100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '24px'
  },
  logoPulse: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
    borderRadius: '50%',
    animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite'
  },
  messageContent: {
    flex: 1,
    minWidth: 0
  },
  messageText: {
    fontSize: '15px',
    lineHeight: '1.7',
    color: '#ececec',
    wordWrap: 'break-word'
  },
  speakButton: {
    marginTop: '8px',
    padding: '6px 12px',
    backgroundColor: '#2f2f2f',
    border: '1px solid #4d4d4f',
    borderRadius: '6px',
    color: '#ececec',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s ease'
  },
  speakButtonActive: {
    backgroundColor: '#19c37d',
    borderColor: '#19c37d',
    color: '#fff',
    animation: 'pulse 1.5s ease-in-out infinite'
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0'
  },
  loadingVideo: {
    width: '80px',
    height: '80px',
    objectFit: 'contain',
    borderRadius: '8px'
  },
  loadingText: {
    color: '#8e8ea0',
    fontSize: '14px',
    fontStyle: 'italic'
  },
  inputWrapper: {
    padding: '12px 16px',
    backgroundColor: '#212121',
    borderTop: '1px solid #2f2f2f',
    paddingBottom: '24px',
    flexShrink: 0
  },
  inputContainer: {
    maxWidth: '768px',
    margin: '0 auto'
  },
  inputBox: {
    position: 'relative',
    backgroundColor: 'rgba(47, 47, 47, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '24px',
    display: 'flex',
    alignItems: 'flex-end',
    padding: '8px 16px',
    gap: '12px',
    backdropFilter: 'blur(20px)',
    transition: 'all 0.3s ease',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
  },
  attachButton: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ececec',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background-color 0.2s'
  },
  textarea: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '15px',
    lineHeight: '1.5',
    resize: 'none',
    maxHeight: '200px',
    fontFamily: 'inherit',
    color: '#ececec',
    backgroundColor: 'transparent',
    padding: '10px 0'
  },
  sendButton: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#ececec',
    border: 'none',
    color: '#212121',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'opacity 0.2s'
  },
  sendButtonDisabled: {
    backgroundColor: '#676767',
    cursor: 'not-allowed',
    opacity: 0.5
  },
  // Voice dictation mic — neutral idle, red while listening. Stays the
  // same physical size whether listening or not so the layout doesn't
  // jump; the amplitude ring overlays it inside the button bounds.
  micButton: {
    position: 'relative',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.78)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    outline: 'none',
    transition: 'background 0.18s ease, color 0.18s ease',
    WebkitTapHighlightColor: 'transparent',
  },
  micButtonActive: {
    background: '#ef4444',
    color: '#fff',
  },
  attachMenuPopup: {
    position: 'absolute',
    bottom: '50px',
    left: '0',
    backgroundColor: '#2f2f2f',
    border: '1px solid #4d4d4f',
    borderRadius: '12px',
    padding: '8px',
    minWidth: '160px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  attachMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#ececec',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    textAlign: 'left',
    width: '100%'
  },
  cameraModalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000
  },
  cameraModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: '16px',
    overflow: 'hidden',
    maxWidth: '500px',
    width: '90%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
  },
  cameraHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #333'
  },
  cameraTitle: {
    color: '#fff',
    fontSize: '18px',
    fontWeight: '600'
  },
  cameraCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    transition: 'color 0.2s'
  },
  cameraContainer: {
    position: 'relative',
    backgroundColor: '#000',
    aspectRatio: '4/3',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cameraVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  cameraControls: {
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a'
  },
  captureButton: {
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    border: '4px solid #4d4d4f',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s',
    color: '#fff'
  }
};
