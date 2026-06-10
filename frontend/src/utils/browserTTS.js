/**
 * browserTTS.js
 * ───────────────────────────────────────────────────────────────────
 * Tiny wrapper around `window.speechSynthesis` that's safe to call from
 * anywhere in the app. Used by ASTRA's voice check-in and the Lernix
 * tutor to replace the ~3-4 second round-trip to Google Cloud TTS
 * with a near-instant on-device synthesis (~100 ms).
 *
 * Why a utility instead of inline calls:
 *   1. Voice loading is asynchronous on first hit — Chrome returns
 *      [] from getVoices() until the `voiceschanged` event fires.
 *      Every caller would otherwise have to remember to listen for
 *      that event.
 *   2. Picking the best Indian-English voice (en-IN, then en-GB,
 *      then en-US, then "any English") is the same logic everywhere
 *      and easy to get wrong.
 *   3. Cancelling a stale utterance before starting a new one is a
 *      common footgun — `speechSynthesis.speak` queues by default.
 */

let voicesCache = null;
let voicesPromise = null;

/**
 * Returns true if the browser supports speech synthesis at all. False
 * for older Safari builds and any non-browser environment (SSR).
 */
export function isBrowserTTSAvailable() {
    return (
        typeof window !== 'undefined' &&
        'speechSynthesis' in window &&
        typeof window.SpeechSynthesisUtterance === 'function'
    );
}

/**
 * Load the voice list once and cache it. Chromium populates the
 * voices asynchronously on first ever call — we wait for the
 * `voiceschanged` event so callers don't have to. Subsequent calls
 * are synchronous.
 */
async function ensureVoices() {
    if (!isBrowserTTSAvailable()) return [];
    if (voicesCache && voicesCache.length) return voicesCache;
    if (voicesPromise) return voicesPromise;

    voicesPromise = new Promise((resolve) => {
        const synth = window.speechSynthesis;
        const initial = synth.getVoices();
        if (initial && initial.length) {
            voicesCache = initial;
            resolve(initial);
            return;
        }
        // Listen ONCE for voiceschanged. Guard with a 1 s timeout so
        // we never block forever on a broken browser.
        const onChange = () => {
            const list = synth.getVoices();
            if (list && list.length) {
                voicesCache = list;
                synth.removeEventListener('voiceschanged', onChange);
                clearTimeout(timer);
                resolve(list);
            }
        };
        synth.addEventListener('voiceschanged', onChange);
        const timer = setTimeout(() => {
            synth.removeEventListener('voiceschanged', onChange);
            voicesCache = synth.getVoices() || [];
            resolve(voicesCache);
        }, 1000);
    });

    return voicesPromise;
}

/**
 * Pick the most natural-sounding Indian-English voice available on
 * the device, falling back gracefully:
 *   1. en-IN exact match (best — Indian pronunciation)
 *   2. Any voice with "India" / "Hindi" in the name (older Android)
 *   3. en-GB (British) — most natural sounding among Western voices
 *   4. en-US — fallback
 *   5. Anything English-ish
 *   6. First available voice
 */
// Best-effort female-voice heuristic. Voice names aren't standardized
// across browsers/OSes, so this matches the common patterns: known
// female identifiers in the name, or explicit gender keywords. The
// previous version had a buggy clause that flagged male voices ending
// in vowels as female — fixed by removing the unreliable suffix rule
// and explicitly excluding known male voice names.
const KNOWN_FEMALE_NAMES = [
    'female', 'woman', 'girl',
    'samantha', 'victoria', 'karen', 'moira', 'tessa', 'veena',
    'fiona', 'allison', 'serena', 'kate', 'siri female',
    'priya', 'aditi', 'aanya', 'lekha', 'mira', 'tara', 'asha',
];
const KNOWN_MALE_NAMES = [
    'male', 'man', 'boy',
    'daniel', 'alex', 'fred', 'rishi', 'arjun', 'rohit',
    'ravi', 'amit', 'siri male',
];

function isFemaleVoice(v) {
    const n = (v.name || '').toLowerCase();
    if (KNOWN_MALE_NAMES.some((tag) => n.includes(tag))) return false;
    if (KNOWN_FEMALE_NAMES.some((tag) => n.includes(tag))) return true;
    return false; // unknown → treat as not-female so we don't mispick
}

function pickVoice(voices, preferFemale = true) {
    if (!voices || !voices.length) return null;

    // Search ladder, in order — first match wins. We loop through
    // [female-preferred pool, then anything] so a female en-IN beats
    // a male en-IN beats any en-IN, etc.
    const pools = preferFemale
        ? [voices.filter(isFemaleVoice), voices]
        : [voices];

    for (const pool of pools) {
        if (!pool.length) continue;

        // Tier 1: exact en-IN match (Indian English voice).
        const inIN = pool.find((v) => v.lang === 'en-IN');
        if (inIN) return inIN;

        // Tier 2: voice name claims India / Hindi origin.
        const indianish = pool.find((v) => {
            const n = (v.name || '').toLowerCase();
            const l = (v.lang || '').toLowerCase();
            return n.includes('india') || n.includes('hindi') || l.startsWith('hi');
        });
        if (indianish) return indianish;

        // Tier 3: British English — closer to Indian English than US.
        const inGB = pool.find((v) => v.lang === 'en-GB');
        if (inGB) return inGB;

        // Tier 4: US English.
        const inUS = pool.find((v) => v.lang === 'en-US');
        if (inUS) return inUS;

        // Tier 5: any English variant.
        const anyEn = pool.find((v) => (v.lang || '').toLowerCase().startsWith('en'));
        if (anyEn) return anyEn;
    }

    return voices[0];
}

/**
 * Inspect what voices are available on this device. Useful for
 * debugging "why does ASTRA mispronounce my name?" — usually means
 * the device doesn't have the en-IN voice pack installed.
 *
 * Returns:
 *   {
 *     selectedVoice: { name, lang } | null,
 *     hasEnIN: boolean,
 *     enINVoices: [{name, lang}],
 *     allVoices: [{name, lang}],
 *   }
 */
export async function describeAvailableVoices(preferFemale = true) {
    const voices = await ensureVoices();
    const selected = pickVoice(voices, preferFemale);
    const enIN = voices.filter((v) => v.lang === 'en-IN');
    return {
        selectedVoice: selected
            ? { name: selected.name, lang: selected.lang }
            : null,
        hasEnIN: enIN.length > 0,
        enINVoices: enIN.map((v) => ({ name: v.name, lang: v.lang })),
        allVoices: voices.map((v) => ({ name: v.name, lang: v.lang })),
    };
}

/**
 * Pronunciation overrides — phonetic respellings the TTS engine
 * reads more accurately than the original spelling. Necessary because
 * Google's en-IN voice doesn't ship with a lexicon of Indian names
 * (and many other engines don't either), so names like "Sathwik" get
 * spelled out using English vowel reduction rules and come out as
 * "Sutwik".
 *
 * Add entries here as you discover mispronunciations. The map is
 * applied with word-boundary, case-insensitive matching — so
 * "Sathwik" and "sathwik" and "SATHWIK" all get replaced, but
 * "Sathwik123" wouldn't.
 *
 * Format: { lowercase_name: phonetic_respelling }
 *
 * Tips for choosing respellings:
 *   - Hyphens force the engine to break syllables: "Saath-vik"
 *   - Double letters cue length: "Saatvik" reads longer than "Satvik"
 *   - English-style vowels often work better than Indian phonetic:
 *     "v" usually safer than "w" for the /v/-like Indian sound
 *   - Test on the actual device — different engines react differently
 */
const PRONUNCIATION_OVERRIDES = {
    // Sutwik → wanted: SAATH-vik (long a + soft t-h + v sound)
    'sathwik': 'Saathvik',
};

function applyPronunciations(text) {
    if (!text) return text;
    let out = String(text);
    for (const [from, to] of Object.entries(PRONUNCIATION_OVERRIDES)) {
        // Word-boundary, case-insensitive. Escape any regex chars
        // in the key (paranoia — current keys are plain ASCII).
        const safe = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\b${safe}\\b`, 'gi');
        out = out.replace(re, to);
    }
    return out;
}

/**
 * Split a long string into sentence-sized chunks. Browser TTS on
 * Android Chromium cuts off utterances longer than ~15 seconds (a
 * 200+ character paragraph), and when it cuts off the `onend` event
 * sometimes doesn't fire — leaving callers waiting on a Promise that
 * will never resolve. Speaking sentence-by-sentence keeps each
 * utterance under the limit and ensures every one finishes cleanly.
 *
 * Split rules: end of sentence on `.`, `!`, `?`, `…`, or newline.
 * We don't split on commas because those represent mid-thought pauses
 * that should be left to the engine's prosody.
 */
function splitIntoSentences(text) {
    if (!text) return [];
    // Conservative split — keep punctuation glued to the preceding
    // sentence so the engine still reads it with the right intonation.
    const raw = String(text)
        .split(/(?<=[.!?…])\s+|\n+/g)
        .map((s) => s.trim())
        .filter(Boolean);

    // Merge tiny fragments (< 4 chars) onto the previous sentence so
    // "Mr. Smith said hi." doesn't become ["Mr.", "Smith said hi."].
    const merged = [];
    for (const piece of raw) {
        if (merged.length && piece.length < 4) {
            merged[merged.length - 1] += ' ' + piece;
        } else {
            merged.push(piece);
        }
    }
    return merged;
}

/**
 * Speak ONE sentence and resolve when it finishes (or times out).
 * Used as the building block for the public `speak()` function.
 *
 * Why a timeout: Android Chromium occasionally drops `utterance.onend`
 * for utterances that get pause/resume'd by our keep-alive trick, so
 * the Promise would hang. We calculate an expected duration from the
 * text length (≈ 80 ms per character at rate 1.0, scaled by the
 * actual rate) and add a 2-second safety buffer. If onend never fires
 * by that deadline, we resolve anyway so the conversation can move on.
 */
function speakSentence(sentence, voice, opts) {
    return new Promise((resolve) => {
        try {
            const utterance = new SpeechSynthesisUtterance(sentence);
            if (voice) utterance.voice = voice;
            utterance.lang = opts.lang;
            utterance.rate = opts.rate;
            utterance.pitch = opts.pitch;
            utterance.volume = opts.volume;
            if (opts.onBoundary) utterance.onboundary = opts.onBoundary;

            let settled = false;
            const settle = (result) => {
                if (settled) return;
                settled = true;
                clearTimeout(safety);
                resolve(result);
            };

            utterance.onend = () => settle({ ok: true });
            utterance.onerror = (e) =>
                settle({ ok: false, reason: e?.error || 'tts-error' });

            // Hard timeout fallback. Estimate ~80 ms per character at
            // rate 1.0, scale inversely to actual rate, + 2 s safety
            // buffer + 1 s for the keep-alive pause/resume overhead.
            const expectedMs =
                Math.ceil((sentence.length * 80) / Math.max(opts.rate, 0.5)) + 3000;
            const safety = setTimeout(
                () => settle({ ok: true, reason: 'timeout' }),
                expectedMs
            );

            window.speechSynthesis.speak(utterance);
        } catch (err) {
            resolve({ ok: false, reason: err?.message || 'tts-throw' });
        }
    });
}

/**
 * Speak the given text aloud using the device's built-in TTS engine.
 *
 * Returns a Promise that resolves when speech ends (or errors).
 * Resolves to `{ ok: true }` on success, `{ ok: false, reason }`
 * otherwise — callers can use the boolean to decide whether to
 * fall back to a cloud-TTS audio blob.
 *
 * Long text is split sentence-by-sentence so the Chromium 15-second
 * cutoff bug never bites. Each sentence has its own timeout safety
 * net, so the Promise is guaranteed to resolve in bounded time even
 * on engines that swallow `onend`.
 *
 * Options:
 *   - rate: 0.5–2.0, default 1.0
 *   - pitch: 0–2, default 1.0
 *   - volume: 0–1, default 1.0
 *   - lang: BCP-47 hint, default 'en-IN'
 *   - preferFemale: try to pick a female voice (default true for ASTRA)
 *   - onBoundary: optional callback for word-by-word highlighting
 */
export async function speak(text, options = {}) {
    if (!isBrowserTTSAvailable() || !text) {
        return { ok: false, reason: 'unavailable' };
    }

    const {
        rate = 1.0,
        pitch = 1.0,
        volume = 1.0,
        lang = 'en-IN',
        preferFemale = true,
        onBoundary,
    } = options;

    // Cancel any in-flight utterance — otherwise speak() queues and
    // the user hears the previous ASTRA reply still finishing while
    // their new one is starting.
    // Chrome bug workaround: canceling requires a brief delay before speaking again.
    try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            window.speechSynthesis.cancel();
            await new Promise((r) => setTimeout(r, 50));
        }
    } catch (e) {}

    const voices = await ensureVoices();
    const voice = pickVoice(voices, preferFemale);

    // Diagnostic so anyone debugging "why does ASTRA sound American?"
    // can immediately see whether we got an en-IN voice or fell back.
    if (voice) {
        const isIndian = voice.lang === 'en-IN' ||
            (voice.name || '').toLowerCase().includes('india');
        console.log(
            `[ASTRA TTS] using ${voice.name} (${voice.lang})${isIndian ? ' ✓ Indian-English' : ' ⚠ NOT Indian-English — install en-IN voice pack for best results'}`
        );
    } else {
        console.warn('[ASTRA TTS] no voice selected — engine default will be used');
    }

    // Apply pronunciation overrides BEFORE sentence splitting so the
    // substitution doesn't accidentally cross a sentence boundary.
    const phonetic = applyPronunciations(text);
    if (phonetic !== text) {
        console.log('[ASTRA TTS] phonetic respellings applied:', phonetic);
    }

    const sentences = splitIntoSentences(phonetic);
    if (sentences.length === 0) {
        return { ok: false, reason: 'empty' };
    }

    const opts = { rate, pitch, volume, lang, onBoundary };

    // Speak each sentence sequentially. If one errors out, we bail
    // and report the failure — callers can fall back to cloud audio.
    // A timeout-resolved sentence still counts as ok so the chain
    // continues; speech may have been chopped on that one sentence
    // but the next will start fresh.
    for (let i = 0; i < sentences.length; i++) {
        const result = await speakSentence(sentences[i], voice, opts);
        if (!result.ok && result.reason !== 'timeout') {
            return {
                ok: false,
                reason: result.reason,
                voice: voice ? { name: voice.name, lang: voice.lang } : null,
            };
        }
    }
    return {
        ok: true,
        voice: voice ? { name: voice.name, lang: voice.lang } : null,
    };
}

/**
 * Immediately stop any speech in progress. Safe to call at any time.
 */
export function stopSpeaking() {
    if (!isBrowserTTSAvailable()) return;
    try { window.speechSynthesis.cancel(); } catch (e) {}
}
