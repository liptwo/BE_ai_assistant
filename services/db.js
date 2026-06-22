const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('WARNING: DATABASE_URL is not set in environment variables.');
}

// Config PostgreSQL connection pool with SSL required for Render
const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * Initialize the database: create table if not exists
 */
async function initDb() {
  console.log('[DB] Initializing database...');
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      transcript TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;
  
  try {
    const client = await pool.connect();
    console.log('[DB] Connected to PostgreSQL successfully.');
    await client.query(createTableQuery);
    console.log('[DB] "meetings" table verified/created.');
    client.release();
  } catch (error) {
    console.error('[DB] Error initializing database:', error.message);
    throw error;
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDb
};
