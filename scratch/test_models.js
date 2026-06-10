const fs = require('fs');
const path = require('path');

// Simple env parser
const envPath = path.join(__dirname, '../backend/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        env[match[1]] = val.trim();
    }
});

const modelsToTest = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash'
];

async function testModel(modelName, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const requestBody = {
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
    };
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            console.log(`✅ ${modelName} works! Response: "${text.trim().substring(0, 40)}..."`);
            return true;
        } else {
            const body = await res.text();
            console.log(`❌ ${modelName} failed: ${res.status} ${res.statusText}`);
            return false;
        }
    } catch (err) {
        console.log(`❌ ${modelName} exception:`, err.message);
        return false;
    }
}

async function run() {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('No GEMINI_API_KEY found in backend/.env');
        return;
    }
    console.log('Testing models...');
    for (const model of modelsToTest) {
        await testModel(model, apiKey);
    }
}

run();
