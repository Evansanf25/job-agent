require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { pool, initDb } = require('./db');
const { analyzeJD, draftCoverLetter, searchJobs } = require('./claude');

const app = express();
const PORT = process.env.PORT || 3001;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());

// Serve React frontend from client/build
const buildPath = path.join(__dirname, '../client/build');
app.use(express.static(buildPath));

// Helper: get current resume text from DB
async function getResume() {
  const { rows } = await pool.query('SELECT text FROM resume ORDER BY uploaded_at DESC LIMIT 1');
  return rows.length ? rows[0].text : null;
}

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Upload resume (PDF or plain text)
app.post('/api/resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let text;
    const mime = req.file.mimetype;

    if (mime === 'application/pdf') {
      const parsed = await pdfParse(req.file.buffer);
      text = parsed.text;
    } else if (mime === 'text/plain') {
      text = req.file.buffer.toString('utf-8');
    } else {
      return res.status(400).json({ error: 'Only PDF or .txt files are supported' });
    }

    if (!text || text.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract enough text from the file' });
    }

    await pool.query(
      'INSERT INTO resume (text, filename) VALUES ($1, $2)',
      [text.trim(), req.file.originalname]
    );

    res.json({ success: true, preview: text.trim().slice(0, 300) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Resume upload failed' });
  }
});

// Get current resume
app.get('/api/resume', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, filename, uploaded_at, LEFT(text, 500) as preview FROM resume ORDER BY uploaded_at DESC LIMIT 1'
    );
    if (!rows.length) return res.json({ resume: null });
    res.json({ resume: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch resume' });
  }
});

// Search jobs (generates realistic listings)
app.post('/api/search', async (req, res) => {
  try {
    const { query, location, level } = req.body;
    const resumeText = await getResume();
    const jobs = await searchJobs(query, location, level, resumeText);
    res.json({ jobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Analyze a pasted job description
app.post('/api/analyze', async (req, res) => {
  try {
    const { jdText } = req.body;
    if (!jdText) return res.status(400).json({ error: 'jdText is required' });

    const resumeText = await getResume();
    const analysis = await analyzeJD(jdText, resumeText);

    // Save to DB
    const result = await pool.query(
      `INSERT INTO applications (title, company, location, salary, score, fit_summary, strengths, gaps, keywords, jd_text, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'saved')
       RETURNING *`,
      [
        analysis.title, analysis.company, analysis.location, analysis.salary,
        analysis.score, analysis.fit_summary, analysis.strengths,
        analysis.gaps, analysis.keywords, jdText
      ]
    );

    res.json({ application: result.rows[0], analysis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// Draft cover letter for a saved application
app.post('/api/applications/:id/cover-letter', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM applications WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });

    const app_record = rows[0];
    const analysis = {
      strengths: app_record.strengths,
      gaps: app_record.gaps,
      keywords: app_record.keywords,
    };

    const resumeText = await getResume();
    const letter = await draftCoverLetter(app_record, analysis, resumeText);

    await pool.query(
      'UPDATE applications SET cover_letter = $1, updated_at = NOW() WHERE id = $2',
      [letter, id]
    );

    res.json({ cover_letter: letter });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Cover letter generation failed' });
  }
});

// Get all saved applications
app.get('/api/applications', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM applications ORDER BY created_at DESC'
    );
    res.json({ applications: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Update application status or notes
app.patch('/api/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, url } = req.body;

    const { rows } = await pool.query(
      `UPDATE applications
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           url = COALESCE($3, url),
           updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status, notes, url, id]
    );

    res.json({ application: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Delete an application
app.delete('/api/applications/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM applications WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// All non-API routes serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

initDb().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
