import React, { useState, useEffect, useRef } from 'react';

export default function Resume({ api }) {
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef();

  useEffect(() => {
    fetch(`${api}/api/resume`)
      .then(r => r.json())
      .then(d => { setResume(d.resume); setLoading(false); })
      .catch(() => setLoading(false));
  }, [api]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await fetch(`${api}/api/resume`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setSuccess('Resume uploaded! All future searches, analyses, and cover letters will use it.');
      const r2 = await fetch(`${api}/api/resume`);
      const d2 = await r2.json();
      setResume(d2.resume);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div>
      <p className="page-title">Resume</p>
      <p className="page-subtitle">
        Upload your resume so the agent can personalize job matches, fit scoring, and cover letters to your actual background.
      </p>

      <div className="card" style={{ maxWidth: 620 }}>
        <div
          className="upload-zone"
          onClick={() => fileInputRef.current.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleUpload({ target: { files: [file] } });
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
          {uploading ? (
            <p style={{ color: 'var(--muted)' }}>
              <span className="spinner" style={{ marginRight: 8 }} />
              Parsing resume...
            </p>
          ) : (
            <>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
              <p style={{ fontWeight: 500, marginBottom: 4 }}>
                {resume ? 'Upload a new resume' : 'Upload your resume'}
              </p>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                Click or drag and drop — PDF or .txt, max 10 MB
              </p>
            </>
          )}
        </div>

        {error && <p className="error-msg">{error}</p>}
        {success && <p className="success-msg">{success}</p>}

        {loading ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading...</p>
        ) : resume ? (
          <div className="resume-preview">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 14 }}>{resume.filename || 'Resume'}</strong>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                Uploaded {new Date(resume.uploaded_at).toLocaleDateString()}
              </span>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {resume.preview}{resume.preview && resume.preview.length >= 499 ? '...' : ''}
            </p>
          </div>
        ) : (
          <div className="resume-empty">
            No resume uploaded yet. Upload one above to get personalized results.
          </div>
        )}
      </div>
    </div>
  );
}
