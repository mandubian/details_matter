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
      </div>

      {/* Floating Action Bar */}
      {conversation.length > 0 && (
        <div className="floating-action-bar">
          <input
            type="text"
            className="floating-action-bar__input"
            placeholder="🎬 Steer the story... (optional)"
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isLoading && isApiKeySet) {
                handleContinue();
              }
            }}
          />

          <span className="floating-action-bar__info">
            Turn {currentTurn} · {style}
          </span>

          <button
            className="primary-button"
            onClick={handleContinue}
            disabled={!isApiKeySet || isLoading}
          >
            {isLoading ? (
              <span className="loading">
                <span className="spinner"></span>
                Generating...
              </span>
            ) : (
              guidance ? '🎬 Continue' : '➡️ Next Turn'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ConversationDisplay;
