import { getFirestore, Timestamp } from 'firebase-admin/firestore';

async function logTelemetry(eventData) {
    try {
        const firestore = getFirestore();
        await firestore.collection('apiTelemetry').add({
            timestamp: Timestamp.now(),
            ...eventData
        });
    } catch (err) {
        console.error('[groqFallback] Failed to log telemetry:', err);
    }
}

const DEFAULT_CHAIN = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
];

const FALLBACK_STATUSES = new Set([400, 401, 403, 404, 408, 422, 429, 500, 502, 503, 504]);
const RETRY_STATUSES = new Set([429, 502, 503, 504]);

// ── Circuit Breaker ───────────────────────────────────────────────────────────
// Prevents hammering a model that is already known to be down.
// After CIRCUIT_OPEN_THRESHOLD consecutive failures the circuit opens and
// the model is skipped entirely for CIRCUIT_RESET_MS milliseconds.
// This saves ~1-2s per request during outages and stops cascade failures.
const CB_STATE = new Map(); // model → { failures, openedAt }
const CIRCUIT_OPEN_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 5 * 60 * 1000; // 5 minutes

function isCircuitOpen(model) {
    const s = CB_STATE.get(model);
    if (!s || s.failures < CIRCUIT_OPEN_THRESHOLD) return false;
    if (Date.now() - s.openedAt >= CIRCUIT_RESET_MS) {
        CB_STATE.delete(model); // half-open: allow one test request
        return false;
    }
    return true;
}

function recordFailure(model) {
    const s = CB_STATE.get(model) || { failures: 0, openedAt: 0 };
    s.failures++;
    if (s.failures === CIRCUIT_OPEN_THRESHOLD) {
        s.openedAt = Date.now();
        console.warn(`[CircuitBreaker] OPEN for "${model}" after ${s.failures} failures. Skipping for ${CIRCUIT_RESET_MS / 60000}min.`);
    }
    CB_STATE.set(model, s);
}

function recordSuccess(model) {
    if (CB_STATE.has(model)) {
        console.log(`[CircuitBreaker] CLOSED for "${model}" — recovered.`);
        CB_STATE.delete(model);
    }
}

/**
 * Robust retry wrapper with exponential backoff for transient API errors
 */
async function retryWithBackoff(fn, retries = 3, delay = 500, backoffFactor = 2) {
    let attempt = 0;
    while (attempt < retries) {
        try {
            return await fn();
        } catch (err) {
            attempt++;
            const status = err?.status ?? err?.response?.status ?? err?.statusCode;
            const isTransient = RETRY_STATUSES.has(status) || (err?.message && (
                err.message.includes('429') ||
                err.message.includes('502') ||
                err.message.includes('503') ||
                err.message.includes('504') ||
                err.message.toLowerCase().includes('rate limit') ||
                err.message.toLowerCase().includes('timeout')
            ));
            
            if (!isTransient || attempt >= retries) {
                throw err;
            }
            
            const waitTime = delay * Math.pow(backoffFactor, attempt - 1);
            console.warn(`[groqFallback][Retry] Attempt ${attempt} failed (status=${status || 'unknown'}). Retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

/**
 * Direct REST API client for Google Gemini 1.5 Flash
 */
export async function callGeminiAPI(apiKey, params) {
    const model = params?.model || 'gemini-2.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const contents = [];
    let systemInstructionText = '';
    
    const messages = params.messages || [];
    for (const msg of messages) {
        if (msg.role === 'system') {
            systemInstructionText += (systemInstructionText ? '\n' : '') + msg.content;
            continue;
        }
        
        const role = msg.role === 'assistant' ? 'model' : 'user';
        const parts = [];
        
        if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
                if (part.type === 'text') {
                    parts.push({ text: part.text });
                } else if (part.type === 'image_url' && part.image_url?.url) {
                    const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
                    if (match) {
                        parts.push({
                            inlineData: {
                                mimeType: match[1],
                                data: match[2]
                            }
                        });
                    }
                }
            }
        } else {
            parts.push({ text: msg.content });
        }
        
        // Merge consecutive roles to avoid Gemini API 400 errors (roles must strictly alternate)
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
            contents[contents.length - 1].parts.push(...parts);
        } else {
            contents.push({ role, parts });
        }
    }
    
    // Ensure the conversation starts with a 'user' role message (Gemini validation requirement)
    if (contents.length > 0 && contents[0].role === 'model') {
        contents.unshift({ role: 'user', parts: [{ text: 'Hello' }] });
    }
    
    const requestBody = { contents };
    
    if (systemInstructionText) {
        requestBody.systemInstruction = {
            parts: [{ text: systemInstructionText }]
        };
    }
    
    const isJson = params.response_format?.type === 'json_object';
    requestBody.generationConfig = {
        temperature: params.temperature ?? 0.7,
        maxOutputTokens: params.max_tokens ?? 1024,
        ...(isJson ? { responseMimeType: 'application/json' } : {})
    };
    
    const response = await retryWithBackoff(async () => {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            const err = new Error(`Gemini API error: ${res.status} ${res.statusText} - ${errorText}`);
            err.status = res.status;
            throw err;
        }
        return res;
    });
    
    const result = await response.json();
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return {
        choices: [
            {
                message: {
                    role: 'assistant',
                    content: responseText
                }
            }
        ]
    };
}

/**
 * Run a chat completion with automatic Groq-to-Gemini fallback routing.
 */
export async function chatWithFallback(groqClients, params, opts = {}) {
    const chain = (opts.chain && opts.chain.length) ? opts.chain : DEFAULT_CHAIN;
    const { free } = groqClients;
    let lastErr = null;

    // --- TIER 1: GROQ FREE ---
    for (const model of chain) {
        // Skip model if circuit is open (too many recent failures)
        if (isCircuitOpen(model)) {
            console.warn(`[groqFallback][CircuitBreaker] Skipping "${model}" — circuit is OPEN.`);
            continue;
        }

        try {
            const completion = await retryWithBackoff(async () => {
                return await free.chat.completions.create({ ...params, model });
            });
            recordSuccess(model); // reset failure counter on success
            if (model !== chain[0]) {
                console.warn(`[groqFallback][FREE] Used backup model "${model}" after upstream failures`);
                await logTelemetry({
                    type: 'model_switch',
                    primaryModel: chain[0],
                    backupModel: model,
                    tier: 'free',
                    status: 'success'
                });
            }
            return { completion, modelUsed: model, tier: 'free' };
        } catch (err) {
            const status = err?.status ?? err?.response?.status;
            const transient = !status || FALLBACK_STATUSES.has(status);
            console.warn(`[groqFallback][FREE] model="${model}" failed status=${status || 'undefined'} transient=${transient}: ${err?.message || err}`);
            
            recordFailure(model); // advance circuit breaker counter

            await logTelemetry({
                type: 'model_error',
                model: model,
                status: status || null,
                transient: transient,
                errorMessage: err?.message || String(err),
                tier: 'free'
            });

            lastErr = err;
            if (!transient) throw err; // Real validation bug — fail early
        }
    }

    // --- TIER 2: GEMINI FALLBACK (PAID/PAY-AS-YOU-GO) ---
    const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (geminiApiKey) {
        const fallbackModel = params?.model || 'gemini-2.5-flash-lite';
        console.warn(`[groqFallback] Free tier exhausted. Switching to Gemini fallback (${fallbackModel}).`);
        
        await logTelemetry({
            type: 'tier_fallback',
            primaryTier: 'free',
            fallbackTier: 'gemini-fallback',
            fallbackModel: fallbackModel,
            reason: lastErr?.message || 'Free models exhausted'
        });

        try {
            const completion = await callGeminiAPI(geminiApiKey, params);
            
            await logTelemetry({
                type: 'fallback_success',
                model: fallbackModel,
                tier: 'gemini-fallback'
            });

            return { completion, modelUsed: fallbackModel, tier: 'gemini-fallback' };
        } catch (err) {
            console.error(`[groqFallback][GEMINI] fallback failed: ${err?.message || err}`);
            
            await logTelemetry({
                type: 'fallback_error',
                model: fallbackModel,
                tier: 'gemini-fallback',
                errorMessage: err?.message || String(err)
            });

            lastErr = err;
        }
    }

    // All tiers and fallbacks failed.
    const allFailedErr = new Error(`All AI models and fallbacks failed. Last error: ${lastErr?.message || 'unknown'}`);
    allFailedErr.status = lastErr?.status ?? 500;
    allFailedErr.cause = lastErr;
    
    await logTelemetry({
        type: 'all_failed',
        errorMessage: allFailedErr.message,
        status: allFailedErr.status
    });

    throw allFailedErr;
}

export const GROQ_MODEL_CHAIN = DEFAULT_CHAIN;
