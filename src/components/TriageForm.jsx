import React, { useState } from 'react';

function TriageForm({ onSubmit, isLoading }) {
  const [symptoms, setSymptoms] = useState('');
  const [age, setAge] = useState('');
  const [language, setLanguage] = useState('english');
  const canSubmit = symptoms.trim().length > 0 && age !== '';

  return (
    <div className="card">
      <div className="card-hd">
        <h2>Describe Your Symptoms</h2>
        <p className="card-sub">Be specific — all languages supported</p>
      </div>

      <div className="field">
        <label className="field-label">Symptoms <span className="req">*</span></label>
        <textarea className="field-ctrl field-ta"
        placeholder="e.g. Fever of 38.5°C for 2 days, dry cough, chest tightness…"
        rows={4} value={symptoms} onChange={(e) => setSymptoms(e.target.value)} />
        <span className="char-count">{symptoms.length} chars</span>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field-label">Patient Age <span className="req">*</span></label>
          <input type="number" className="field-ctrl" placeholder="35" min="0" max="120"
          value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Language</label>
          <select className="field-ctrl" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="english">🇬🇧 English</option>
            <option value="french">🇫🇷 Français</option>
            <option value="arabic">🇲🇦 العربية</option>
            <option value="spanish">🇪🇸 Español</option>
            <option value="portuguese">🇧🇷 Português</option>
            <option value="german">🇩🇪 Deutsch</option>
            <option value="chinese">🇨🇳 中文</option>
          </select>
        </div>
      </div>

      <button className={`btn-submit ${isLoading ? 'btn-loading' : ''}`}
      disabled={isLoading || !canSubmit}
      onClick={() => onSubmit({ symptoms, age: parseInt(age), language })}>
        {isLoading ?
        <><span className="spin" /> Submitting to GenLayer…</> :
        <>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M6.5 10l3 3 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Analyze Symptoms
            </>}
      </button>
    </div>);

}

export { TriageForm };
