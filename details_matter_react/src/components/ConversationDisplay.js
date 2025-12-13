import React, { useState } from 'react';
import Turn from './Turn';

const ConversationDisplay = ({
  conversation,
  onContinue,
  onRegenerateTurn,
  onUndoTurn,
  onForkFromTurn,
  currentTurn,
  style,
  isLoading,
  isApiKeySet
}) => {
  const [guidance, setGuidance] = useState('');

  const handleContinue = () => {
    onContinue(guidance);
    setGuidance(''); // Clear after sending
  };

  return (
    <div>
      <div className="conversation">
        {conversation.map((turn, index) => (
          (() => {
            const isLast = index === conversation.length - 1;
            const canRegenerate = isLast && turn?.model_name !== 'Human Input';
            return (
          <Turn
            key={turn.id || index}
            turn={turn}
            index={index}
            canRegenerate={canRegenerate}
            onRegenerate={canRegenerate ? () => onRegenerateTurn(index) : null}
            onUndo={onUndoTurn ? () => onUndoTurn(index) : null}
            onFork={onForkFromTurn ? () => onForkFromTurn(index) : null}
            isLoading={isLoading}
            isApiKeySet={isApiKeySet}
          />
            );
          })()
        ))}

        {conversation.length > 0 && (
          <div style={{ marginTop: '40px', textAlign: 'center', paddingBottom: '40px' }}>
            
            {/* Director Mode Input */}
            <div style={{ maxWidth: '500px', margin: '0 auto 20px', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                🎬 Director Mode (Optional)
              </label>
              <input
                type="text"
                placeholder="Steer the story... (e.g., 'Suddenly, it starts raining')"
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isLoading && isApiKeySet) {
                    handleContinue();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--background-color)',
                  color: 'var(--text-primary)',
                  marginBottom: '8px'
                }}
              />
            </div>

            <button
              className="primary-button"
              style={{ padding: '14px 32px', fontSize: '1.05rem' }}
              onClick={handleContinue}
              disabled={!isApiKeySet || isLoading}
            >
              {isLoading ? (
                 <span className="loading" style={{color: 'white'}}>
                   <span className="spinner" style={{borderColor: 'white', borderTopColor: 'transparent'}}></span>
                   Generating...
                 </span>
              ) : (
                <>{guidance ? '🎬 Continue with Guidance' : '🎬 Continue Next Turn'}</>
              )}
            </button>
            <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Next: Evolve from Turn {currentTurn - 1} | Style: {style}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationDisplay;
