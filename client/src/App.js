import React, { useState } from 'react';
import Search from './pages/Search';
import Analyze from './pages/Analyze';
import Tracker from './pages/Tracker';
import './App.css';

// API lives at the same origin in production (Railway serves everything)
// In local dev, CRA proxy in package.json forwards /api to localhost:3001
const API = '';

export default function App() {
  const [tab, setTab] = useState('search');

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-mark">JA</span>
            <span className="logo-text">Job Agent</span>
          </div>
          <nav className="nav">
            {['search', 'analyze', 'tracker'].map(t => (
              <button
                key={t}
                className={`nav-btn ${tab === t ? 'active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'search' ? 'Search' : t === 'analyze' ? 'Paste JD' : 'Tracker'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="main">
        {tab === 'search' && <Search api={API} onSave={() => setTab('tracker')} />}
        {tab === 'analyze' && <Analyze api={API} onSave={() => setTab('tracker')} />}
        {tab === 'tracker' && <Tracker api={API} />}
      </main>
    </div>
  );
}
