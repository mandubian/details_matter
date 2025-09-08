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
          >
            <span>How to start (quick)</span>
            <span>▼</span>
          </div>
          <div className="expander-content">
            <ol>
              <li>Set or paste a Gemini API key in the left sidebar (use a throwaway or scoped key for demos).</li>
              <li>Enter an initial prompt in the 'Initial Prompt / Scene Setup' box below.</li>
              <li>(Optional) Upload an initial image to seed the evolution.</li>
              <li>Click '🎬 Begin Single-Model Evolution' to generate the first AI turn.</li>
              <li>Use 'Continue Next Turn' or per-turn Regenerate buttons to explore how the model preserves a single detail across contexts.</li>
            </ol>
            <p><strong>Note:</strong> All data is stored locally in your browser. No server-side storage is used.</p>
          </div>
        </div>
      )}

      <h2>🚀 Start Evolution</h2>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Initial Prompt / Scene Setup
        </label>
        <textarea
          placeholder="Describe starting point... e.g., 'A mysterious forest with glowing trees'"
          value={initialPrompt}
          onChange={(e) => setInitialPrompt(e.target.value)}
          rows={4}
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
        />
      </div>

      <div className="file-input">
        <label>Upload Initial Image (Optional)</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />
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
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: (!isApiKeySet || isLoading || !initialPrompt.trim()) ? 'not-allowed' : 'pointer',
          opacity: (!isApiKeySet || isLoading || !initialPrompt.trim()) ? 0.5 : 1
        }}
      >
        {isLoading ? (
          <span className="loading">
            <span className="spinner"></span>
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
