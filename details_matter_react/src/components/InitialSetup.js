import React, { useState } from 'react';

const InitialSetup = ({
  initialPrompt,
  setInitialPrompt,
  onFileUpload,
  uploadedFile,
  initialImage,
  onStartEvolution,
  isApiKeySet,
  isLoading,
  style
}) => {
  const [showHelp, setShowHelp] = useState(true);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    onFileUpload(file);
  };

  return (
    <div className="controls-section">
      {showHelp && (
        <div className="expander">
          <div
            className="expander-header"
            onClick={() => setShowHelp(false)}
            style={{ color: 'var(--text-primary)' }}
          >
            <span>How to start (quick)</span>
            <span>▼</span>
          </div>
          <div className="expander-content" style={{ color: 'var(--text-secondary)' }}>
            <ol style={{ paddingLeft: '20px' }}>
              <li>Set or paste a Gemini API key in the settings (sidebar/bottom).</li>
              <li>Enter an initial prompt below.</li>
              <li>(Optional) Upload an initial image.</li>
              <li>Click 'Begin Single-Model Evolution'.</li>
            </ol>
            <p style={{marginTop: '10px'}}><strong>Note:</strong> All data is stored locally in your browser.</p>
          </div>
        </div>
      )}

      <h2 style={{ color: 'var(--text-primary)' }}>🚀 Start Evolution</h2>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
          Initial Prompt / Scene Setup
        </label>
        <textarea
          placeholder="Describe starting point... e.g., 'A mysterious forest with glowing trees'"
          value={initialPrompt}
          onChange={(e) => setInitialPrompt(e.target.value)}
          rows={4}
        />
      </div>

      <div className="file-input">
        <label style={{ marginBottom: '12px', display: 'block' }}>Upload Initial Image (Optional)</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ padding: '0', border: 'none' }} 
        />
        {/* Note: file input styling is tricky, often better to wrap or use label as trigger */}
        
        {initialImage && (
          <div className="image-preview">
            <img src={initialImage} alt="Initial upload preview" />
            <p>Initial uploaded image</p>
          </div>
        )}
      </div>

      <button
        onClick={onStartEvolution}
        disabled={!isApiKeySet || isLoading || !initialPrompt.trim()}
        className="primary-button"
        style={{ width: '100%', marginTop: '20px' }}
      >
        {isLoading ? (
          <span className="loading" style={{color: 'white'}}>
            <span className="spinner" style={{borderColor: 'white', borderTopColor: 'transparent'}}></span>
            Generating first image...
          </span>
        ) : (
          '🎬 Begin Single-Model Evolution'
        )}
      </button>

      {!isApiKeySet && (
        <div className="warning" style={{ marginTop: '15px' }}>
          Please set your Gemini API key in the sidebar to begin generation.
        </div>
      )}

      {initialPrompt.trim() === '' && (
        <div className="warning" style={{ marginTop: '15px' }}>
          Please enter an initial prompt to begin the evolution.
        </div>
      )}
    </div>
  );
};

export default InitialSetup;
