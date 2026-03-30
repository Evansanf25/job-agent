import React, { useState } from 'react';
import Search from './pages/Search';
import Analyze from './pages/Analyze';
import Tracker from './pages/Tracker';
import Resume from './pages/Resume';
import './App.css';

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
            {['search', 'analyze', 'tracker', 'resume'].map(t => (
              <button
                key={t}
                className={`nav-btn ${tab === t ? 'active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'search' ? 'Search' : t === 'analyze' ? 'Paste JD' : t === 'tracker' ? 'Tracker' : 'Resume'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="main">
        {tab === 'search' && <Search api={API} onSave={() => setTab('tracker')} />}
        {tab === 'analyze' && <Analyze api={API} onSave={() => setTab('tracker')} />}
        {tab === 'tracker' && <Tracker api={API} />}
        {tab === 'resume' && <Resume api={API} />}
      </main>
    </div>
  );
}
