import React, { useState } from 'react';

export default function Search({ api, onSave }) {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [drafting, setDrafting] = useState({});
  const [letters, setLetters] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true); setError(''); setJobs([]); setMessage('');
    try {
      const res = await fetch(`${api}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, location, level }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      // Sort: scored jobs first (by score desc), then unscored
      const sorted = (data.jobs || []).sort((a, b) => {
        if (a.score === null && b.score === null) return 0;
        if (a.score === null) return 1;
        if (b.score === null) return -1;
        return b.score - a.score;
      });
      setJobs(sorted);
      if (data.message) setMessage(data.message);
    } catch (e) {
      setError(e.message || 'Search failed. Is the server running?');
    }
    setLoading(false);
  }

  async function handleDraft(job, idx) {
    // Toggle off if already generated
    if (letters[idx]) {
      setLetters(l => ({ ...l, [idx]: l[idx] ? null : l[idx] }));
      return;
    }
    setDrafting(d => ({ ...d, [idx]: true }));
    try {
      // Build a JD from the real job data we have
      const jdText = [
        `${job.title} at ${job.company}`,
        job.location ? `Location: ${job.location}` : '',
        job.salary ? `Salary: ${job.salary}` : '',
        job.description ? `\nJob Description:\n${job.description}` : '',
        job.fit_reason ? `\nFit notes: ${job.fit_reason}` : '',
      ].filter(Boolean).join('\n');

      const analyzeRes = await fetch(`${api}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText }),
      });
      const { application } = await analyzeRes.json();

      const clRes = await fetch(`${api}/api/applications/${application.id}/cover-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const { cover_letter } = await clRes.json();
      setLetters(l => ({ ...l, [idx]: cover_letter }));
    } catch {
      setLetters(l => ({ ...l, [idx]: 'Failed to generate. Try again.' }));
    }
    setDrafting(d => ({ ...d, [idx]: false }));
  }

  function scoreClass(s) {
    if (s === null) return 'score-mid';
    return s >= 80 ? 'score-high' : s >= 60 ? 'score-mid' : 'score-low';
  }
  function scoreLabel(s) {
    if (s === null) return 'No score';
    return s >= 80 ? 'Strong fit' : s >= 60 ? 'Good fit' : 'Partial fit';
  }

  return (
    <div>
      <h1 className="page-title">Job search</h1>
      <p className="page-subtitle">Real listings from LinkedIn, Indeed, Glassdoor &amp; Google Jobs — scored against your resume</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. structured finance analyst, renewable energy VP..."
          style={{ flex: 1, minWidth: 200 }}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <input
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="City, State or Remote"
          style={{ width: 180 }}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <select value={level} onChange={e => setLevel(e.target.value)} style={{ width: 130 }}>
          <option value="">Any level</option>
          <option>Analyst</option>
          <option>Associate</option>
          <option>Senior</option>
          <option>Director</option>
          <option>VP</option>
          <option>Managing Director</option>
        </select>
        <button className="btn btn-primary" onClick={handleSearch} disabled={loading || !query.trim()}>
          {loading ? <span className="spinner" /> : 'Search'}
        </button>
      </div>

      {error && <p style={{ color: 'var(--red)', fontSize: 14, marginBottom: 12 }}>{error}</p>}
      {message && <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 12 }}>{message}</p>}

      {loading && (
        <div className="empty">
          <span className="spinner" style={{ width: 20, height: 20 }} />
          <p style={{ marginTop: 12 }}>Searching real job boards{jobs.length === 0 ? '...' : ' and scoring against your resume...'}</p>
        </div>
      )}

      {!loading && jobs.length === 0 && !error && (
        <div className="empty">Enter a job title or keywords to search real postings</div>
      )}

      {jobs.map((job, i) => (
        <div key={i} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ flex: 1, marginRight: 12 }}>
              <div style={{ fontWeight: 500, fontSize: 15 }}>{job.title}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{job.company} · {job.location}</div>
            </div>
            {job.score !== null && (
              <span className={`score-badge ${scoreClass(job.score)}`}>{scoreLabel(job.score)} · {job.score}</span>
            )}
          </div>

          {job.salary && <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{job.salary}</div>}

          <div style={{ marginBottom: 10 }}>
            {(job.tags || []).map(t => t && <span key={t} className="pill">{t}</span>)}
          </div>

          {/* Show fit reason (scored) or description snippet (unscored) */}
          {(job.fit_reason || job.description) && (
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
              {job.fit_reason || job.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={() => handleDraft(job, i)}
              disabled={drafting[i]}
            >
              {drafting[i] ? <><span className="spinner" /> Drafting...</> : 'Draft cover letter'}
            </button>
            <a className="btn btn-ghost" href={job.url} target="_blank" rel="noreferrer">View posting →</a>
          </div>

          {letters[i] && (
            <div style={{ marginTop: 14, padding: 14, background: 'var(--bg)', borderRadius: 8, fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {letters[i]}
              <div style={{ marginTop: 10 }}>
                <button className="btn-ghost btn" onClick={() => navigator.clipboard.writeText(letters[i])}>Copy</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
