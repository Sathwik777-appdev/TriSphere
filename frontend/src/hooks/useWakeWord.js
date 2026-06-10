import { useState, useEffect, useRef } from 'react';

export const useWakeWord = (onWake, enabled = true) => {
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState(null);
    const recognitionRef = useRef(null);
    const onWakeRef = useRef(onWake);
    const enabledRef = useRef(enabled);
    // Circuit breaker for the onend → setTimeout → startRecognition restart
    // loop. Without a cap, any persistent error (mic blocked, no audio device,
    // network issues) restarts the recognizer every ~1s forever, pegging CPU
    // and the browser's audio capture pipeline.
    const restartAttemptsRef = useRef(0);
    const MAX_RESTART_ATTEMPTS = 5;
    const restartTimerRef = useRef(null);

    const startRecognition = () => {
        if (!recognitionRef.current || !enabledRef.current) return;
        try {
            recognitionRef.current.start();
        } catch (err) {
            if (err.name === 'InvalidStateError') {
                // Silently ignore, browser state is already active
            } else {
                console.error('SpeechRecognition start error:', err);
            }
        }
    };

    // Update refs when the callback or enabled state changes
    useEffect(() => {
        onWakeRef.current = onWake;
        enabledRef.current = enabled;

        // If it was disabled and just got enabled, try starting
        if (enabled && !isListening && recognitionRef.current && !error) {
            startRecognition();
        }
        // If it was enabled and just got disabled, stop
        if (!enabled && isListening && recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) { }
        }
    }, [onWake, enabled, isListening, error]);

    useEffect(() => {
        // If the consumer has disabled the wake word, do NOT instantiate the
        // SpeechRecognition object at all. Previously the recognizer was always
        // constructed and onstart/onend/onerror were registered with stale
        // closures — a dormant restart loop waiting for any nudge.
        if (!enabled) {
            return;
        }

        // Check browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError('Speech Recognition API not supported in this browser');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            console.log('Wake word listener started');
            // A successful start means we're healthy — reset the circuit breaker.
            restartAttemptsRef.current = 0;
            setIsListening(true);
        };

        recognition.onresult = (event) => {
            const current = event.resultIndex;
            const transcript = event.results[current][0].transcript.toLowerCase().trim();

            console.log('Wake word listener heard:', transcript);

            const wakeWords = [
                'hey lernix', 'hey linux', 'hey learnix', 'hey larnix',
                'lernix', 'linux', 'learnix', 'larnix',
                'hey learn', 'hey learning', 'helenex', 'helennex',
                'hey lyrics', 'hey lennox', 'hey phoenix', 'hey vernix',
                'hey remix', 'hey harmonics', 'hello lernix',
                'lernix ai', 'lernix ai assistant', 'hey lernix ai',
                'learnx', 'lernx', 'hey learnx', 'hey lernx',
                'hi lernix', 'hi learnix', 'hai lernix', 'hai learnix',
                'hai learning', 'he learnx', 'he learnix', 'he lernix',
                'hello linux', 'hi linux', 'hey lenny', 'hey leonix'
            ];

            // Check for wake word
            let detectedWord = null;
            for (const word of wakeWords) {
                if (transcript.includes(word)) { // Changed from startsWith to includes for better tolerance
                    detectedWord = word;
                    break;
                }
            }

            if (detectedWord) {
                console.log('Wake word detected:', detectedWord);

                // Extract trailing text (the question)
                const question = transcript.split(detectedWord).pop().trim();

                // Audio feedback (Chime)
                try {
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const oscillator = audioCtx.createOscillator();
                    const gainNode = audioCtx.createGain();
                    oscillator.connect(gainNode);
                    gainNode.connect(audioCtx.destination);
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
                    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
                    oscillator.start();
                    oscillator.stop(audioCtx.currentTime + 0.1);
                } catch (audioErr) { }

                if (onWakeRef.current) onWakeRef.current(question);

                // Crucial: Stop recognition so we can handover to MediaRecorder
                try {
                    recognition.stop();
                } catch (e) { }
            }
        };

        recognition.onerror = (event) => {
            if (event.error === 'not-allowed') {
                // Silently log only once to avoid console spam
                if (!window._wakeWordPermissionDeniedLogged) {
                    console.warn('Wake word listener: Microphone permission not yet granted or blocked.');
                    window._wakeWordPermissionDeniedLogged = true;
                }
                setIsListening(false);
                setError('Microphone permission denied');
            } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
                console.error('Wake word recognition error:', event.error);
                setError(event.error);
                setIsListening(false);
            }
        };


        recognition.onend = () => {
            setIsListening(false);

            // Stop conditions: hook torn down, consumer disabled, or circuit
            // breaker tripped. The breaker prevents the classic infinite-restart
            // loop when the recognizer keeps failing (e.g. denied mic).
            if (!recognitionRef.current || !enabledRef.current) return;
            if (restartAttemptsRef.current >= MAX_RESTART_ATTEMPTS) {
                console.warn(`Wake word: hit ${MAX_RESTART_ATTEMPTS} restart attempts — giving up.`);
                setError('restart-limit-exceeded');
                return;
            }

            restartAttemptsRef.current += 1;
            // Exponential backoff so a persistent failure doesn't peg the CPU.
            const delay = Math.min(1000 * Math.pow(2, restartAttemptsRef.current - 1), 30000);
            restartTimerRef.current = setTimeout(() => {
                if (recognitionRef.current && enabledRef.current) {
                    startRecognition();
                }
            }, delay);
        };

        recognitionRef.current = recognition;

        if (enabledRef.current) {
            startRecognition();
        }

        return () => {
            const currentRec = recognitionRef.current;
            recognitionRef.current = null; // Mark as intended stop
            if (restartTimerRef.current) {
                clearTimeout(restartTimerRef.current);
                restartTimerRef.current = null;
            }
            if (currentRec) {
                try {
                    currentRec.stop();
                } catch (e) { }
            }
        };
    }, [enabled]); // Re-run when enabled flips so we can construct/teardown cleanly

    const resetError = () => {
        setError(null);
    };

    return { isListening, error, resetError };
};
