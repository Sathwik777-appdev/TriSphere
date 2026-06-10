import textToSpeech from '@google-cloud/text-to-speech';
import fs from 'fs-extra';
import path from 'path';

const client = new textToSpeech.TextToSpeechClient();

/**
 * Generates speech from text using Google Cloud Text-to-Speech
 * @param {string} text - The text to synthesize
 * @param {string} outputPath - Path to save the audio file
 * @param {string} lang - Language code (default 'en-US')
 * @param {string} gender - 'male' or 'female' (default 'female')
 * @returns {Promise<boolean>}
 */
export async function generateSpeech(text, outputPath, lang = 'en-US', gender = 'female') {
    try {
        console.log(`Generating speech with Google Cloud TTS (Node.js)...`);
        
        // Map common codes
        let languageCode = lang || 'en-US';
        if (languageCode === 'en') languageCode = 'en-US';

        // Select the voice based on gender and language
        // This is a basic mapping, for production we could have a more robust voice map
        let voiceName = gender === 'male' ? `${languageCode}-Wavenet-B` : `${languageCode}-Wavenet-D`;
        
        // Neural2 voices are only available in some languages
        if (languageCode === 'en-US') {
            voiceName = gender === 'male' ? 'en-US-Neural2-D' : 'en-US-Neural2-F';
        }

        const ssmlGender = gender === 'male' ? 'MALE' : 'FEMALE';

        const request = {
            input: { text: text },
            voice: { languageCode, name: voiceName, ssmlGender: ssmlGender },
            audioConfig: { audioEncoding: 'LINEAR16', speakingRate: 1.0, pitch: 0 },
        };

        const [response] = await client.synthesizeSpeech(request);
        
        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeFile(outputPath, response.audioContent, 'binary');
        
        console.log(`Speech generated successfully at: ${outputPath}`);
        return true;
    } catch (error) {
        console.error('Error in Google Cloud TTS:', error);
        return false;
    }
}
