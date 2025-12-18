import React, { useState, useEffect, useRef } from 'react';
import Turn from './Turn';

import { STYLES } from '../constants/styles';

const ConversationDisplay = ({
  conversation,
  onContinue,
  onRegenerateTurn,
  onUndoTurn,
  onForkFromTurn,
  currentTurn,
  style,
  onStyleChange,
  isLoading,
  isApiKeySet,
  forkTurn // Turn index where this thread was forked from
}) => {
  const [guidance, setGuidance] = useState('');
  const forkPointRef = useRef(null);
  const hasScrolledRef = useRef(false);

  // Auto-scroll to fork point or first new turn when conversation loads (only once)
  useEffect(() => {
    if (forkTurn !== null && forkTurn !== undefined && !hasScrolledRef.current && conversation.length > 0) {
      // Wait for DOM to render
      const timer = setTimeout(() => {
        // Preferred scroll target: the first turn AFTER the fork point (what makes this fork unique)
        // If no new turns yet, scroll to the fork point itself.
        const scrollTargetIdx = Math.min(forkTurn + 1, conversation.length - 1);
        const scrollTarget = document.getElementById(`turn-${scrollTargetIdx}`) || forkPointRef.current;

        if (scrollTarget) {
          scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
          hasScrolledRef.current = true;
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [forkTurn, conversation.length]);

  const handleContinue = () => {
    onContinue(guidance);
    setGuidance(''); // Clear after sending
  };

  return (
    <div>
      <div className="conversation">
        {conversation.map((turn, index) => {
          const isLast = index === conversation.length - 1;
          const canRegenerate = isLast && turn?.model_name !== 'Human Input';
          const isForkPoint = forkTurn !== null && forkTurn !== undefined && index === forkTurn;

          const isForkStart = forkTurn !== null && forkTurn !== undefined && index === forkTurn + 1;

          const turnElement = (
            <React.Fragment key={turn.id || index}>
              {isForkStart && (
                <div className="fork-divider">
                  <div className="fork-divider__line"></div>
                  <div className="fork-divider__label">
                    <span className="fork-divider__icon">🌱</span>
                    <span>Fork Started Here</span>
                  </div>
                  <div className="fork-divider__line"></div>
                </div>
              )}
              <div id={`turn-${index}`}>
                <Turn
                  turn={turn}
                  index={index}
                  canRegenerate={canRegenerate}
                  onRegenerate={canRegenerate ? () => onRegenerateTurn(index) : null}
                  onUndo={onUndoTurn ? () => onUndoTurn(index) : null}
                  onFork={onForkFromTurn ? () => onForkFromTurn(index) : null}
                  isLoading={isLoading}
                  isApiKeySet={isApiKeySet}
                  isForkPoint={isForkPoint}
                />
              </div>
            </React.Fragment>
          );

          // Attach ref to fork point for scrolling
          if (isForkPoint) {
            return (
              <div key={`fork-${turn.id || index}`} ref={forkPointRef}>
                {turnElement}
              </div>
            );
          }
          return turnElement;
        })}
      </div>

      {/* Floating Action Bar */}
      {conversation.length > 0 && (
        <div className="floating-action-bar-container">
          {/* API Key Warning */}
          {!isApiKeySet && (
            <div className="api-key-warning" style={{
              background: 'linear-gradient(to right, #6d2020, #4a1515)',
              border: '1px solid #8b3030',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#ffcccc',
              fontFamily: "'Cinzel', serif",
              fontSize: '0.9rem'
            }}>
              <span style={{ fontSize: '1.2rem' }}>🔑</span>
              <span>API Key not set. Open <strong>⚙️ Settings</strong> to add your Gemini API key.</span>
            </div>
          )}
          <div className="floating-action-bar">
            {/* Input - Grow to fill space */}
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

            {/* Info & Controls Group */}
            <div className="floating-action-bar__controls">
              <span className="floating-action-bar__turn-info">
                Turn {currentTurn}
              </span>

              <div className="floating-action-bar__style-selector">
                <select
                  value={style}
                  onChange={(e) => onStyleChange && onStyleChange(e.target.value)}
                  disabled={isLoading}
                  title="Change Art Style"
                >
                  {STYLES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <button
                className="primary-button compact"
                onClick={handleContinue}
                disabled={!isApiKeySet || isLoading}
              >
                {isLoading ? (
                  <span className="spinner small"></span>
                ) : (
                  guidance ? '🎬 Run' : '➡️ Next'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default ConversationDisplay;
