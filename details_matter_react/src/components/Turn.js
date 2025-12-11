import React, { useState } from 'react';

const Turn = ({ turn, index, onRegenerate, onUndo, isLoading, isApiKeySet }) => {
  const [showRawResponse, setShowRawResponse] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

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
        <>
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
        </>
      ) : (
        // Only show error for AI turns, or if there's an explicit error on human turn (unlikely)
        (turn.model_name !== 'Human Input' || turn.error) && (
          <div className="error">
            <div>
              <strong>⚠️ No image generated</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: 'inherit' }}>
                {turn.error ? turn.error : "The model generated text but failed to produce an image."}
              </p>
              
              {/* Debug Info for User */}
              <div style={{ marginTop: '15px', fontSize: '0.8rem', opacity: 0.8 }}>
                 <details open>
                   <summary style={{cursor: 'pointer', fontWeight: 'bold'}}>Debug Details</summary>
                   <pre style={{whiteSpace: 'pre-wrap', marginTop: '5px', background: 'rgba(0,0,0,0.1)', padding: '10px', borderRadius: '4px'}}>
                     {JSON.stringify({
                       hasText: !!turn.text,
                       hasImage: !!turn.image,
                       error: turn.error,
                       turnIndex: index,
                       model: turn.model_name
                     }, null, 2)}
                   </pre>
                 </details>
              </div>

              {turn.error && (
                <div style={{ marginTop: '10px' }}>
                  <button
                    className="secondary-button"
                    onClick={() => setShowRawResponse(!showRawResponse)}
                    style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                  >
                    {showRawResponse ? 'Hide' : 'Show'} Raw Response
                  </button>
                  {showRawResponse && turn.rawResponse && (
                    <pre style={{
                      marginTop: '10px',
                      padding: '10px',
                      backgroundColor: 'rgba(0,0,0,0.1)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      overflow: 'auto',
                      maxHeight: '200px'
                    }}>
                      {JSON.stringify(turn.rawResponse, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {turn.model_name !== 'Human Input' && (
        <div className="turn-controls" style={{marginTop: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
          <button
            className="secondary-button"
            onClick={onRegenerate}
            disabled={!isApiKeySet || isLoading}
          >
            🔄 Regenerate Turn
          </button>
          <button
            className="secondary-button"
            onClick={onUndo}
            disabled={!isApiKeySet || isLoading}
          >
            ↩️ Undo Last Turn
          </button>
        </div>
      )}
    </div>
  );
};

export default Turn;
