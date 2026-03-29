import React, { useState } from 'react';

export default function Search({ api, onSave }) {
  const [query, setQuery] = useState('senior structured finance renewable energy');
  const [location, setLocation] = useState('Denver, CO');
  const [level, setLevel] = useState('Senior');
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [drafting, setDrafting] = useState({});
  const [letters, setLetters] = useState({});
  const [error, setError] = useState('');

  async function handleSearch() {
    setLoading(true); setError(''); setJobs([]);
    try {
      const res = await fetch(`${api}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, location, level }),
      });
      const data = await res.json();
      setJobs((data.jobs || []).sort((a, b) => b.score - a.score));
    } catch {
      setError('Search failed. Is the server running?');
    }
    setLoading(false);
  }

  async function handleDraft(job, idx) {
    if (letters[idx]) { setLetters(l => ({ ...l, [idx]: l[idx] ? null : l[idx] })); return; }
    setDrafting(d => ({ ...d, [idx]: true }));
    try {
      // First save the job by analyzing a minimal JD
      const analyzeRes = await fetch(`${api}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText: `${job.title} at ${job.company} in ${job.location}. ${job.fit_reason}` }),
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

  function scoreClass(s) { return s >= 80 ? 'score-high' : s >= 60 ? 'score-mid' : 'score-low'; }
  function scoreLabel(s) { return s >= 80 ? 'Strong fit' : s >= 60 ? 'Good fit' : 'Partial fit'; }

  return (
    <div>
      <h1 className="page-title">Job search</h1>
      <p className="page-subtitle">Find and score roles against your background</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. senior structured finance renewable energy"
          style={{ flex: 1, minWidth: 200 }}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <select value={location} onChange={e => setLocation(e.target.value)} style={{ width: 150 }}>
          <option value="">Any location</option>
          <option>Denver, CO</option>
          <option>Chicago, IL</option>
          <option>Remote</option>
          <option>New York, NY</option>
          <option>San Francisco, CA</option>
        </select>
        <select value={level} onChange={e => setLevel(e.target.value)} style={{ width: 130 }}>
          <option value="">Any level</option>
          <option>Senior</option>
          <option>Associate</option>
          <option>Director</option>
          <option>VP</option>
        </select>
        <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
          {loading ? <span className="spinner" /> : 'Search'}
        </button>
      </div>

      {error && <p style={{ color: 'var(--red)', fontSize: 14, marginBottom: 12 }}>{error}</p>}

      {jobs.length === 0 && !loading && (
        <div className="empty">Search for roles to see results here</div>
      )}

      {jobs.map((job, i) => (
        <div key={i} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 15 }}>{job.title}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{job.company} · {job.location}</div>
            </div>
            <span className={`score-badge ${scoreClass(job.score)}`}>{scoreLabel(job.score)} · {job.score}</span>
          </div>

          {job.salary && <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{job.salary}</div>}

          <div style={{ marginBottom: 10 }}>
            {(job.tags || []).map(t => <span key={t} className="pill">{t}</span>)}
          </div>

          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>{job.fit_reason}</p>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={() => handleDraft(job, i)}
              disabled={drafting[i]}
            >
              {drafting[i] ? <><span className="spinner" /> Drafting...</> : 'Draft cover letter'}
            </button>
            <a className="btn btn-ghost" href={job.url} target="_blank" rel="noreferrer">View+posting →</a>
          </div>

          {letters[i] && (
            <div style={{ marginTop: 14, padding: 14, background: 'var(--bg)', borderRadius: 8, fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {letters[i]}
              <div style={{ marginTop: 10 }}>
                <button className="btn-ghost btn" onClick={() => navigator.clipboard.writeText(letters[i])}>
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
