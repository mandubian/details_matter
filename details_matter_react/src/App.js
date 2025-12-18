import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MainArea from './components/MainArea';
import Gallery from './components/Gallery';
import SettingsSheet from './components/SettingsSheet';
import { initializeGoogleAI } from './utils/googleAI';
import { uploadThread, fetchThread } from './services/cloudService';
import { compressConversation } from './utils/imageUtils';

import {
  saveGallery,
  loadGallery,
  migrateFromLocalStorage,
  saveKey,
  getKey,
  deleteKey,
  deleteThread
} from './utils/db'; // Import DB utils

function App() {
  // Initialize state from localStorage immediately to prevent overwriting on first render
  // Note: Gallery, ForkInfo, and Conversation are now loaded asynchronously from IndexedDB
  const getInitialState = () => {
    try {
      // We no longer load conversation from localStorage to avoid quota limits
      const savedConversation = [];
      const savedCurrentTurn = localStorage.getItem('details_matter_current_turn');
      const savedStyle = localStorage.getItem('details_matter_style');
      const savedModel = localStorage.getItem('details_matter_model');
      const savedApiKey = localStorage.getItem('details_matter_api_key');
      const savedThreadId = localStorage.getItem('details_matter_thread_id');

      const computedTurn = savedCurrentTurn
        ? parseInt(savedCurrentTurn, 10)
        : 0;

      return {
        conversation: savedConversation,
        currentTurn: Number.isFinite(computedTurn) ? computedTurn : 0,
        style: savedStyle || 'Photorealistic',
        model: savedModel || 'gemini-2.5-flash',
        apiKey: savedApiKey || '',
        isApiKeySet: !!savedApiKey,
        threadId: savedThreadId || `thread-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        gallery: null, // Init as null to prevent overwriting DB with empty array before load
        forkInfo: null, // Loaded async
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
        gallery: null, // Init as null
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
  const [isRemote, setIsRemote] = useState(false); // Track if current thread is cloud/read-only
  const [isMobile, setIsMobile] = useState(() => window.matchMedia?.('(max-width: 768px)')?.matches ?? false);
  const [showSettings, setShowSettings] = useState(false);
  // Collapsed sidebar state lifted from Sidebar component
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);

  const MAX_GALLERY_ITEMS = 50; // Increased limit thanks to IndexedDB
  const AUTO_SNAPSHOT_DEBOUNCE_MS = 500; // Reduced from 1200ms for faster saves
  const [autoSnapshotEnabled] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [autoSaveError, setAutoSaveError] = useState(null);
  const [lastSnapshotSig, setLastSnapshotSig] = useState('');

  // Track if initial data has been loaded from IndexedDB to prevent race conditions
  const dataLoadedRef = React.useRef(false);

  // Async load gallery and forkInfo from IndexedDB
  useEffect(() => {
    const loadAsyncData = async () => {
      try {
        await migrateFromLocalStorage(); // One-time migration
        const storedGallery = await loadGallery();

        // Deduplicate by id (keep first occurrence)
        const seen = new Set();
        const deduped = (storedGallery || []).filter(t => {
          if (!t.id || seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });

        // Clean up any self-referential forks (corruption from past bugs)
        const cleaned = deduped.map(t => {
          if (t.forkInfo && t.forkInfo.parentId === t.id) {
            console.warn(`🔧 Cleaning self-referential fork: ${t.id}`);
            return { ...t, forkInfo: null };
          }
          return t;
        });

        setGallery(cleaned);

        // Also load forkInfo from IDB keyval store
        // We used to store it in LS 'details_matter_fork_info'
        // Migration might have moved it to 'fork_info'
        const storedForkInfo = await getKey('fork_info');
        if (storedForkInfo) setForkInfo(storedForkInfo);

        // Load active conversation from IDB (overrides localStorage if present)
        try {
          const storedConversation = await getKey('active_conversation');
          if (storedConversation && Array.isArray(storedConversation) && storedConversation.length > 0) {
            console.log('📂 Loaded active conversation from IndexedDB:', storedConversation.length, 'turns');
            setConversation(storedConversation);
            // Sync currentTurn to conversation length to ensure consistency
            setCurrentTurn(storedConversation.length);
          }
        } catch (err) {
          console.error('Failed to load active conversation from IDB:', err);
        }
      } catch (err) {
        console.error('Failed to load data from DB:', err);
      } finally {
        // Mark data as loaded to enable persistence effects
        dataLoadedRef.current = true;
        console.log('✅ Initial data load complete, persistence enabled');
      }
    };
    loadAsyncData();
  }, []);

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
  }, [initialState.apiKey, initialState.conversation]);

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
    // Only save non-empty conversations AND after initial load is complete
    if (conversation.length > 0 && dataLoadedRef.current) {
      // Save to IndexedDB (unlimited storage)
      saveKey('active_conversation', conversation)
        .then(() => console.log('💾 Saved conversation to IndexedDB:', conversation.length, 'turns'))
        .catch(err => console.error('❌ Failed to store conversation in IDB:', err));

      // Clear legacy localStorage key to avoid confusion/stale data
      localStorage.removeItem('details_matter_conversation');
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
    // Only persist threadId after initial load to prevent overwriting restored ID
    if (dataLoadedRef.current) {
      localStorage.setItem('details_matter_thread_id', threadId);
    }
  }, [threadId]);

  // Persist Gallery to IndexedDB (replacing localStorage)
  useEffect(() => {
    // Only save if gallery has been loaded (not null) AND initial load is complete
    if (gallery === null) return;
    if (!dataLoadedRef.current) {
      console.log('⏳ Skipping gallery save - initial load not complete');
      return;
    }

    // Defensive deduplication before saving to IDB
    const seen = new Set();
    const deduped = gallery.filter(t => {
      if (!t.id || seen.has(t.id)) {
        if (t.id) console.warn(`⚠️ Duplicate thread detected in gallery: ${t.id}`);
        return false;
      }
      seen.add(t.id);
      return true;
    });

    // Log if we found duplicates
    if (deduped.length !== gallery.length) {
      console.warn(`🔧 Removed ${gallery.length - deduped.length} duplicate(s) from gallery before saving`);
    }

    saveGallery(deduped).catch(err => {
      console.error('❌ Failed to store gallery in DB:', err);
      if (err.name === 'QuotaExceededError') {
        setError("⚠️ Storage limit reached! Please delete some old threads to free up space.");
        // NO AUTO-DELETION HERE!
      }
    });
  }, [gallery]);

  // Persist ForkInfo to IndexedDB (save when set, delete when cleared)
  useEffect(() => {
    // Skip until initial load is complete to prevent deleting data before it's loaded
    if (!dataLoadedRef.current) {
      console.log('⏳ Skipping forkInfo persistence - initial load not complete');
      return;
    }

    if (forkInfo) {
      saveKey('fork_info', forkInfo);
    } else {
      deleteKey('fork_info').catch(console.error);
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

  // Clear messages
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Handle Cloud Publishing (current active thread)
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

  // Handle uploading a specific gallery thread to cloud
  const handleUploadGalleryThreadToCloud = async (thread) => {
    setIsLoading(true);
    try {
      // Calculate the best thumbnail for this thread
      // For forks: use the NEWEST image (what makes this fork unique)
      // For non-forks: use the first image
      let thumbnail = null;
      if (thread.conversation && Array.isArray(thread.conversation)) {
        const images = thread.conversation
          .map((t, idx) => ({ idx, img: t?.image }))
          .filter(x => !!x.img);

        const hasForkInfo = thread?.forkInfo?.parentId && Number.isFinite(thread?.forkInfo?.parentTurn);

        if (hasForkInfo) {
          const forkTurn = thread.forkInfo.parentTurn;
          // Prioritize images after the fork point (newest unique content)
          const postFork = images.filter(x => x.idx > forkTurn);
          if (postFork.length > 0) {
            // Use the latest post-fork image
            thumbnail = postFork[postFork.length - 1].img;
          } else if (images.length > 0) {
            // Fallback to last image in thread
            thumbnail = images[images.length - 1].img;
          }
        } else if (images.length > 0) {
          // Non-fork: use first image
          thumbnail = images[0].img;
        }
      }

      const threadData = {
        threadId: thread.id || thread.threadId,
        conversation: thread.conversation,
        style: thread.style,
        model: thread.model,
        forkInfo: thread.forkInfo,
        timestamp: thread.timestamp || new Date().toISOString(),
        thumbnail, // Explicit thumbnail for gallery display
        title: thread.title || thread.conversation?.[0]?.text?.slice(0, 80) || 'Untitled Thread'
      };

      await uploadThread(threadData);

      // Update local gallery entry with publication tracking
      const threadId = thread.id || thread.threadId;
      const turnCount = thread.conversation?.length || 0;

      setGallery(prev => {
        if (!prev) return prev;
        const updated = prev.map(entry => {
          if (entry.id === threadId) {
            return {
              ...entry,
              publishedAt: new Date().toISOString(),
              publishedTurnCount: turnCount
            };
          }
          return entry;
        });
        // Persist the updated gallery
        saveGallery(updated).catch(console.error);
        return updated;
      });

      setSuccess(`Published "${thread.title || 'Thread'}" to the Exhibition!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Upload to cloud failed:', err);
      setError('Failed to publish: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const buildGalleryEntry = async ({ id, conversation: conv, style: s, model: m, forkInfo: f, existingEntry = null }) => {
    const compressedConv = await compressConversation(conv);
    const title = conv?.[0]?.text?.slice(0, 80) || 'Untitled Thread';

    // Only update timestamp if content actually changed (new turns added)
    const existingConvLength = existingEntry?.conversation?.length || 0;
    const contentChanged = compressedConv.length !== existingConvLength;
    const timestamp = contentChanged
      ? new Date().toISOString()
      : (existingEntry?.timestamp || new Date().toISOString());

    return {
      id,
      title,
      conversation: compressedConv,
      style: s,
      model: m,
      timestamp,
      forkInfo: f || null,
      threadId: id,
      thumbnail: compressedConv.find(t => t.image)?.image || null,
      // Preserve publication tracking from existing entry
      publishedAt: existingEntry?.publishedAt || null,
      publishedTurnCount: existingEntry?.publishedTurnCount || null
    };
  };

  const saveThreadToLocalGallery = async ({ id, conv, s, m, f, silent = false }) => {
    // Avoid saving empty
    if (!conv || conv.length === 0) return;

    // Guard: prevent self-referential forks (where forkInfo.parentId === thread id)
    // This indicates data corruption - clean it up
    let cleanedForkInfo = f;
    if (f && f.parentId === id) {
      console.warn(`⚠️ Detected self-referential fork (id=${id}). Removing corrupt forkInfo.`);
      cleanedForkInfo = null;
    }

    try {
      // Find existing entry to preserve timestamp if content unchanged
      const existingEntry = (gallery || []).find(e => e.id === id);

      // Skip save if content hasn't changed (same conversation length)
      if (silent && existingEntry && existingEntry.conversation?.length === conv.length) {
        console.log(`⏭️ Skipping auto-save for ${id} - no content change`);
        return;
      }

      const entry = await buildGalleryEntry({ id, conversation: conv, style: s, model: m, forkInfo: cleanedForkInfo, existingEntry });
      setGallery(prev => {
        const current = prev || [];
        const deduped = current.filter(e => e.id !== id);
        // Keep entries in place if just updating, only move to front if new
        if (existingEntry) {
          // Find original position and insert there
          const originalIndex = current.findIndex(e => e.id === id);
          const result = [...deduped];
          result.splice(originalIndex >= 0 ? originalIndex : 0, 0, entry);
          return result.slice(0, MAX_GALLERY_ITEMS);
        }
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

    // Note: window.confirm is auto-dismissed in embedded browsers
    // Consider adding a custom confirmation modal in the future
    deleteThread(id)
      .then(() => {
        setGallery(prev => prev.filter(e => e.id !== id));
        setSuccess('Deleted from local gallery.');
        setTimeout(() => setSuccess(null), 2000);
      })
      .catch((err) => {
        console.error('Failed to delete thread:', err);
        setError('Failed to delete thread from database.');
      });
  };

  // Auto-snapshot current thread into local gallery (compressed)
  useEffect(() => {
    if (!autoSnapshotEnabled || isRemote) return;
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
        setIsRemote(isCloud);
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

    // Clear persistence keys
    localStorage.removeItem('details_matter_conversation');
    deleteKey('active_conversation').catch(console.error);
    deleteKey('fork_info').catch(console.error); // Also clear forkInfo from IndexedDB
    localStorage.removeItem('details_matter_current_turn');
    localStorage.removeItem('details_matter_thread_id');
    localStorage.removeItem('details_matter_fork_info');

    setView('editor');
    setIsRemote(false);
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
        const parentTitle = data.title || (data.conversation?.[0]?.text?.slice(0, 80)) || 'Untitled Thread';
        const parentTurn = Math.max(0, data.conversation.length - 1);
        const parentImage = data.conversation[parentTurn]?.image || null;

        // Content-based lineage: trace back to the true origin of this content
        // If the parent thread is itself a fork, and the fork point is before the parent's own fork point,
        // the content actually originated from the parent's origin thread.
        let originThreadId = parentId;
        let originTurnIndex = parentTurn;

        if (data.forkInfo) {
          const parentForkTurn = data.forkInfo.parentTurn || 0;
          if (parentTurn <= parentForkTurn) {
            // This turn existed before the parent forked - trace to grandparent
            originThreadId = data.forkInfo.originThreadId || data.forkInfo.parentId;
            originTurnIndex = parentTurn; // Same turn index in the origin
          }
        }

        setConversation(data.conversation);
        setCurrentTurn(data.conversation.length);
        setStyle(data.style || style);
        setModel(data.model || model);
        const newThreadId = `thread-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        setThreadId(newThreadId);
        setForkInfo({
          parentId,
          parentTurn,
          parentImage,
          parentTitle,
          isParentCloud: isCloud,
          // Content lineage tracking
          originThreadId,
          originTurnIndex
        });

        setView('editor');
        setIsRemote(false);
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
    const parentTitle = conversation?.[0]?.text?.slice(0, 80) || 'Untitled Thread';
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

    // Content-based lineage: trace back to the true origin of this content
    let originThreadId = parentId;
    let originTurnIndex = idx;

    if (forkInfo) {
      const myForkTurn = forkInfo.parentTurn || 0;
      if (idx <= myForkTurn) {
        // This turn existed before I forked - trace to my origin
        originThreadId = forkInfo.originThreadId || forkInfo.parentId;
        originTurnIndex = idx;
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
    setForkInfo({
      parentId,
      parentTurn: idx,
      parentImage,
      parentTitle,
      isParentCloud: isRemote,
      originThreadId,
      originTurnIndex
    });
    setView('editor');
    setIsRemote(false);

    setSuccess(`Fork created from turn ${idx}. You can now continue from this branch.`);
    setTimeout(() => setSuccess(null), 3000);

    window.location.hash = `#/thread/${newThreadId}`;
  };

  const handleNewThread = () => {
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
        onUploadToCloud={handleUploadGalleryThreadToCloud}
        isRemote={isRemote}
      />
    );
  }

  const handleDetachFork = async () => {
    setForkInfo(null);

    // Auto-save to gallery immediately with cleared forkInfo
    // IMPORTANT: Use silent: false to force save even if conversation length unchanged
    // This ensures forkInfo changes are persisted to gallery
    if (conversation.length > 0) {
      try {
        await saveThreadToLocalGallery({
          id: threadId,
          conv: conversation,
          s: style,
          m: model,
          f: null, // Explicitly pass null forkInfo
          silent: false // Force save, don't skip based on length check
        });
        // Success message set by saveThreadToLocalGallery
      } catch (err) {
        console.error('Failed to save after detach:', err);
        setError('Fork removed but failed to save. Please save manually.');
        setTimeout(() => setError(null), 3000);
      }
    } else {
      setSuccess('Fork info cleared.');
      setTimeout(() => setSuccess(null), 3000);
    }
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
    isCollapsed: isSidebarCollapsed,
    onToggle: toggleSidebar,
    isRemote: isRemote,
    onForkCloud: () => handleForkThread({ id: threadId, conversation, style, model, forkInfo }, isRemote)
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

      <div className={`main-content ${isSidebarCollapsed && !isMobile ? 'sidebar-collapsed' : ''}`}>
        {!isMobile && <Sidebar {...sidebarProps} />}

        <MainArea
          conversation={conversation}
          setConversation={setConversation}
          currentTurn={currentTurn}
          setCurrentTurn={setCurrentTurn}
          style={style}
          onStyleChange={handleStyleChange}
          model={model}
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
          isRemote={isRemote}
          onForkThread={() => handleForkThread({ id: threadId, conversation, style, model, forkInfo }, isRemote)}
          onUploadThread={() => handleUploadGalleryThreadToCloud({ id: threadId, conversation, style, model, forkInfo })}
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

