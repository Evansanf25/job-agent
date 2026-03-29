const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT,
      salary TEXT,
      url TEXT,
      score INTEGER,
      fit_summary TEXT,
      strengths TEXT[],
      gaps TEXT[],
      keywords TEXT[],
      cover_letter TEXT,
      status TEXT DEFAULT 'saved',
      notes TEXT,
      jd_text TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('Database initialized');
}

module.exports = { pool, initDb };
