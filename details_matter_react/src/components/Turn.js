import React, { useState } from 'react';

const Turn = ({ turn, index, onRegenerate, isLoading, isApiKeySet }) => {
  const [showRawResponse, setShowRawResponse] = useState(false);

  // Extract first sentence for bold display
  const getFirstSentence = (text) => {
    if (!text) return '';
    const sentences = text.split(/[.!?]+/);
    return sentences[0].trim() + (sentences[0].trim() ? '.' : '');
  };

  const firstSentence = getFirstSentence(turn.text);

  return (
    <div className="turn">
      <div className="turn-header">
        <h3 className="turn-title">
          {turn.model_name === 'Human Input' ? (
            `👤 ${turn.model_name} (Initial Input)`
          ) : (
            `🎨 Turn ${index}${turn.style ? ` - Style: ${turn.style}` : ''}`
          )}
        </h3>
        <span className="turn-timestamp">{turn.timestamp}</span>
      </div>

      {turn.text && (
        <div className="turn-text">
          {firstSentence && <strong>{firstSentence}</strong>}
          {turn.text.length > firstSentence.length && (
            <span>{turn.text.slice(firstSentence.length)}</span>
          )}
        </div>
      )}

      {turn.image ? (
        <img
          src={turn.image}
          alt={turn.image_description || `Generated image for turn ${index}`}
          className="turn-image"
        />
      ) : (
        <div style={{
          padding: '20px',
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          color: '#92400e'
        }}>
          <strong>No image was generated for this turn.</strong>
          {turn.error && (
            <div style={{ marginTop: '10px' }}>
              <strong>Error:</strong> {turn.error}
              <br />
              <button
                onClick={() => setShowRawResponse(!showRawResponse)}
                style={{
                  marginTop: '10px',
                  padding: '5px 10px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {showRawResponse ? 'Hide' : 'Show'} Raw Response
              </button>
              {showRawResponse && turn.rawResponse && (
                <pre style={{
                  marginTop: '10px',
                  padding: '10px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '4px',
                  fontSize: '12px',
                  overflow: 'auto',
                  maxHeight: '200px'
                }}>
                  {JSON.stringify(turn.rawResponse, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {turn.model_name !== 'Human Input' && (
        <div className="turn-controls">
          <button
            onClick={onRegenerate}
            disabled={!isApiKeySet || isLoading}
          >
            🔁 Regenerate
          </button>
        </div>
      )}
    </div>
  );
};

export default Turn;
