import React, { useState, useEffect, useRef } from 'react';
import ConversationDisplay from './ConversationDisplay';
import InitialSetup from './InitialSetup';

const MainArea = ({
  conversation,
  setConversation,
  currentTurn,
  setCurrentTurn,
  style,
  model,
  isApiKeySet,
  isLoading,
  setIsLoading,
  error,
  setError,
  success,
  setSuccess,
  onClearMessages,
  forkInfo,
  threadId,
  onForkFromTurn,
  onStyleChange,
  isRemote,
  onForkThread,
  onUploadThread
}) => {
  const [initialPrompt, setInitialPrompt] = useState('');
  const isCloud = isRemote; // Alias for cloud status check
  const inFlightRef = useRef(false); // UI-level single-flight guard

  // Handle undo last turn
  const handleUndoTurn = () => {
    if (conversation.length > 0) {
      const lastTurn = conversation[conversation.length - 1];

      // Clean up blob URLs to prevent memory leaks (images are usually data: URLs now)
      if (lastTurn.image && typeof lastTurn.image === 'string' && lastTurn.image.startsWith('blob:')) {
        URL.revokeObjectURL(lastTurn.image);
      }

      setConversation(prev => prev.slice(0, -1));
      setCurrentTurn(prev => Math.max(0, prev - 1));
      setSuccess('Last turn undone successfully!');
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  useEffect(() => {
    window.addEventListener('undoLastTurn', handleUndoTurn);
    return () => window.removeEventListener('undoLastTurn', handleUndoTurn);
  }); // Updated on every render to capture closure state

  // Handle starting the evolution
  const handleStartEvolution = async () => {
    if (inFlightRef.current || isLoading) return; // prevent concurrent start
    if (!initialPrompt.trim()) {
      setError('Please enter an initial prompt');
      return;
    }

    if (!isApiKeySet) {
      setError('Please set your API key first');
      return;
    }

    setIsLoading(true);
    inFlightRef.current = true;
    setError(null);
    onClearMessages();

    try {
      // Add human input as turn 0
      const humanTurn = {
        id: Date.now(),
        model_name: 'Human Input',
        text: initialPrompt,
        image: null,
        image_description: null,
        prompt: null,
        timestamp: new Date().toLocaleTimeString(),
        style: style
      };

      setConversation([humanTurn]);
      setCurrentTurn(1);

      // Generate first AI turn
      await generateNextTurn([humanTurn], 1, initialPrompt, null);

      setSuccess('First image generated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  };

  // Handle continuing the evolution
  const handleContinueEvolution = async (guidance = '') => {
    if (isRemote) {
      if (window.confirm('This thread is read-only. Would you like to fork it to continue?')) {
        onForkThread();
      }
      return;
    }
    if (inFlightRef.current || isLoading) return; // prevent concurrent continue
    if (!isApiKeySet) {
      setError('Please set your API key first');
      return;
    }

    setIsLoading(true);
    inFlightRef.current = true;
    setError(null);
    onClearMessages();

    try {
      // Pass guidance to influence the next generation
      await generateNextTurn(conversation, currentTurn, guidance, null);
      setSuccess(`Turn ${currentTurn + 1} generated successfully!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  };

  // Core generation logic
  const generateNextTurn = async (currentConversation, turnNumber, initialPromptText = '', previousImageFile = null) => {
    const { generateContent } = await import('../utils/googleAI');

    let autoPrompt;
    let previousImage = null;

    if (turnNumber === 1) {
      // First generation
      if (previousImageFile) {
        // If user provided an image, use the detail-focused prompt to start the evolution
        const basePrompt = "Based on the provided image, select one important detail for you independently of the rest of the image (e.g., a specific object, character, or element). Describe your choice in text and then create a new story, situation, anecdote or other idea in which that detail is preserved as a detail, not necessarily the main subject of the image. Then, generate a new image from your description, while keeping only this detail recognizable.";

        // Incorporate user guidance if provided
        if (initialPromptText && initialPromptText.trim()) {
          autoPrompt = `${basePrompt}\n\nUser direction: ${initialPromptText.trim()}`;
        } else {
          autoPrompt = basePrompt;
        }

        // Convert File object to data URL if needed
        if (previousImageFile instanceof File) {
          const reader = new FileReader();
          previousImage = await new Promise((resolve) => {
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(previousImageFile);
          });
        } else {
          previousImage = previousImageFile;
        }
      } else {
        // No image provided - use simple generation prompt
        autoPrompt = `Generate an image based on this prompt: '${initialPromptText}'. Provide a description of the image.`;
      }
    } else {
      // Subsequent turns: evolve from previous image
      const basePrompt = "Based on the previous image, select one important detail for you independently of the rest of the image (e.g., a specific object, character, or element). Describe your choice in text and then create a new story, situation, anecdote or other idea in which that detail is preserved as a detail, not necessarily the main subject of the image. Then, generate a new image from your description, while keeping only this detail recognizable.";

      // Incorporate user guidance if provided
      if (initialPromptText && initialPromptText.trim()) {
        autoPrompt = `${basePrompt}\n\nUser direction: ${initialPromptText.trim()}`;
      } else {
        autoPrompt = basePrompt;
      }

      // Find the most recent image
      for (let i = currentConversation.length - 1; i >= 0; i--) {
        if (currentConversation[i].image) {
          previousImage = currentConversation[i].image;
          break;
        }
      }
    }

    const result = await generateContent(autoPrompt, '', previousImage, style, model);
    if (result?.metrics) {
      const kb = (n) => (n / 1024).toFixed(1);
      console.log(`📊 Generation metrics: request ≈ ${kb(result.metrics.requestBytes)} KB` + (result.metrics.imageDecodedBytes ? ` | images (decoded) ≈ ${kb(result.metrics.imageDecodedBytes)} KB` : ''));
    }

    // Log if image was declined
    if (result?.finishReason === 'IMAGE_OTHER') {
      console.warn('⚠️ Image generation was declined by API:', result.finishMessage);
    }

    // Handle case where fallback generation returns image but no text
    const fallbackText = result.image && !result.text
      ? '(Image generated via fallback - no description available)'
      : null;
    const finalText = result.text || fallbackText;

    const newTurn = {
      id: Date.now(),
      model_name: 'Chief of Details',
      text: finalText,
      image: result.image,
      image_description: finalText || 'Generated image',
      prompt: autoPrompt,
      timestamp: new Date().toLocaleTimeString(),
      style: style,
      metrics: result.metrics || null,
      // Include error context if image generation was declined
      error: (!result.image && result.finishReason === 'IMAGE_OTHER')
        ? `Image declined: ${result.finishMessage || 'The model could not generate this image. Try a different prompt.'}`
        : null
    };

    setConversation(prev => [...prev, newTurn]);
    setCurrentTurn(turnNumber + 1);
  };

  // Handle regenerating a specific turn
  const handleRegenerateTurn = async (turnIndex) => {
    if (isRemote) {
      if (window.confirm('This thread is read-only. Would you like to fork it to regenerate?')) {
        onForkThread();
      }
      return;
    }
    if (inFlightRef.current || isLoading) return; // prevent concurrent regenerate
    if (!isApiKeySet) {
      setError('Please set your API key first');
      return;
    }

    setIsLoading(true);
    inFlightRef.current = true;
    setError(null);
    onClearMessages();

    try {
      const { generateContent } = await import('../utils/googleAI');

      // Get the prompt from the turn to regenerate
      const turnToRegenerate = conversation[turnIndex];
      const prompt = turnToRegenerate.prompt;

      // Find previous image
      let previousImage = null;
      for (let i = turnIndex - 1; i >= 0; i--) {
        if (conversation[i].image) {
          previousImage = conversation[i].image;
          break;
        }
      }

      const result = await generateContent(prompt, '', previousImage, style, model);
      if (result?.metrics) {
        const kb = (n) => (n / 1024).toFixed(1);
        console.log(`📊 Regeneration metrics: request ≈ ${kb(result.metrics.requestBytes)} KB` + (result.metrics.imageDecodedBytes ? ` | images (decoded) ≈ ${kb(result.metrics.imageDecodedBytes)} KB` : ''));
      }

      // Clean up old blob URL
      if (turnToRegenerate.image) {
        URL.revokeObjectURL(turnToRegenerate.image);
      }

      const updatedTurn = {
        ...turnToRegenerate,
        text: result.text,
        image: result.image,
        image_description: result.text,
        timestamp: new Date().toLocaleTimeString(),
        metrics: result.metrics || turnToRegenerate.metrics || null
      };

      const newConversation = [...conversation];
      newConversation[turnIndex] = updatedTurn;
      setConversation(newConversation);

      setSuccess(`Turn ${turnIndex} regenerated successfully!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  };

  return (
    <div className="main-area">
      {(isCloud || forkInfo?.isParentCloud) ? (
        <div style={{
          margin: '18px 18px 0 18px',
          padding: '12px 20px',
          borderRadius: '4px',
          background: 'linear-gradient(to right, #f2e1c9, #e8d0ae)',
          border: '1.5px solid #a67c52',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          clipPath: 'polygon(1.5% 0%, 100% 0%, 98.5% 50%, 100% 100%, 1.5% 100%, 0% 50%)'
        }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <span style={{ fontSize: '1.8rem' }}>🏛️</span>
            <div>
              <div style={{ fontWeight: 800, color: '#3d2b1f', fontFamily: "'Cinzel', serif", fontSize: '1.05rem', letterSpacing: '0.5px' }}>PUBLISHED</div>
              <div style={{ color: '#5c4033', fontSize: '0.85rem', fontStyle: 'italic' }}>
                {isCloud ? 'Part of the Grand Exhibition.' : 'Evolution of a Published Study.'}
              </div>
            </div>
          </div>
          {isCloud && (
            <button
              className="rpg-btn-small"
              onClick={onForkThread}
              style={{
                padding: '8px 20px',
                background: 'linear-gradient(to bottom, #8b5a2b, #5c4033)',
                color: '#fff8e7',
                border: '1px solid #c5a059',
                boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
                fontWeight: 800,
                fontSize: '0.7rem'
              }}
            >
              🌱 STUDY & FORK
            </button>
          )}
        </div>
      ) : (
        <div style={{
          margin: '18px 18px 0 18px',
          padding: '10px 20px',
          borderRadius: '4px',
          background: 'linear-gradient(to right, #e8ede3, #d4dbcd)',
          border: '1.5px solid #8b9a7d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          clipPath: 'polygon(1.5% 0%, 100% 0%, 98.5% 50%, 100% 100%, 1.5% 100%, 0% 50%)',
          maxWidth: '100%',
          overflow: 'hidden',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Art Nouveau style study/home icon */}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M12 3L2 10V21H9V14H15V21H22V10L12 3Z" stroke="#3d4a35" strokeWidth="1.5" fill="none" />
              <path d="M12 3C12 3 10 6 10 8C10 9.5 11 10 12 10C13 10 14 9.5 14 8C14 6 12 3 12 3Z" fill="#8b9a7d" opacity="0.6" />
              <circle cx="12" cy="12" r="2" stroke="#3d4a35" strokeWidth="1" fill="#e8ede3" />
              <path d="M6 21C6 21 6 18 6 17C6 16 7 15.5 8 16C9 16.5 9 17 9 17" stroke="#8b9a7d" strokeWidth="0.8" fill="none" strokeLinecap="round" />
              <path d="M18 21C18 21 18 18 18 17C18 16 17 15.5 16 16C15 16.5 15 17 15 17" stroke="#8b9a7d" strokeWidth="0.8" fill="none" strokeLinecap="round" />
            </svg>
            <div>
              <div style={{ fontWeight: 800, color: '#3d4a35', fontFamily: "'Cinzel', serif", fontSize: '0.9rem', letterSpacing: '0.5px' }}>LOCAL STUDY</div>
              <div style={{ color: '#5c6a51', fontSize: '0.8rem' }}>
                Stored in your personal collection.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Heritage indicator if forked from cloud */}
            {forkInfo?.isParentCloud && (
              <span style={{
                background: 'linear-gradient(to right, #f2e1c9, #e8d0ae)',
                border: '1px solid #a67c52',
                padding: '4px 10px',
                borderRadius: '3px',
                fontSize: '0.65rem',
                fontWeight: 800,
                color: '#3d2b1f',
                fontFamily: "'Cinzel', serif"
              }}>
                🏛️ From Exhibition
              </span>
            )}

            {!isCloud && onUploadThread && conversation.length >= 2 && (
              <button
                className="rpg-btn-small"
                onClick={onUploadThread}
                style={{
                  padding: '6px 15px',
                  background: 'linear-gradient(to bottom, #5c6a51, #3d4a35)',
                  color: '#f0f7ed',
                  border: '1px solid #8b9a7d',
                  fontWeight: 800,
                  fontSize: '0.65rem'
                }}
              >
                🏛️ PUBLISH
              </button>
            )}
          </div>
        </div>
      )}

      {forkInfo?.parentId && (
        <div
          style={{
            margin: '14px 18px 0 18px',
            padding: '12px 14px',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            background: 'rgba(255,255,255,0.03)',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          {forkInfo?.parentImage ? (
            <img
              src={forkInfo.parentImage}
              alt="Fork origin"
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '12px',
                objectFit: 'cover',
                border: '1px solid rgba(255,255,255,0.10)'
              }}
            />
          ) : null}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              🌱 Following a {forkInfo?.isParentCloud ? 'Published' : 'Local'} Study
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              From {String(forkInfo.parentId).slice(0, 10)}… at turn {Number.isFinite(forkInfo.parentTurn) ? forkInfo.parentTurn : '?'}
            </div>
          </div>
        </div>
      )}

      {/* Show InitialSetup if: no conversation OR only a human input turn (allows editing prompt after undo) */}
      {conversation.length === 0 || (conversation.length === 1 && conversation[0].model_name === 'Human Input') ? (
        <InitialSetup
          initialPrompt={initialPrompt || (conversation[0]?.text || '')}
          setInitialPrompt={setInitialPrompt}
          onStartEvolution={handleStartEvolution}
          isApiKeySet={isApiKeySet}
          isLoading={isLoading}
          style={style}
        />
      ) : (
        <ConversationDisplay
          conversation={conversation}
          onContinue={handleContinueEvolution}
          onRegenerateTurn={handleRegenerateTurn}
          onUndoTurn={handleUndoTurn}
          onForkFromTurn={onForkFromTurn}
          currentTurn={currentTurn}
          style={style}
          onStyleChange={onStyleChange}
          isLoading={isLoading}
          isApiKeySet={isApiKeySet}
          forkTurn={forkInfo?.parentTurn}
        />
      )}
    </div>
  );
};

export default MainArea;
