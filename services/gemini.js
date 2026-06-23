const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

if (!process.env.GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY is not set in environment variables.');
}

// Initialize Gemini Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Generates a meeting summary based on transcription text using Gemini
 * @param {string} transcriptText - The transcribed text of the meeting
 * @returns {Promise<string>} - Formatted meeting summary
 */
async function generateMeetingSummary(transcriptText) {
  console.log('[Gemini] Generating summary from transcript using gemini-3.5-flash...');
  
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in the environment.');
  }

  const prompt = `Bạn là trợ lý hãy tóm tắt nội dung chính cuộc họp. Dựa trên transcript sau, hãy tóm tắt và sinh biên bản họp gồm các phần: Thời gian, Nội dung chính (bullet points) nếu có, Quyết định đã đưa ra nếu có, Việc cần làm (action items) kèm người phụ trách nếu có. Transcript: ${transcriptText}`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();
    
    console.log('[Gemini] Summary generated successfully.');
    return summary;
  } catch (error) {
    console.error('[Gemini] Error generating summary:', error.message);
    throw error;
  }
}

module.exports = {
  generateMeetingSummary
};
