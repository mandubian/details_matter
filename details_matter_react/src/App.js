import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MainArea from './components/MainArea';
import Gallery from './components/Gallery';
import { initializeGoogleAI, AVAILABLE_MODELS } from './utils/googleAI';
import { uploadThread, fetchThread } from './services/cloudService';
import { compressConversation } from './utils/imageUtils';

function App() {
  // Initialize state from localStorage immediately to prevent overwriting on first render
  const getInitialState = () => {
    try {
      const savedConversationRaw = localStorage.getItem('details_matter_conversation');
      const savedConversation = savedConversationRaw ? JSON.parse(savedConversationRaw) : [];
      const savedCurrentTurn = localStorage.getItem('details_matter_current_turn');
      const savedStyle = localStorage.getItem('details_matter_style');
      const savedModel = localStorage.getItem('details_matter_model');
      const savedApiKey = localStorage.getItem('details_matter_api_key');
      const savedThreadId = localStorage.getItem('details_matter_thread_id');
      const savedGalleryRaw = localStorage.getItem('details_matter_gallery');
      const savedForkInfoRaw = localStorage.getItem('details_matter_fork_info');
      
      const computedTurn = savedCurrentTurn
        ? parseInt(savedCurrentTurn, 10)
        : (savedConversation ? savedConversation.length : 0);

      return {
        conversation: savedConversation,
        currentTurn: Number.isFinite(computedTurn) ? computedTurn : 0,
        style: savedStyle || 'Photorealistic',
        model: savedModel || 'gemini-2.5-flash',
        apiKey: savedApiKey || '',
        isApiKeySet: !!savedApiKey,
        threadId: savedThreadId || `thread-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,
        gallery: savedGalleryRaw ? JSON.parse(savedGalleryRaw) : [],
        forkInfo: savedForkInfoRaw ? JSON.parse(savedForkInfoRaw) : null,
      };
    } catch (err) {
      console.error('Error loading initial state:', err);
      return {
        conversation: [],
        currentTurn: 0,
        style: 'Photorealistic',
        model: 'gemini-2.5-flash',
        apiKey: '',
        isApiKeySet: false,
        threadId: `thread-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,
        gallery: [],
        forkInfo: null,
      };
    }
  };

  const initialState = getInitialState();
  
  // State management
  const [apiKey, setApiKey] = useState(initialState.apiKey);
  const [isApiKeySet, setIsApiKeySet] = useState(initialState.isApiKeySet);
  const [conversation, setConversation] = useState(initialState.conversation);
  const [currentTurn, setCurrentTurn] = useState(initialState.currentTurn);
  const [style, setStyle] = useState(initialState.style);
  const [model, setModel] = useState(initialState.model);
  const [initialImage, setInitialImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [threadId, setThreadId] = useState(initialState.threadId);
  const [gallery, setGallery] = useState(initialState.gallery);
  const [forkInfo, setForkInfo] = useState(initialState.forkInfo);
  const [showGallery, setShowGallery] = useState(false);
  const MAX_GALLERY_ITEMS = 20;

  // Initialize Google AI if API key was loaded
  useEffect(() => {
    if (initialState.apiKey) {
      try {
        initializeGoogleAI(initialState.apiKey);
        console.log('✅ Initialized Google AI with saved API key');
      } catch (error) {
        console.error('❌ Failed to initialize Google AI:', error);
      }
    }
    
    if (initialState.conversation.length > 0) {
      console.log('📂 Loaded conversation from localStorage:', initialState.conversation.length, 'turns');
    }

    // Listen for session imports
    const handleImportSession = (event) => {
      const { conversation: newConversation, style: newStyle } = event.detail;
      
      if (newConversation) {
        setConversation(newConversation);
        // Recalculate turn based on conversation length
        setCurrentTurn(newConversation.length);
      }
      
      if (newStyle) {
        setStyle(newStyle);
      }
      
      setSuccess('Session imported successfully!');
      setTimeout(() => setSuccess(null), 3000);
    };

    window.addEventListener('importSession', handleImportSession);

    // Cleanup
    return () => {
      window.removeEventListener('importSession', handleImportSession);
    };
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('details_matter_api_key', apiKey);
    }
  }, [apiKey]);

  useEffect(() => {
    // Only save non-empty conversations (prevents clearing on initial mount)
    if (conversation.length > 0) {
      try {
        const serialized = JSON.stringify(conversation);
        localStorage.setItem('details_matter_conversation', serialized);
        console.log('💾 Saved conversation to localStorage:', conversation.length, 'turns');
      } catch (err) {
        console.error('❌ Failed to store conversation:', err);
        if (err.name === 'QuotaExceededError') {
          console.warn('⚠️ localStorage quota exceeded. Consider using IndexedDB for large conversations.');
        }
      }
    }
  }, [conversation]);

  useEffect(() => {
    localStorage.setItem('details_matter_current_turn', currentTurn.toString());
  }, [currentTurn]);

  useEffect(() => {
    localStorage.setItem('details_matter_style', style);
  }, [style]);

  useEffect(() => {
    localStorage.setItem('details_matter_model', model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem('details_matter_thread_id', threadId);
  }, [threadId]);

  useEffect(() => {
    try {
      localStorage.setItem('details_matter_gallery', JSON.stringify(gallery));
    } catch (err) {
      console.error('❌ Failed to store gallery:', err);
      if (err.name === 'QuotaExceededError' && gallery.length > 1) {
        // prune and retry
        const pruned = gallery.slice(0, Math.max(1, Math.floor(gallery.length / 2)));
        setGallery(pruned);
      }
    }
  }, [gallery]);

  useEffect(() => {
    if (forkInfo) {
      localStorage.setItem('details_matter_fork_info', JSON.stringify(forkInfo));
    }
  }, [forkInfo]);

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

  // Handle model change
  const handleModelChange = (newModel) => {
    setModel(newModel);
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

  // Handle Cloud Publishing
  const handlePublishCloud = async () => {
    setIsLoading(true);
    try {
      const threadData = {
        threadId,
        conversation,
        style,
        model,
        forkInfo,
        timestamp: new Date().toISOString()
      };
      
      const result = await uploadThread(threadData);
      setSuccess(`Published to Cloud! ID: ${result.id}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Publish failed:', err);
      setError('Failed to publish: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Local Gallery Save (Compressed)
  const handleAddToGallery = async () => {
    setIsLoading(true);
    try {
      // Compress for storage
      const compressedConv = await compressConversation(conversation);
      
      const title = conversation[0]?.text?.slice(0, 80) || 'Untitled Thread';
      const entry = {
        id: threadId,
        title,
        conversation: compressedConv,
        style,
        model,
        timestamp: new Date().toISOString(),
        forkInfo: forkInfo || null,
        threadId,
        thumbnail: compressedConv.find(t => t.image)?.image || null
      };

      setGallery(prev => {
        const deduped = prev.filter(e => e.id !== threadId);
        const next = [entry, ...deduped].slice(0, MAX_GALLERY_ITEMS);
        return next;
      });
      setSuccess('Saved to Local Gallery (Compressed).');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Gallery save failed:', err);
      setError('Failed to save to gallery.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectThread = async (entry, isCloud = false) => {
    try {
      let data = entry;
      if (isCloud) {
        setIsLoading(true);
        data = await fetchThread(entry.id);
        setIsLoading(false);
      }

      if (data.conversation) {
        setConversation(data.conversation);
        setCurrentTurn(data.conversation.length);
        setStyle(data.style || style);
        setModel(data.model || model);
        setThreadId(data.threadId || `thread-${Date.now()}`);
        setForkInfo(data.forkInfo || null);
        
        setShowGallery(false);
        setSuccess('Thread loaded successfully.');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Load failed:', err);
      setError('Failed to load thread.');
      setIsLoading(false);
    }
  };

  const handleImportCloudThread = (id) => {
    handleSelectThread({ id }, true);
  };

  const handleNewThread = () => {
    if (window.confirm('Start a new thread? This will clear the current conversation.')) {
      // Clear persistence keys
      localStorage.removeItem('details_matter_conversation');
      localStorage.removeItem('details_matter_current_turn');
      localStorage.removeItem('details_matter_thread_id');
      localStorage.removeItem('details_matter_fork_info');
      
      // Reload to reset state cleanly
      window.location.reload();
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🎨 Only Details Matter</h1>
        <p>
          Iteratively test how a generative model latches onto a single visual detail in an image
          and reimagines it inside entirely new scenes of its creation. (Cinematic Update)
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
          model={model}
          onModelChange={handleModelChange}
          onContinue={null}
          isLoading={isLoading}
          error={error}
          success={success}
          onClearMessages={clearMessages}
          onOpenGallery={() => setShowGallery(true)}
          onPublishCloud={handlePublishCloud}
          onAddToGallery={handleAddToGallery}
          gallery={gallery}
          onNewThread={handleNewThread}
        />

        {showGallery && (
          <Gallery 
            localGallery={gallery} 
            onSelectThread={(t) => handleSelectThread(t, false)}
            onImportCloudThread={handleImportCloudThread}
            onClose={() => setShowGallery(false)}
          />
        )}

        <MainArea
          conversation={conversation}
          setConversation={setConversation}
          currentTurn={currentTurn}
          setCurrentTurn={setCurrentTurn}
          style={style}
          model={model}
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
          forkInfo={forkInfo}
          threadId={threadId}
        />
      </div>
    </div>
  );
}

export default App;

