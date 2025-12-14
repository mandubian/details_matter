import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MainArea from './components/MainArea';
import Gallery from './components/Gallery';
import SettingsSheet from './components/SettingsSheet';
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
        threadId: savedThreadId || `thread-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
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
        threadId: `thread-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
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
  // Default to gallery view if no active conversation or if specifically requested
  // Gallery-first: always land on the gallery.
  // We'll show a "Resume last session" card there if conversation exists.
  const [view, setView] = useState('gallery');
  const [isMobile, setIsMobile] = useState(() => window.matchMedia?.('(max-width: 768px)')?.matches ?? false);
  const [showSettings, setShowSettings] = useState(false);

  const MAX_GALLERY_ITEMS = 20;
  const AUTO_SNAPSHOT_DEBOUNCE_MS = 500; // Reduced from 1200ms for faster saves
  const [autoSnapshotEnabled] = useState(true);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [autoSaveError, setAutoSaveError] = useState(null);
  const [lastSnapshotSig, setLastSnapshotSig] = useState('');

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

  // Track mobile breakpoint for editor layout
  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 768px)');
    if (!mq) return;
    const handler = () => setIsMobile(!!mq.matches);
    handler();
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('details_matter_api_key', apiKey);
    } else {
      localStorage.removeItem('details_matter_api_key');
    }
  }, [apiKey]);

  // Removed accessToken persistence logic

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
    } else {
      localStorage.removeItem('details_matter_fork_info');
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

  const buildGalleryEntry = async ({ id, conversation: conv, style: s, model: m, forkInfo: f }) => {
    const compressedConv = await compressConversation(conv);
    const title = conv?.[0]?.text?.slice(0, 80) || 'Untitled Thread';
    return {
      id,
      title,
      conversation: compressedConv,
      style: s,
      model: m,
      timestamp: new Date().toISOString(),
      forkInfo: f || null,
      threadId: id,
      thumbnail: compressedConv.find(t => t.image)?.image || null
    };
  };

  const saveThreadToLocalGallery = async ({ id, conv, s, m, f, silent = false }) => {
    // Avoid saving empty
    if (!conv || conv.length === 0) return;
    try {
      const entry = await buildGalleryEntry({ id, conversation: conv, style: s, model: m, forkInfo: f });
      setGallery(prev => {
        const deduped = prev.filter(e => e.id !== id);
        return [entry, ...deduped].slice(0, MAX_GALLERY_ITEMS);
      });
      if (!silent) {
        setSuccess('Saved to Local Gallery (Compressed).');
        setTimeout(() => setSuccess(null), 2500);
      }
    } catch (err) {
      console.error('Gallery save failed:', err);
      if (!silent) setError('Failed to save to gallery.');
      throw err;
    }
  };

  // Manual action in settings
  const handleAddToGallery = async () => {
    setIsLoading(true);
    try {
      await saveThreadToLocalGallery({ id: threadId, conv: conversation, s: style, m: model, f: forkInfo, silent: false });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFromGallery = (id) => {
    if (!id) return;
    const ok = window.confirm('Delete this thread from local gallery? This cannot be undone.');
    if (!ok) return;
    setGallery(prev => prev.filter(e => e.id !== id));
    setSuccess('Deleted from local gallery.');
    setTimeout(() => setSuccess(null), 2000);
  };

  // Auto-snapshot current thread into local gallery (compressed)
  useEffect(() => {
    if (!autoSnapshotEnabled) return;
    if (!threadId || !conversation || conversation.length === 0) return;
    // Only snapshot after we have at least one AI image or some meaningful progress
    const sig = `${threadId}:${conversation.length}:${conversation[conversation.length - 1]?.id || ''}`;
    if (sig === lastSnapshotSig) return;

    const t = setTimeout(async () => {
      try {
        setIsAutoSaving(true);
        setAutoSaveError(null);
        console.log(`📸 Auto-saving thread to gallery: ${conversation.length} turns, thread=${threadId}`);
        await saveThreadToLocalGallery({ id: threadId, conv: conversation, s: style, m: model, f: forkInfo, silent: true });
        setLastSnapshotSig(sig);
        console.log(`✅ Auto-save complete for thread ${threadId}`);
      } catch (err) {
        console.error(`❌ Auto-save failed:`, err);
        setAutoSaveError(err?.message || String(err));
      } finally {
        setIsAutoSaving(false);
      }
    }, AUTO_SNAPSHOT_DEBOUNCE_MS);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSnapshotEnabled, threadId, conversation, style, model, forkInfo]);

  // --- Routing & Navigation Logic ---

  const loadThread = async (id, isCloud = false) => {
    try {
      let data;
      if (isCloud) {
        setIsLoading(true);
        data = await fetchThread(id);
        setIsLoading(false);
      } else {
        data = gallery.find(e => e.id === id);
      }

      if (data && data.conversation) {
        setConversation(data.conversation);
        setCurrentTurn(data.conversation.length);
        setStyle(data.style || style);
        setModel(data.model || model);
        setThreadId(data.threadId || data.id || `thread-${Date.now()}`);
        setForkInfo(data.forkInfo || null);

        setView('editor');
        // setSuccess('Thread loaded successfully.');
      } else if (!isCloud) {
        // If not found in gallery, check if it matches current threadId (already loaded)
        if (id === threadId) {
          if (view !== 'editor') setView('editor');
          return;
        }
        console.warn("Thread not found locally:", id);
      }
    } catch (err) {
      console.error('Load failed:', err);
      setError('Failed to load thread.');
      setIsLoading(false);
    }
  };

  const resetThread = () => {
    setConversation([]);
    setCurrentTurn(0);
    const newId = `thread-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    setThreadId(newId);
    setForkInfo(null);
    setInitialImage(null);

    // Clear persistence keys
    localStorage.removeItem('details_matter_conversation');
    localStorage.removeItem('details_matter_current_turn');
    localStorage.removeItem('details_matter_thread_id');
    localStorage.removeItem('details_matter_fork_info');

    setView('editor');
    return newId;
  };

  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash;

      if (!hash || hash === '#/' || hash === '#/gallery') {
        if (view !== 'gallery') setView('gallery');
        return;
      }

      if (hash === '#/new') {
        const newId = resetThread();
        window.location.replace(`#/thread/${newId}`);
        return;
      }

      const threadMatch = hash.match(/^#\/thread\/(.+)$/);
      if (threadMatch) {
        const id = threadMatch[1];
        if (id === threadId && conversation.length > 0) {
          if (view !== 'editor') setView('editor');
          return;
        }
        await loadThread(id, false);
        return;
      }

      const cloudMatch = hash.match(/^#\/cloud\/(.+)$/);
      if (cloudMatch) {
        const id = cloudMatch[1];
        if (id === threadId) {
          if (view !== 'editor') setView('editor');
          return;
        }
        await loadThread(id, true);
        return;
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Handle initial load
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gallery, threadId, view]);

  const handleOpenThread = (entry, isCloud = false) => {
    if (isCloud) {
      window.location.hash = `#/cloud/${entry.id}`;
    } else {
      window.location.hash = `#/thread/${entry.id}`;
    }
  };

  const handleForkThread = async (entry, isCloud = false) => {
    try {
      let data = entry;
      if (isCloud) {
        setIsLoading(true);
        data = await fetchThread(entry.id);
        setIsLoading(false);
      }

      if (data.conversation) {
        const parentId = data.threadId || data.id;
        const parentTurn = Math.max(0, data.conversation.length - 1);
        const parentImage = data.conversation[parentTurn]?.image || null;

        setConversation(data.conversation);
        setCurrentTurn(data.conversation.length);
        setStyle(data.style || style);
        setModel(data.model || model);
        const newThreadId = `thread-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        setThreadId(newThreadId);
        setForkInfo({ parentId, parentTurn, parentImage });

        setView('editor');
        setSuccess('Fork created. You can now continue from this thread.');
        setTimeout(() => setSuccess(null), 3000);

        window.location.hash = `#/thread/${newThreadId}`;
      }
    } catch (err) {
      console.error('Fork failed:', err);
      setError('Failed to fork thread.');
      setIsLoading(false);
    }
  };

  const handleForkFromTurn = (turnIndex) => {
    if (!conversation || conversation.length === 0) return;
    const parentId = threadId;
    const idx = Math.max(0, Math.min(turnIndex, conversation.length - 1));

    // Prefer image at chosen turn; fall back to nearest previous image
    let parentImage = conversation[idx]?.image || null;
    if (!parentImage) {
      for (let i = idx; i >= 0; i--) {
        if (conversation[i]?.image) {
          parentImage = conversation[i].image;
          break;
        }
      }
    }

    // Before mutating the current thread into a fork, snapshot the full parent into gallery
    // so users don't lose it if they never manually saved.
    saveThreadToLocalGallery({ id: threadId, conv: conversation, s: style, m: model, f: forkInfo, silent: true })
      .catch(() => { });

    const newConversation = conversation.slice(0, idx + 1);
    const newThreadId = `thread-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    setConversation(newConversation);
    setCurrentTurn(newConversation.length);
    setThreadId(newThreadId);
    setForkInfo({ parentId, parentTurn: idx, parentImage });
    setView('editor');

    setSuccess(`Fork created from turn ${idx}. You can now continue from this branch.`);
    setTimeout(() => setSuccess(null), 3000);

    window.location.hash = `#/thread/${newThreadId}`;
  };

  const handleNewThread = () => {
    // If we are already in editor with content, confirm
    if (conversation.length > 0) {
      if (!window.confirm('Start a new thread? Unsaved progress will be lost.')) return;
    }

    // Snapshot the current thread first, so we don't lose it
    if (conversation.length > 0) {
      saveThreadToLocalGallery({ id: threadId, conv: conversation, s: style, m: model, f: forkInfo, silent: true })
        .catch(() => { });
    }

    window.location.hash = '#/new';
  };

  // True full-bleed gallery: do NOT render under `.app` which is max-width constrained.
  if (view === 'gallery') {
    return (
      <Gallery
        localGallery={gallery}
        // "Resume" card comes from current in-memory (possibly persisted) session
        currentSession={{
          threadId,
          conversation,
          style,
          model,
          forkInfo,
          timestamp: new Date().toISOString(),
        }}
        isLoading={isLoading}
        onNewThread={handleNewThread}
        onOpenThread={(t, isCloud) => handleOpenThread(t, isCloud)}
        onForkThread={(t, isCloud) => handleForkThread(t, isCloud)}
        onDeleteThread={(id) => handleDeleteFromGallery(id)}
      />
    );
  }

  const handleDetachFork = () => {
    setForkInfo(null);
    setSuccess('Fork info removed. Please save to gallery to make it permanent.');
    setTimeout(() => setSuccess(null), 3000);
  };

  const sidebarProps = {
    apiKey,
    isApiKeySet,
    onApiKeySet: handleApiKeySet,
    onApiKeyOverride: handleApiKeyOverride,
    conversation,
    currentTurn,
    style,
    onStyleChange: handleStyleChange,
    model,
    onModelChange: handleModelChange,
    onContinue: null,
    isLoading,
    error,
    success,
    onClearMessages: clearMessages,
    onOpenGallery: () => window.location.hash = '#/gallery',
    onPublishCloud: handlePublishCloud,
    onAddToGallery: handleAddToGallery,
    onDetachFork: forkInfo ? handleDetachFork : null,
    gallery,
    onNewThread: handleNewThread,
  };

  return (
    <div className="app">
      <header className="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
        <div>
          <h1>🎨 Only Details Matter</h1>
          <p style={{ display: 'none' }}>
            Iteratively test how a generative model latches onto a single visual detail.
          </p>
        </div>
        <button
          className="secondary-button"
          onClick={() => window.location.hash = '#/gallery'}
          style={{ marginLeft: '20px' }}
        >
          🏠 Home / Gallery
        </button>

        {isMobile && (
          <button
            className="primary-button"
            onClick={() => setShowSettings(true)}
            style={{ marginLeft: '10px' }}
          >
            ⚙️ Settings
          </button>
        )}
      </header>

      <div className="main-content">
        {!isMobile && <Sidebar {...sidebarProps} />}

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
          onForkFromTurn={handleForkFromTurn}
        />
      </div>

      {isMobile && (
        <SettingsSheet open={showSettings} title="Settings" onClose={() => setShowSettings(false)}>
          <Sidebar
            {...sidebarProps}
            onOpenGallery={() => {
              setShowSettings(false);
              window.location.hash = '#/gallery';
            }}
          />
        </SettingsSheet>
      )}
    </div>
  );
}

export default App;
