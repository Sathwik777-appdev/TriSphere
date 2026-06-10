import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { chatWithFallback, callGeminiAPI } from './utils/groqFallback.js';

dotenv.config();

const groqKey = (process.env.GROQ_API_KEY || '').trim();
const geminiKey = (process.env.GEMINI_API_KEY || '').trim();

console.log('Keys loaded:');
console.log('Groq Key length:', groqKey.length);
console.log('Gemini Key length:', geminiKey.length);

if (!groqKey) {
    console.error('ERROR: GROQ_API_KEY is not defined in .env');
    process.exit(1);
}

if (!geminiKey) {
    console.error('ERROR: GEMINI_API_KEY is not defined in .env');
    process.exit(1);
}

const groqFree = new Groq({ apiKey: groqKey });
const groqClients = { free: groqFree, paid: null };

async function runTests() {
    console.log('\n--- 1. Testing Groq Llama 3.3 70B (Primary) ---');
    try {
        const result = await chatWithFallback(
            groqClients,
            {
                messages: [{ role: 'user', content: 'Say hello in exactly 3 words.' }],
                max_tokens: 50
            },
            { chain: ['llama-3.3-70b-versatile'] }
        );
        console.log('Success! Model used:', result.modelUsed);
        console.log('Response:', result.completion.choices[0].message.content);
    } catch (err) {
        console.error('Groq Primary Test Failed:', err.message);
    }

    console.log('\n--- 2. Testing Groq Llama 3.1 8B (Backup) ---');
    try {
        const result = await chatWithFallback(
            groqClients,
            {
                messages: [{ role: 'user', content: 'Say hello in exactly 3 words.' }],
                max_tokens: 50
            },
            { chain: ['llama-3.1-8b-instant'] }
        );
        console.log('Success! Model used:', result.modelUsed);
        console.log('Response:', result.completion.choices[0].message.content);
    } catch (err) {
        console.error('Groq Backup Test Failed:', err.message);
    }

    console.log('\n--- 3. Testing Gemini API Direct Call (Fallback) ---');
    try {
        const result = await callGeminiAPI(geminiKey, {
            messages: [{ role: 'user', content: 'Say hello in exactly 3 words.' }],
            max_tokens: 50
        });
        console.log('Success! Response:', result.choices[0].message.content);
    } catch (err) {
        console.error('Gemini Fallback Test Failed:', err.message);
    }
}

runTests();
