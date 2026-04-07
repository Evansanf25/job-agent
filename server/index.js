require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { pool, initDb } = require('./db');
const { analyzeJD, draftCoverLetter, scoreJobsAgainstResume, extractSearchQueries } = require('./claude');

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

// Helper: format salary range from JSearch response
function formatSalary(j) {
  if (!j.job_min_salary && !j.job_max_salary) return null;
  const fmt = n => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;
  if (j.job_min_salary && j.job_max_salary) return `${fmt(j.job_min_salary)}–${fmt(j.job_max_salary)}`;
  return j.job_min_salary ? `${fmt(j.job_min_salary)}+` : null;
}

// Helper: filter jobs by minimum salary — jobs with no salary data are kept
function filterBySalary(jobs, minSalary) {
  if (!minSalary) return jobs;
  return jobs.filter(j => {
    const raw = j._minSalaryRaw;
    if (raw == null) return true; // no salary data — include rather than exclude
    return raw >= minSalary;
  });
}

// Apply all post-fetch filters (work type, locations)
function applyFilters(jobs, { workType, includeLocations, excludeLocations }) {
  let result = jobs;

  if (workType === 'remote') {
    result = result.filter(j => j._isRemote === true);
  } else if (workType === 'onsite') {
    result = result.filter(j => j._isRemote !== true);
  }

  if (excludeLocations) {
    const terms = excludeLocations.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    result = result.filter(j => {
      const loc = (j.location || '').toLowerCase();
      return !terms.some(t => loc.includes(t));
    });
  }

  if (includeLocations) {
    const terms = includeLocations.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    result = result.filter(j => {
      if (j._isRemote) return true; // remote jobs always pass through
      const loc = (j.location || '').toLowerCase();
      return terms.some(t => loc.includes(t));
    });
  }

  return result;
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

// Search real jobs via JSearch (aggregates LinkedIn, Indeed, Glassdoor, Google Jobs)
app.post('/api/search', async (req, res) => {
  try {
    const { query, location, level, minSalary, workType, datePosted, includeLocations, excludeLocations } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    // Build search string
    let q = query;
    if (level) q += ` ${level}`;
    if (location) q += ` in ${location}`;

    const url = new URL('https://jsearch.p.rapidapi.com/search');
    url.searchParams.set('query', q);
    url.searchParams.set('page', '1');
    url.searchParams.set('num_pages', '1');
    url.searchParams.set('date_posted', datePosted || 'month');

    const jsRes = await fetch(url.toString(), {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
    });

    const jsData = await jsRes.json();

    if (!jsData.data?.length) {
      return res.json({ jobs: [], message: 'No results found. Try a different search.' });
    }

    // Map JSearch fields to our app format
    const rawJobs = jsData.data.map(j => ({
      title: j.job_title,
      company: j.employer_name,
      location: [j.job_city, j.job_state || j.job_country].filter(Boolean).join(', ')
        || (j.job_is_remote ? 'Remote' : 'Location not specified'),
      salary: formatSalary(j),
      _minSalaryRaw: j.job_min_salary || null,
      _isRemote: j.job_is_remote || false,
      url: j.job_apply_link,
      score: null,
      fit_reason: '',
      tags: [j.job_employment_type, j.job_is_remote ? 'Remote' : null].filter(Boolean),
      description: (j.job_description || '').slice(0, 500),
    }));

    const jobs = applyFilters(filterBySalary(rawJobs, minSalary), { workType, includeLocations, excludeLocations })
      .map(({ _minSalaryRaw, _isRemote, ...j }) => j);

    // If resume is uploaded, score all results in one Claude call
    const resumeText = await getResume();
    if (resumeText) {
      try {
        const scored = await scoreJobsAgainstResume(jobs, resumeText);
        return res.json({ jobs: scored });
      } catch (scoreErr) {
        console.error('Scoring failed, returning unscored results:', scoreErr);
        return res.json({ jobs });
      }
    }

    res.json({ jobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Smart search: resume-driven, no query needed
app.post('/api/smart-search', async (req, res) => {
  try {
    const { minSalary, workType, datePosted, includeLocations, excludeLocations } = req.body;
    const resumeText = await getResume();
    if (!resumeText) {
      return res.status(400).json({ error: 'No resume found. Please upload your resume first.' });
    }

    // Step 1: Claude reads the resume and produces search queries
    const queries = await extractSearchQueries(resumeText);

    // Step 2: Run each query sequentially to avoid JSearch rate limits
    const seen = new Set();
    const allJobs = [];

    for (const q of queries) {
      try {
        const url = new URL('https://jsearch.p.rapidapi.com/search');
        url.searchParams.set('query', q);
        url.searchParams.set('page', '1');
        url.searchParams.set('num_pages', '2');
        url.searchParams.set('date_posted', datePosted || 'month');

        const jsRes = await fetch(url.toString(), {
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
          },
        });
        const jsData = await jsRes.json();
        const hits = jsData.data || [];
        console.log(`Smart search query "${q}": ${hits.length} results`);

        for (const j of hits) {
          if (!seen.has(j.job_id)) {
            seen.add(j.job_id);
            allJobs.push({
              title: j.job_title,
              company: j.employer_name,
              location: [j.job_city, j.job_state || j.job_country].filter(Boolean).join(', ')
                || (j.job_is_remote ? 'Remote' : 'Location not specified'),
              salary: formatSalary(j),
              _minSalaryRaw: j.job_min_salary || null,
              _isRemote: j.job_is_remote || false,
              url: j.job_apply_link,
              score: null,
              fit_reason: '',
              tags: [j.job_employment_type, j.job_is_remote ? 'Remote' : null].filter(Boolean),
              description: (j.job_description || '').slice(0, 500),
            });
          }
        }
      } catch (e) {
        console.error(`Smart search query "${q}" failed:`, e.message);
      }
    }

    console.log(`Smart search total unique jobs before scoring: ${allJobs.length}`);

    // Apply all filters (salary, work type, locations)
    const filtered = applyFilters(filterBySalary(allJobs, minSalary), { workType, includeLocations, excludeLocations })
      .map(({ _minSalaryRaw, _isRemote, ...j }) => j);
    console.log(`Smart search after filters: ${filtered.length}`);

    if (!filtered.length) {
      return res.json({ jobs: [], queries, message: 'No results matched your salary filter. Try lowering the minimum or selecting "Any salary".' });
    }

    // Step 3: Score everything against the resume in one Claude call
    const scored = await scoreJobsAgainstResume(filtered, resumeText);

    // Step 4: Sort by score descending
    scored.sort((a, b) => {
      if (a.score === null && b.score === null) return 0;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    });

    res.json({ jobs: scored, queries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Smart search failed' });
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
