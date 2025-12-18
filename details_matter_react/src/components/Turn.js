import React, { useState } from 'react';

const Turn = ({ turn, index, canRegenerate = false, onRegenerate, onUndo, onFork, isLoading, isApiKeySet }) => {
  // eslint-disable-next-line no-unused-vars
  const [showRawResponse, setShowRawResponse] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showFullText, setShowFullText] = useState(false);

  // Extract first sentence for summary
  const getFirstSentence = (text) => {
    if (!text) return '';
    const sentences = text.split(/[.!?]+/);
    return sentences[0].trim() + (sentences[0].trim() ? '.' : '');
  };

  const firstSentence = getFirstSentence(turn.text);
  const hasMoreText = turn.text && turn.text.length > firstSentence.length;

  return (
    <div className="turn">
      {/* Image-first layout */}
      {turn.image ? (
        <div className="turn-image-container">
          {/* Header overlay on image */}
          <div className="turn-image-header">
            <span className="turn-image-label">
              {turn.model_name === 'Human Input' ? '👤 Initial' : `🎨 Turn ${index}`}
            </span>
            <span className="turn-image-style">{turn.style || ''}</span>
          </div>

          <img
            src={turn.image}
            alt={turn.image_description || `Generated image for turn ${index}`}
            className="turn-image"
            onClick={() => setIsZoomed(true)}
          />

          {isZoomed && (
            <div className="image-modal" onClick={() => setIsZoomed(false)}>
              <img
                src={turn.image}
                alt={`Zoomed turn ${index}`}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      ) : (
        /* No image - show error for AI turns only */
        ((turn.model_name !== 'Human Input' && !turn.image) || (turn.error && turn.model_name === 'Human Input')) && (
          <div className="turn-no-image">
            <div className="turn-image-header">
              <span className="turn-image-label">🎨 Turn {index}</span>
            </div>
            <div className="error" style={{ margin: '20px' }}>
              <strong>⚠️ No image generated</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem' }}>
                {turn.error || "The model generated text but failed to produce an image... Try again later, providers are often overloaded"}
              </p>
              {turn.error && (
                <details style={{ marginTop: '10px', fontSize: '0.8rem' }}>
                  <summary style={{ cursor: 'pointer' }}>Debug Details</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', marginTop: '5px', background: 'rgba(0,0,0,0.1)', padding: '10px', borderRadius: '4px' }}>
                    {JSON.stringify({ hasText: !!turn.text, hasImage: !!turn.image, error: turn.error, turnIndex: index }, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )
      )}

      {/* Text caption area */}
      {turn.text && (
        <div className="turn-caption">
          <p className="turn-caption-text">
            <strong>{firstSentence}</strong>
            {showFullText && hasMoreText && (
              <span>{turn.text.slice(firstSentence.length)}</span>
            )}
          </p>
          {hasMoreText && (
            <button
              className="turn-caption-toggle"
              onClick={() => setShowFullText(!showFullText)}
            >
              {showFullText ? '▲ Less' : '▼ More'}
            </button>
          )}
        </div>
      )}

      {/* Action buttons */}
      {(turn.model_name !== 'Human Input' || onFork) && (
        <div className="turn-actions">
          {onFork && (
            <button className="turn-action-btn" onClick={onFork} disabled={isLoading}>
              🌱 Fork
            </button>
          )}
          {turn.model_name !== 'Human Input' && canRegenerate && onRegenerate && (
            <button className="turn-action-btn" onClick={onRegenerate} disabled={!isApiKeySet || isLoading}>
              🔄 Regenerate
            </button>
          )}
          {turn.image && onUndo && (
            <button className="turn-action-btn" onClick={onUndo} disabled={isLoading}>
              ↩️ Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Turn;
