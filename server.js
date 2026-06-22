const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDb } = require('./services/db');
const meetingsRouter = require('./routes/meetings');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all origins
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routing
app.use('/api/meetings', meetingsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'AI Meeting Assistant Backend is running' });
});

// Default 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint không tồn tại.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error] Global error caught:', err.stack);
  res.status(500).json({ error: 'Đã xảy ra lỗi hệ thống.' });
});

// Start server after DB initialization
async function startServer() {
  try {
    // 1. Initialize the database table if it doesn't exist
    await initDb();
    
    // 2. Start listening
    app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(`[Server] running on port ${PORT}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/health`);
      console.log(`=================================================`);
    });
  } catch (error) {
    console.error('[Server] Critical error starting application:', error.message);
    process.exit(1);
  }
}

startServer();
