import React, { useState, useRef, useCallback } from 'react';

const Turn = ({ turn, index, canRegenerate = false, onRegenerate, onUndo, onFork, isLoading, isApiKeySet }) => {
  // eslint-disable-next-line no-unused-vars
  const [showRawResponse, setShowRawResponse] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showFullText, setShowFullText] = useState(false);

  // Zoom modal state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(null);
  const imageRef = useRef(null);

  // Extract first sentence for summary
  const getFirstSentence = (text) => {
    if (!text) return '';
    const sentences = text.split(/[.!?]+/);
    return sentences[0].trim() + (sentences[0].trim() ? '.' : '');
  };

  const firstSentence = getFirstSentence(turn.text);
  const hasMoreText = turn.text && turn.text.length > firstSentence.length;

  // Reset zoom when modal closes
  const handleCloseZoom = useCallback(() => {
    setIsZoomed(false);
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setZoomLevel(prev => Math.min(Math.max(prev + delta, 0.5), 5));
  }, []);

  // Mouse pan start
  const handleMouseDown = useCallback((e) => {
    if (zoomLevel > 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  }, [zoomLevel, panPosition]);

  // Mouse pan move
  const handleMouseMove = useCallback((e) => {
    if (isPanning && zoomLevel > 1) {
      setPanPosition({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, zoomLevel, panStart]);

  // Mouse pan end
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Touch pinch zoom and pan
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && zoomLevel > 1) {
      setIsPanning(true);
      setPanStart({ x: e.touches[0].clientX - panPosition.x, y: e.touches[0].clientY - panPosition.y });
    }
  }, [zoomLevel, panPosition]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && lastTouchDistance !== null) {
      e.preventDefault();
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = distance / lastTouchDistance;
      setZoomLevel(prev => Math.min(Math.max(prev * scale, 0.5), 5));
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && isPanning && zoomLevel > 1) {
      setPanPosition({ x: e.touches[0].clientX - panStart.x, y: e.touches[0].clientY - panStart.y });
    }
  }, [lastTouchDistance, isPanning, zoomLevel, panStart]);

  const handleTouchEnd = useCallback(() => {
    setLastTouchDistance(null);
    setIsPanning(false);
  }, []);

  // Double tap/click to reset zoom
  const handleDoubleClick = useCallback(() => {
    if (zoomLevel === 1) {
      setZoomLevel(2);
    } else {
      setZoomLevel(1);
      setPanPosition({ x: 0, y: 0 });
    }
  }, [zoomLevel]);

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
            <div
              className="image-modal"
              onClick={handleCloseZoom}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ cursor: zoomLevel > 1 ? 'grab' : 'zoom-in' }}
            >
              <img
                ref={imageRef}
                src={turn.image}
                alt={`Zoomed turn ${index}`}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={handleDoubleClick}
                style={{
                  transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                  transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                  cursor: isPanning ? 'grabbing' : (zoomLevel > 1 ? 'grab' : 'zoom-in')
                }}
              />
              <div className="image-modal__controls">
                <button onClick={(e) => { e.stopPropagation(); setZoomLevel(prev => Math.min(prev + 0.5, 5)); }}>➕</button>
                <span>{Math.round(zoomLevel * 100)}%</span>
                <button onClick={(e) => { e.stopPropagation(); setZoomLevel(prev => Math.max(prev - 0.5, 0.5)); }}>➖</button>
                <button onClick={(e) => { e.stopPropagation(); setZoomLevel(1); setPanPosition({ x: 0, y: 0 }); }}>↺</button>
              </div>
              <div className="image-modal__hint">Scroll/pinch to zoom • Drag to pan • Double-tap to toggle • Tap backdrop to close</div>
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
                {turn.error || "The model couldn't generate an image for this content."}
              </p>
              <p style={{ margin: '10px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                💡 <strong>Tips:</strong> Try regenerating, steer the story differently, or try again later — providers sometimes have temporary issues.
              </p>
              {turn.text && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px 12px',
                  background: 'rgba(0,0,0,0.1)',
                  borderRadius: '6px',
                  borderLeft: '3px solid var(--gold-mid)',
                }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Generated Story Text:
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic' }}>
                    {turn.text}
                  </p>
                </div>
              )}
              <details style={{ marginTop: '10px', fontSize: '0.8rem' }}>
                <summary style={{ cursor: 'pointer' }}>Debug Details</summary>
                <pre style={{ whiteSpace: 'pre-wrap', marginTop: '5px', background: 'rgba(0,0,0,0.1)', padding: '10px', borderRadius: '4px' }}>
                  {JSON.stringify({
                    prompt: turn.prompt || '(not captured)',
                    text: turn.text || null,
                    hasImage: !!turn.image,
                    error: turn.error,
                    turnIndex: index
                  }, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )
      )}

      {/* Text caption area */}
      {
        turn.text && (
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
        )
      }

      {/* Action buttons */}
      {
        (turn.model_name !== 'Human Input' || onFork) && (
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
            {(turn.image || turn.error) && onUndo && (
              <button className="turn-action-btn" onClick={onUndo} disabled={isLoading}>
                ↩️ Undo
              </button>
            )}
          </div>
        )
      }
    </div >
  );
};

export default Turn;
