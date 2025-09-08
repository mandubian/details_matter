import React, { useState } from 'react';
import { getCurrentApiKey } from '../utils/googleAI';

const Sidebar = ({
  apiKey,
  isApiKeySet,
  onApiKeySet,
  onApiKeyOverride,
  conversation,
  currentTurn,
  style,
  onStyleChange,
  onContinue,
  isLoading,
  error,
  success,
  onClearMessages
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [overrideKeyInput, setOverrideKeyInput] = useState('');
  const [showOverride, setShowOverride] = useState(false);

  const handleApiKeySubmit = (e) => {
    e.preventDefault();
    if (apiKeyInput.trim()) {
      onApiKeySet(apiKeyInput.trim());
      setApiKeyInput('');
      onClearMessages();
    }
  };

  const handleOverrideSubmit = (e) => {
    e.preventDefault();
    console.log('🔄 Sidebar: Override form submitted with key:', overrideKeyInput.substring(0, 8) + '...');
    onApiKeyOverride(overrideKeyInput);
    setOverrideKeyInput('');
    setShowOverride(false);
    onClearMessages();
    console.log('🔄 Sidebar: Override form processed');
  };

  const styles = [
    'Photorealistic', 'Cartoon', 'Abstract', 'Fantasy', 'Sci-Fi', 'Surreal',
    'Anime', 'Watercolor', 'Oil Painting', 'Digital Art', 'Minimalist',
    'Vintage', 'Cyberpunk', 'Steampunk', 'Impressionist', 'Gothic', 'Noir',
    'Pop Art', 'Cubist', 'Art Nouveau'
  ];

  return (
    <div className="sidebar">
      <h2>⚙️ Configuration</h2>

      {/* API Key Section */}
      <div className="section">
        <h3>API Key Setup</h3>

        {!isApiKeySet ? (
          <>
            <div className="warning">
              <strong>Security Notice:</strong> Use a throwaway/dev key. Never use a production key.
              Keys are stored only in your browser's localStorage.
            </div>

            <form onSubmit={handleApiKeySubmit}>
              <input
                type="password"
                placeholder="Gemini API Key"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                required
              />
              <button type="submit">Set API Key</button>
            </form>
          </>
        ) : (
          <>
            <div className="success">
              API key is set and stored in browser localStorage.
              <br />
              <small style={{ color: '#065f46', fontSize: '12px' }}>
                Current key: {getCurrentApiKey() ? getCurrentApiKey().substring(0, 12) + '...' : 'None'}
              </small>
            </div>

            {!showOverride ? (
              <button onClick={() => setShowOverride(true)}>
                🔄 Override API Key
              </button>
            ) : (
              <form onSubmit={handleOverrideSubmit}>
                <input
                  type="password"
                  placeholder="New Gemini API Key"
                  value={overrideKeyInput}
                  onChange={(e) => setOverrideKeyInput(e.target.value)}
                  required
                />
                <button type="submit">Override Key</button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOverride(false);
                    setOverrideKeyInput('');
                  }}
                  style={{ backgroundColor: '#6b7280', marginTop: '5px' }}
                >
                  Cancel
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {success && (
        <div className="success">
          {success}
        </div>
      )}

      {/* Continue Section */}
      {isApiKeySet && conversation.length > 0 && (
        <div className="section">
          <h3>🎬 Continue Evolution</h3>
          <button
            onClick={onContinue}
            disabled={isLoading}
          >
            {isLoading ? 'Generating...' : 'Continue Next Turn'}
          </button>
        </div>
      )}

      {/* Art Style Section */}
      {isApiKeySet && (
        <div className="section">
          <h3>🎨 Art Style</h3>
          <select
            value={style}
            onChange={(e) => onStyleChange(e.target.value)}
          >
            {styles.map(styleOption => (
              <option key={styleOption} value={styleOption}>
                {styleOption}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stats */}
      {conversation.length > 0 && (
        <div className="section">
          <h3>📊 Current Status</h3>
          <div className="stats">
            <div className="stat">
              <div className="stat-value">{currentTurn}</div>
              <div className="stat-label">Current Turn</div>
            </div>
            <div className="stat">
              <div className="stat-value">{conversation.length}</div>
              <div className="stat-label">Total Turns</div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      {conversation.length > 0 && (
        <div className="section">
          <h3>🔄 Controls</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              onClick={() => window.location.reload()}
              style={{ backgroundColor: '#dc2626' }}
            >
              🔄 Reset Evolution
            </button>
            <button
              onClick={() => {
                if (conversation.length > 0) {
                  // This will be handled by the parent component
                  const event = new CustomEvent('undoLastTurn');
                  window.dispatchEvent(event);
                }
              }}
              disabled={conversation.length === 0}
              style={{ backgroundColor: '#ea580c' }}
            >
              ⬅️ Undo Last Turn
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
