import React, { useState, useEffect } from 'react';

const STATUSES = ['saved', 'applied', 'interviewing', 'offer', 'rejected'];

export default function Tracker({ api }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [drafting, setDrafting] = useState(null);

  useEffect(() => { fetchApps(); }, []);

  async function fetchApps() {
    try {
      const res = await fetch(`${api}/api/applications`);
      const data = await res.json();
      setApps(data.applications || []);
    } catch { setApps([]); }
    setLoading(false);
  }

  async function updateStatus(id, status) {
    await fetch(`${api}/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setApps(a => a.map(x => x.id === id ? { ...x, status } : x));
  }

  async function updateNotes(id, notes) {
    await fetch(`${api}/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this application?')) return;
    await fetch(`${api}/api/applications/${id}`, { method: 'DELETE' });
    setApps(a => a.filter(x => x.id !== id));
  }

  async function handleDraftLetter(app) {
    setDrafting(app.id);
    try {
      const res = await fetch(`${api}/api/applications/${app.id}/cover-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setApps(a => a.map(x => x.id === app.id ? { ...x, cover_letter: data.cover_letter } : x));
    } catch {}
    setDrafting(null);
  }

  function scoreClass(s) { return s >= 80 ? 'score-high' : s >= 60 ? 'score-mid' : 'score-low'; }

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = apps.filter(a => a.status === s).length;
    return acc;
  }, {});

  if (loading) return <div className="empty"><span className="spinner" /></div>;

  return (
    <div>
      <h1 className="page-title">Application tracker</h1>
      <p className="page-subtitle">Every role you've analyzed, in one place</p>

      {/* Pipeline summary */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <div key={s} style={{ flex: 1, minWidth: 80, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 500, fontFamily: 'var(--mono)' }}>{counts[s]}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s}</div>
          </div>
        ))}
      </div>

      {apps.length === 0 && (
        <div className="empty">No applications yet. Analyze a JD or search for roles to get started.</div>
      )}

      {apps.map(app => (
        <div key={app.id} className="card" style={{ cursor: 'default' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 500, fontSize: 15 }}>{app.title}</span>
                {app.score && <span className={`score-badge ${scoreClass(app.score)}`}>{app.score}</span>}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
                {app.company}{app.location ? ` · ${app.location}` : ''}
                {app.salary ? ` · ${app.salary}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                className="status-select"
                value={app.status}
                onChange={e => updateStatus(app.id, e.target.value)}
                style={{ background: 'var(--bg)' }}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn btn-ghost" onClick={() => handleDelete(app.id)} style={{ color: 'var(--red)', padding: '4px 8px' }}>×</button>
            </div>
          </div>

          {app.fit_summary && (
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 10 }}>{app.fit_summary}</p>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {(app.strengths || []).slice(0, 3).map(s => <span key={s} className="pill pill-green">{s}</span>)}
            {(app.gaps || []).slice(0, 2).map(g => <span key={g} className="pill pill-amber">{g}</span>)}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setExpanded(expanded === app.id ? null : app.id)}
              style={{ fontSize: 13 }}
            >
              {expanded === app.id ? 'Hide details' : 'Show details'}
            </button>
            {!app.cover_letter && (
              <button
                className="btn btn-ghost"
                onClick={() => handleDraftLetter(app)}
                disabled={drafting === app.id}
                style={{ fontSize: 13 }}
              >
                {drafting === app.id ? <><span className="spinner" /> Drafting...</> : 'Draft cover letter'}
              </button>
            )}
          </div>

          {expanded === app.id && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              {app.cover_letter && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Cover letter</div>
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{app.cover_letter}</div>
                  <button className="btn btn-ghost" style={{ marginTop: 6, fontSize: 13 }} onClick={() => navigator.clipboard.writeText(app.cover_letter)}>Copy</button>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Notes</div>
                <textarea
                  defaultValue={app.notes || ''}
                  placeholder="Add notes, contacts, follow-up dates..."
                  rows={3}
                  onBlur={e => updateNotes(app.id, e.target.value)}
                />
              </div>

              <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                Added {new Date(app.created_at).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
