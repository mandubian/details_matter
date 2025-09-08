import React from 'react';
import Turn from './Turn';

const ConversationDisplay = ({
  conversation,
  onContinue,
  onRegenerateTurn,
  currentTurn,
  style,
  isLoading,
  isApiKeySet
}) => {
  const totalImages = conversation.filter(turn => turn.image).length;

  return (
    <div>
      <div className="controls-section">
        <h2>🎬 Look for more Details</h2>

        <div className="controls-grid">
          <button
            onClick={onContinue}
            disabled={!isApiKeySet || isLoading}
          >
            {isLoading ? (
              <span className="loading">
                <span className="spinner"></span>
                Generating...
              </span>
            ) : (
              'Continue Next Turn'
            )}
          </button>

          <select value={style} disabled>
            <option value={style}>{style}</option>
          </select>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="stat-value">{currentTurn}</div>
            <div className="stat-label">Current Turn</div>
          </div>
          <div className="stat">
            <div className="stat-value">{conversation.length}</div>
            <div className="stat-label">Total Turns</div>
          </div>
          <div className="stat">
            <div className="stat-value">{totalImages}</div>
            <div className="stat-label">Images Generated</div>
          </div>
        </div>
      </div>

      <div className="conversation">
        {conversation.map((turn, index) => (
          <Turn
            key={turn.id || index}
            turn={turn}
            index={index}
            onRegenerate={() => onRegenerateTurn(index)}
            isLoading={isLoading}
            isApiKeySet={isApiKeySet}
          />
        ))}

        {conversation.length > 0 && (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            marginTop: '20px'
          }}>
            <p style={{ margin: 0, color: '#6b7280' }}>
              <strong>🎯 Next: Evolve from Turn {currentTurn - 1} | Style: {style}</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationDisplay;
