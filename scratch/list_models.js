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

async function run() {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('No GEMINI_API_KEY found in backend/.env');
        return;
    }
    console.log('Querying models using API key starting with:', apiKey.substring(0, 10));
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`HTTP error: ${res.status} ${res.statusText}`);
            const body = await res.text();
            console.error('Response body:', body);
            return;
        }
        const data = await res.json();
        console.log('Available Models:');
        if (data.models) {
            data.models.forEach(m => {
                console.log(`- ${m.name} (${m.displayName})`);
            });
        } else {
            console.log('No models found, response:', data);
        }
    } catch (err) {
        console.error('Error fetching models:', err);
    }
}

run();
