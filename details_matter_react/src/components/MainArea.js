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
  initialImage,
  onInitialImageUpload,
  isApiKeySet,
  isLoading,
  setIsLoading,
  error,
  setError,
  success,
  setSuccess,
  onClearMessages
}) => {
  const [initialPrompt, setInitialPrompt] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const inFlightRef = useRef(false); // UI-level single-flight guard

  // Handle undo last turn
  useEffect(() => {
    const handleUndo = () => {
      if (conversation.length > 0) {
        const lastTurn = conversation[conversation.length - 1];

        // Clean up blob URLs to prevent memory leaks
        if (lastTurn.image) {
          URL.revokeObjectURL(lastTurn.image);
        }

        setConversation(prev => prev.slice(0, -1));
        setCurrentTurn(prev => Math.max(0, prev - 1));
        setSuccess('Last turn undone successfully!');
        setTimeout(() => setSuccess(null), 3000);
      }
    };

    window.addEventListener('undoLastTurn', handleUndo);
    return () => window.removeEventListener('undoLastTurn', handleUndo);
  }, [conversation, setConversation, setCurrentTurn, setSuccess]);

  // Handle initial image upload
  const handleFileUpload = (file) => {
    setUploadedFile(file);
    onInitialImageUpload(file);
  };

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
        image: uploadedFile ? URL.createObjectURL(uploadedFile) : null,
        image_description: uploadedFile ? "Initial uploaded image" : null,
        prompt: null,
        timestamp: new Date().toLocaleTimeString(),
        style: style
      };

      setConversation([humanTurn]);
      setCurrentTurn(1);

      // Generate first AI turn
      await generateNextTurn([humanTurn], 1, initialPrompt, uploadedFile);

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
      // First generation: based on initial prompt
      autoPrompt = `Generate an image based on this prompt: '${initialPromptText}'. Provide a description of the image.`;
      if (previousImageFile) {
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
      }
    } else {
      // Subsequent turns: evolve from previous image
      autoPrompt = "Based on the previous image, select one important detail for you independently of the rest of the image (e.g., a specific object, character, or element). Describe your choice in text and then create a new story, situation, anecdote or other idea in which that detail is preserved as a detail, not necessarily the main subject of the image. Then, generate a new image from your description, while keeping only this detail recognizable.";

      if (initialPromptText) {
        autoPrompt += `\n\nDirector's Guidance: ${initialPromptText}`;
      }

      // Find the most recent image
      for (let i = currentConversation.length - 1; i >= 0; i--) {
        if (currentConversation[i].image) {
          // Convert blob URL back to File object if needed
          // This is a simplified version - in practice you might need to store the original file
          previousImage = currentConversation[i].image;
          break;
        }
      }
    }

    const result = await generateContent(autoPrompt, '', previousImage, style, model);
    if (result?.metrics) {
      const kb = (n) => (n/1024).toFixed(1);
      console.log(`📊 Generation metrics: request ≈ ${kb(result.metrics.requestBytes)} KB` + (result.metrics.imageDecodedBytes ? ` | images (decoded) ≈ ${kb(result.metrics.imageDecodedBytes)} KB` : ''));
    }

    const newTurn = {
      id: Date.now(),
      model_name: 'Chief of Details',
      text: result.text,
      image: result.image,
      image_description: result.text,
      prompt: autoPrompt,
      timestamp: new Date().toLocaleTimeString(),
      style: style,
      metrics: result.metrics || null,
      error: result.error || null
    };

    setConversation(prev => [...prev, newTurn]);
    setCurrentTurn(turnNumber + 1);
  };

  // Handle regenerating a specific turn
  const handleRegenerateTurn = async (turnIndex) => {
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
        const kb = (n) => (n/1024).toFixed(1);
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
        metrics: result.metrics || turnToRegenerate.metrics || null,
        error: result.error || null
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

  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when conversation updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  return (
    <div className="main-area">
      {conversation.length === 0 ? (
        <InitialSetup
          initialPrompt={initialPrompt}
          setInitialPrompt={setInitialPrompt}
          onFileUpload={handleFileUpload}
          uploadedFile={uploadedFile}
          initialImage={initialImage}
          onStartEvolution={handleStartEvolution}
          isApiKeySet={isApiKeySet}
          isLoading={isLoading}
          style={style}
        />
      ) : (
        <>
          <ConversationDisplay
            conversation={conversation}
            onContinue={handleContinueEvolution}
            onRegenerateTurn={handleRegenerateTurn}
            currentTurn={currentTurn}
            style={style}
            isLoading={isLoading}
            isApiKeySet={isApiKeySet}
          />
          <div ref={messagesEndRef} />
        </>
      )}
      
      {conversation.length >= 4 && (
        <div className="warning" style={{ margin: '20px 0' }}>
          <strong>💰 Cost Awareness:</strong> You have generated {conversation.length} turns. 
          Generating many images can consume API credits quickly.
        </div>
      )}
    </div>
  );
};

export default MainArea;
