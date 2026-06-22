const express = require('express');
const router = express.Router();
const multer = require('multer');
const os = require('os');
const path = require('path');
const fs = require('fs');

const { transcribeAudio } = require('../services/assemblyai');
const { generateMeetingSummary } = require('../services/gemini');
const db = require('../services/db');

// Multer storage configuration: Use system temp directory
const uploadDir = os.tmpdir();
console.log(`[Multer] Storing temporary upload files in: ${uploadDir}`);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter: accept only audio formats (mp3, wav, m4a)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.mp3', '.wav', '.m4a'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận định dạng audio (mp3, wav, m4a).'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // Limit to 25MB
  },
  fileFilter: fileFilter
}).single('audio');

/**
 * Helper to delete a file safely
 */
function deleteTempFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`[Cleanup] Deleted temporary file: ${filePath}`);
    } catch (err) {
      console.error(`[Cleanup] Error deleting file ${filePath}:`, err.message);
    }
  }
}

/**
 * 1. POST /api/meetings/upload
 * Processes audio upload, transcription, summarization, and database save.
 */
router.post('/upload', (req, res) => {
  upload(req, res, async (err) => {
    // Handle Multer upload errors
    if (err) {
      console.error('[Upload] Multer error:', err.message);
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      console.warn('[Upload] Request received without file.');
      return res.status(400).json({ error: 'Vui lòng cung cấp file audio trong trường "audio".' });
    }

    const tempFilePath = req.file.path;
    const originalName = req.file.originalname;

    try {
      // 1. Send file to AssemblyAI for transcription
      console.log(`[Upload] Start processing "${originalName}"`);
      let transcriptText;
      try {
        transcriptText = await transcribeAudio(tempFilePath);
      } catch (transcribeError) {
        console.error('[Upload] AssemblyAI transcription error:', transcribeError.message);
        return res.status(502).json({ error: `AssemblyAI error: ${transcribeError.message}` });
      }

      // 2. Generate summary using Gemini
      let summaryText;
      try {
        summaryText = await generateMeetingSummary(transcriptText);
      } catch (geminiError) {
        console.error('[Upload] Gemini summary generation error:', geminiError.message);
        return res.status(502).json({ error: `Gemini error: ${geminiError.message}` });
      }

      // 3. Save to PostgreSQL database
      console.log('[Upload] Saving meeting record to PostgreSQL...');
      const insertQuery = `
        INSERT INTO meetings (filename, transcript, summary)
        VALUES ($1, $2, $3)
        RETURNING id, filename, transcript, summary, created_at;
      `;
      
      let savedMeeting;
      try {
        const result = await db.query(insertQuery, [originalName, transcriptText, summaryText]);
        savedMeeting = result.rows[0];
        console.log(`[Upload] Saved meeting successfully. DB ID: ${savedMeeting.id}`);
      } catch (dbError) {
        console.error('[Upload] Database error:', dbError.message);
        return res.status(500).json({ error: `Database error: ${dbError.message}` });
      }

      // Response
      return res.status(201).json({
        id: savedMeeting.id,
        transcript: savedMeeting.transcript,
        summary: savedMeeting.summary,
        created_at: savedMeeting.created_at
      });

    } catch (unexpectedError) {
      console.error('[Upload] Unexpected backend error:', unexpectedError.message);
      return res.status(500).json({ error: `Server error: ${unexpectedError.message}` });
    } finally {
      // Clean up temporary audio file
      deleteTempFile(tempFilePath);
    }
  });
});

/**
 * 2. GET /api/meetings
 * Returns list of all meetings sorted by created_at desc (excluding full transcripts).
 */
router.get('/', async (req, res) => {
  console.log('[Meetings] Fetching list of all meetings...');
  const selectQuery = `
    SELECT id, filename, summary, created_at 
    FROM meetings 
    ORDER BY created_at DESC;
  `;
  try {
    const result = await db.query(selectQuery);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('[Meetings] Database error while fetching list:', error.message);
    return res.status(500).json({ error: `Database error: ${error.message}` });
  }
});

/**
 * 3. GET /api/meetings/:id
 * Returns full details of a single meeting (including transcript).
 */
router.get('/:id', async (req, res) => {
  const meetingId = req.params.id;
  console.log(`[Meetings] Fetching meeting details for ID: ${meetingId}`);
  
  const selectQuery = `
    SELECT id, filename, transcript, summary, created_at 
    FROM meetings 
    WHERE id = $1;
  `;
  try {
    const result = await db.query(selectQuery, [meetingId]);
    if (result.rows.length === 0) {
      console.warn(`[Meetings] Meeting ID ${meetingId} not found.`);
      return res.status(404).json({ error: 'Không tìm thấy cuộc họp yêu cầu.' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`[Meetings] Database error while fetching ID ${meetingId}:`, error.message);
    return res.status(500).json({ error: `Database error: ${error.message}` });
  }
});

module.exports = router;
