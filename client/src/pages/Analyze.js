import React, { useState } from 'react';

export default function Analyze({ api, onSave }) {
  const [jd, setJd] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [drafting, setDrafting] = useState(false);
  const [letter, setLetter] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleAnalyze() {
    if (!jd.trim()) return;
    setLoading(true); setError(''); setResult(null); setLetter(''); setSaved(false);
    try {
      const res = await fetch(`${api}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText: jd }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      setSaved(true);
    } catch (e) {
      setError(e.message || 'Analysis failed. Is the server running?');
    }
    setLoading(false);
  }

  async function handleDraft() {
    if (!result?.application?.id) return;
    setDrafting(true);
    try {
      const res = await fetch(`${api}/api/applications/${result.application.id}/cover-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setLetter(data.cover_letter || '');
    } catch {
      setLetter('Failed to generate. Try again.');
    }
    setDrafting(false);
  }

  function scoreClass(s) { return s >= 80 ? 'score-high' : s >= 60 ? 'score-mid' : 'score-low'; }
  function scoreLabel(s) { return s >= 80 ? 'Strong fit' : s >= 60 ? 'Good fit' : 'Partial fit'; }

  const a = result?.analysis;

  return (
    <div>
      <h1 className="page-title">Paste a job description</h1>
      <p className="page-subtitle">Drop in any JD to get a fit score, gap analysis, and cover letter</p>

      <textarea
        value={jd}
        onChange={e => setJd(e.target.value)}
        placeholder="Paste the full job description here — title, company, responsibilities, qualifications..."
        rows={8}
        style={{ marginBottom: 10 }}
      />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24 }}>
        <button className="btn btn-primary" onClick={handleAnalyze} disabled={loading || !jd.trim()}>
          {loading ? <><span className="spinner" /> Analyzing...</> : 'Analyze fit'}
        </button>
        {saved && <span style={{ fontSize: 13, color: 'var(--accent)' }}>Saved to tracker</span>}
      </div>

      {error && <p style={{ color: 'var(--red)', fontSize: 14, marginBottom: 16 }}>{error}</p>}

      {a && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 16 }}>{a.title}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{a.company}{a.location ? ` · ${a.location}` : ''}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 500, fontFamily: 'var(--mono)', color: a.score >= 80 ? 'var(--accent)' : a.score >= 60 ? 'var(--amber)' : 'var(--red)' }}>
                {a.score}
              </div>
              <span className={`score-badge ${scoreClass(a.score)}`}>{scoreLabel(a.score)}</span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Overall fit</div>
            <p style={{ fontSize: 13, lineHeight: 1.7 }}>{a.fit_summary}</p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Strengths</div>
            <div>{(a.strengths || []).map(s => <span key={s} className="pill pill-green">{s}</span>)}</div>
          </div>

          {(a.gaps || []).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Gaps to address</div>
              <div>{a.gaps.map(g => <span key={g} className="pill pill-amber">{g}</span>)}</div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Kewwords to use</div>
            <div>{(a.keywords || []).map(k => <span key={k} className="pill">{k}</span>)}</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleDraft} disabled={drafting}>
              {drafting ? <><span className="spinner" /> Drafting...</> : 'Draft cover letter'}
            </button>
            <button className="btn btn-ghost" onClick={onSave}>View tracker →</button>
          </div>

          {letter && (
            <div style={{ marginTop: 16, padding: 16, background: 'var(--bg)', borderRadius: 8, fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {letter}
              <div style={{ marginTop: 10 }}>
                <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(letter)}>Copy</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
