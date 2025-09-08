import React, { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import MainArea from './components/MainArea';
import { initializeGoogleAI } from './utils/googleAI';

function App() {
  // State management
  const [apiKey, setApiKey] = useState('');
  const [isApiKeySet, setIsApiKeySet] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [style, setStyle] = useState('Photorealistic');
  const [initialImage, setInitialImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('details_matter_api_key');
    const savedConversation = localStorage.getItem('details_matter_conversation');
    const savedCurrentTurn = localStorage.getItem('details_matter_current_turn');
    const savedStyle = localStorage.getItem('details_matter_style');

    if (savedApiKey) {
      setApiKey(savedApiKey);
      setIsApiKeySet(true);
      try {
        initializeGoogleAI(savedApiKey);
      } catch (error) {
        console.error('Failed to initialize Google AI:', error);
      }
    }

    if (savedConversation) {
      try {
        setConversation(JSON.parse(savedConversation));
      } catch (error) {
        console.error('Failed to parse saved conversation:', error);
      }
    }

    if (savedCurrentTurn) {
      setCurrentTurn(parseInt(savedCurrentTurn, 10));
    }

    if (savedStyle) {
      setStyle(savedStyle);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('details_matter_api_key', apiKey);
    }
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('details_matter_conversation', JSON.stringify(conversation));
  }, [conversation]);

  useEffect(() => {
    localStorage.setItem('details_matter_current_turn', currentTurn.toString());
  }, [currentTurn]);

  useEffect(() => {
    localStorage.setItem('details_matter_style', style);
  }, [style]);

  // Handle API key setting
  const handleApiKeySet = (newApiKey) => {
    console.log('🔑 Setting API key:', newApiKey.substring(0, 8) + '...');
    try {
      initializeGoogleAI(newApiKey);
      setApiKey(newApiKey);
      setIsApiKeySet(true);
      setError(null);
      setSuccess('API key set successfully!');
      setTimeout(() => setSuccess(null), 3000);
      console.log('✅ API key set successfully');
    } catch (error) {
      console.error('❌ Failed to set API key:', error);
      setError(error.message);
      setIsApiKeySet(false);
    }
  };

  // Handle API key override
  const handleApiKeyOverride = (newApiKey) => {
    console.log('🔄 API key override requested:', newApiKey.substring(0, 8) + '...');
    if (newApiKey.trim()) {
      console.log('🔄 Calling handleApiKeySet with new key');
      handleApiKeySet(newApiKey.trim());
      setSuccess('API key overridden successfully!');
    } else {
      console.log('⚠️ Override cancelled - empty key provided');
      setError('Please provide a valid API key');
    }
  };

  // Handle style change
  const handleStyleChange = (newStyle) => {
    setStyle(newStyle);
  };

  // Handle initial image upload
  const handleInitialImageUpload = (file) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setInitialImage(e.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      setInitialImage(null);
    }
  };

  // Clear messages
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🎨 Only Details Matter</h1>
        <p>
          Iteratively test how a generative model latches onto a single visual detail in an image
          and reimagines it inside entirely new scenes of its creation.
        </p>
        <p>
          Each turn: the model picks one salient detail from the previous image (a shape, object, texture, motif)
          and invents a different context that preserves only that detail's recognizable identity.
        </p>
      </header>

      <div className="main-content">
        <Sidebar
          apiKey={apiKey}
          isApiKeySet={isApiKeySet}
          onApiKeySet={handleApiKeySet}
          onApiKeyOverride={handleApiKeyOverride}
          conversation={conversation}
          currentTurn={currentTurn}
          style={style}
          onStyleChange={handleStyleChange}
          onContinue={null} // Will be implemented in MainArea
          isLoading={isLoading}
          error={error}
          success={success}
          onClearMessages={clearMessages}
        />

        <MainArea
          conversation={conversation}
          setConversation={setConversation}
          currentTurn={currentTurn}
          setCurrentTurn={setCurrentTurn}
          style={style}
          initialImage={initialImage}
          onInitialImageUpload={handleInitialImageUpload}
          isApiKeySet={isApiKeySet}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          error={error}
          setError={setError}
          success={success}
          setSuccess={setSuccess}
          onClearMessages={clearMessages}
        />
      </div>
    </div>
  );
}

export default App;
