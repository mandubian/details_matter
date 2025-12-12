import React, { useState, useEffect } from 'react';
import { AVAILABLE_MODELS, fetchAvailableModels } from '../utils/googleAI';

const Sidebar = ({
  apiKey,
  isApiKeySet,
  onApiKeySet,
  onApiKeyOverride,
  conversation,
  currentTurn,
  style,
  onStyleChange,
  model,
  onModelChange,
  onContinue,
  isLoading,
  error,
  success,
  onClearMessages,
  onOpenGallery,
  onPublishCloud,
  onNewThread,
  onAddToGallery
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [overrideKeyInput, setOverrideKeyInput] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const [availableModels, setAvailableModels] = useState(AVAILABLE_MODELS);
  const [loadingModels, setLoadingModels] = useState(false);

  // Fetch available models when API key changes
  useEffect(() => {
    const loadModels = async () => {
      if (isApiKeySet && apiKey) {
        setLoadingModels(true);
        const fetchedModels = await fetchAvailableModels(apiKey);
        if (fetchedModels.length > 0) {
          console.log('Using fetched models from API:', fetchedModels);
          setAvailableModels(fetchedModels);
          // Keep current selection if still available; otherwise fall back to first.
          const stillValid = !!fetchedModels.find(m => m.id === model);
          if (!stillValid) onModelChange(fetchedModels[0].id);
        }
        setLoadingModels(false);
      }
    };
    loadModels();
    // We intentionally don't include onModelChange/model in deps to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApiKeySet, apiKey]); // Removed model from deps to avoid loop

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
    console.log('🔄 Sidebar: Override form submitted');
    onApiKeyOverride(overrideKeyInput);
    setOverrideKeyInput('');
    setShowOverride(false);
    onClearMessages();
  };

  const styles = [
    'Photorealistic', 'Cartoon', 'Abstract', 'Fantasy', 'Sci-Fi', 'Surreal',
    'Anime', 'Watercolor', 'Oil Painting', 'Digital Art', 'Minimalist',
    'Vintage', 'Cyberpunk', 'Steampunk', 'Impressionist', 'Gothic', 'Noir',
    'Pop Art', 'Cubist', 'Art Nouveau'
  ];

  // Export functionality
  const handleExport = () => {
    const data = {
      conversation,
      style,
      exportDate: new Date().toISOString(),
      appVersion: "1.0"
    };
    
    // Convert to JSON string
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `details-matter-session-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import functionality
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        // Dispatch custom event to update parent state (simplest way without prop drilling setConversation)
        const customEvent = new CustomEvent('importSession', { detail: importedData });
        window.dispatchEvent(customEvent);
        
        // Reset file input
        e.target.value = '';
      } catch (err) {
        console.error("Failed to parse imported file", err);
        alert("Invalid session file. Please upload a valid JSON export.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="sidebar">
      <h2>⚙️ Settings</h2>

      {/* API Key Section */}
      <div className="section">
        <h3>API Key</h3>

        {!isApiKeySet ? (
          <>
            <div className="warning">
              <strong>Security Notice:</strong> Keys are stored locally in your browser only.
            </div>

            <form onSubmit={handleApiKeySubmit}>
              <input
                type="password"
                placeholder="Paste Gemini API Key"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                required
              />
              <button type="submit" className="primary-button" style={{ width: '100%' }}>Set Key</button>
            </form>
          </>
        ) : (
          <>
            <div className="success">
              ✅ API Key Active
            </div>

            {!showOverride ? (
              <button 
                onClick={() => setShowOverride(true)} 
                className="secondary-button" 
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Change API Key
              </button>
            ) : (
              <form onSubmit={handleOverrideSubmit} style={{ marginTop: '12px' }}>
                <input
                  type="password"
                  placeholder="New API Key"
                  value={overrideKeyInput}
                  onChange={(e) => setOverrideKeyInput(e.target.value)}
                  required
                  style={{ marginBottom: '8px' }}
                />
                <button type="submit" className="primary-button" style={{ width: '100%', marginBottom: '8px' }}>Update Key</button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOverride(false);
                    setOverrideKeyInput('');
                  }}
                  className="secondary-button"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Cancel
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {/* Messages */}
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {/* Share / Gallery Section */}
      {isApiKeySet && (
        <div className="section">
          <h3>🌐 Share & Gallery</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className="danger-button"
              onClick={onNewThread}
              disabled={isLoading}
            >
              🧹 New Thread (Reset)
            </button>
            
            <button className="primary-button" onClick={onOpenGallery} disabled={isLoading}>
              📂 Open Gallery (Local & Cloud)
            </button>

            <button className="secondary-button" onClick={onAddToGallery} disabled={isLoading}>
              💾 Save to Local Gallery
            </button>

            {conversation.length > 0 && (
              <button 
                className="secondary-button" 
                onClick={onPublishCloud} 
                disabled={isLoading}
                title="Upload to Cloudflare R2 (Requires Config)"
              >
                ☁️ Publish to Cloud
              </button>
            )}
          </div>
        </div>
      )}

      {/* AI Model Section */}
      {isApiKeySet && (
        <div className="section">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h3>🧠 AI Model</h3>
            {loadingModels && <span className="loading" style={{fontSize: '0.75rem'}}>Fetching...</span>}
          </div>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={loadingModels}
          >
            {availableModels.map(modelOption => (
              <option key={modelOption.id} value={modelOption.id}>
                {modelOption.name}
              </option>
            ))}
          </select>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            {availableModels.length > 3 ? 'Models loaded from your API key.' : 'Flash is faster/cheaper. Pro is higher quality.'}
          </div>
        </div>
      )}

      {/* Art Style Section */}
      {isApiKeySet && (
        <div className="section">
          <h3>🎨 Style</h3>
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

      {/* Storage & Sharing */}
      {conversation.length > 0 && (
        <div className="section">
          <h3>💾 Save / Load</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              onClick={handleExport} 
              className="primary-button"
              style={{ background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-text)' }}
            >
              📥 Export Session (JSON)
            </button>
            
            <div style={{ position: 'relative' }}>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  opacity: 0,
                  width: '100%',
                  height: '100%',
                  cursor: 'pointer'
                }}
              />
              <button 
                className="primary-button"
                style={{ width: '100%', pointerEvents: 'none', background: 'var(--background-color)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                📤 Import Session
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Share the JSON file to let others fork your thread.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      {conversation.length > 0 && (
        <div className="section">
          <h3>📊 Stats</h3>
          <div className="stats">
            <div className="stat">
              <div className="stat-value">{currentTurn}</div>
              <div className="stat-label">Turns</div>
            </div>
            <div className="stat">
              <div className="stat-value">{conversation.length}</div>
              <div className="stat-label">Total</div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      {conversation.length > 0 && (
        <div className="section">
          <h3>Controls</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              className="primary-button"
              style={{ width: '100%', background: 'var(--error-bg)', color: 'var(--error-text)', border: '1px solid var(--error-text)', boxShadow: 'none' }}
              onClick={onNewThread}
            >
              Reset
            </button>
            <button
              className="secondary-button"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                if (conversation.length > 0) {
                  const event = new CustomEvent('undoLastTurn');
                  window.dispatchEvent(event);
                }
              }}
              disabled={conversation.length === 0}
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;