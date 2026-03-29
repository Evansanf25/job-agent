require('dotenv').config();
const express = require('express');
const path = require('path');
const { pool, initDb } = require('./db');
const { analyzeJD, draftCoverLetter, searchJobs } = require('./claude');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Serve React frontend from client/build
const buildPath = path.join(__dirname, '../client/build');
app.use(express.static(buildPath));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Search jobs (generates realistic listings)
app.post('/api/search', async (req, res) => {
  try {
    const { query, location, level } = req.body;
    const jobs = await searchJobs(query, location, level);
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

    const analysis = await analyzeJD(jdText);

    // Save to DB
    const result = await pool.query(
      `INSERT INTO applications (title, company, location, salary, score, fit_summary, strengths, gaps, keywords, jd_text, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'saved')
       RETURNING *`,
      [
        analysis.title, analysis.company, analysis.location, analysis.salary,
        analysis.score, analysis.fit_summary, analysis.strengths,
        analysis.gaps, of.analysis.keywords, jdText
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
      gaps: app_record.gaps, keywords: app_record.keywords,
    };

    const letter = await draftCoverLetter(app_record, analysis);

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
