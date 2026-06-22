const { AssemblyAI } = require('assemblyai');
require('dotenv').config();

/**
 * Uploads audio file and transcribes it using AssemblyAI
 * @param {string} filePath - Absolute path to the temporary audio file
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(filePath) {
  console.log(`[AssemblyAI] Starting transcription process for file: ${filePath}`);
  
  if (!process.env.ASSEMBLYAI_API_KEY) {
    throw new Error('ASSEMBLYAI_API_KEY is not configured in the environment.');
  }

  const client = new AssemblyAI({
    apiKey: process.env.ASSEMBLYAI_API_KEY
  });

  // Step 1: Upload the audio file to AssemblyAI
  console.log('[AssemblyAI] Uploading audio file...');
  const uploadUrl = await client.files.upload(filePath);
  console.log(`[AssemblyAI] Upload completed. Remote URL: ${uploadUrl}`);

  // Step 2: Create a transcription job
  console.log('[AssemblyAI] Submitting transcript job (Vietnamese)...');
  let transcript = await client.transcripts.create({
    audio_url: uploadUrl,
    language_code: 'vi' // Forces Vietnamese transcription
  });
  const transcriptId = transcript.id;
  console.log(`[AssemblyAI] Job submitted successfully. Transcript ID: ${transcriptId}`);

  // Step 3: Poll status until complete or error, with a 3-minute timeout
  const startTime = Date.now();
  const pollingTimeout = 3 * 60 * 1000; // 3 minutes in milliseconds
  const pollInterval = 3000; // 3 seconds interval

  while (true) {
    // Check timeout
    if (Date.now() - startTime > pollingTimeout) {
      console.error('[AssemblyAI] Polling timed out (3-minute limit reached)');
      throw new Error('AssemblyAI transcription polling timed out after 3 minutes.');
    }

    // Get current transcript details
    transcript = await client.transcripts.get(transcriptId);
    console.log(`[AssemblyAI] Job status: ${transcript.status}`);

    if (transcript.status === 'completed') {
      console.log('[AssemblyAI] Transcription completed successfully.');
      return transcript.text;
    } else if (transcript.status === 'error') {
      console.error(`[AssemblyAI] Transcription failed: ${transcript.error}`);
      throw new Error(`AssemblyAI transcription failed: ${transcript.error}`);
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
}

module.exports = {
  transcribeAudio
};
