# Data Flow & Storage Architecture

This document describes the data structures, storage mechanisms, and logic flows for thread creation, updates, forking, and persistence.

---

## Data Structures

### Turn (Conversation Entry)
Each turn in a conversation contains:
```javascript
{
  id: string,              // Unique turn ID (e.g., "turn-<timestamp>-<random>")
  text: string,            // Generated text description
  image: string,           // Base64 data URL of the generated image (e.g., "data:image/png;base64,...")
  image_description: string, // Alt text for the image
  style: string,           // Art style used for generation
  model_name: string,      // Model that generated this turn (or "Human Input" for initial)
  error: string | null     // Error message if generation failed
}
```

### Thread (Gallery Entry)
Stored in IndexedDB `gallery` store:
```javascript
{
  id: string,              // Unique thread ID (e.g., "thread-<base36-timestamp>-<random>")
  threadId: string,        // Same as id (legacy compatibility)
  title: string,           // First 80 chars of first turn's text
  conversation: Turn[],    // Array of turns (with compressed images)
  style: string,           // Current art style
  model: string,           // Current model ID
  timestamp: string,       // ISO timestamp of last update
  forkInfo: ForkInfo | null, // Fork metadata (see below)
  thumbnail: string | null // Cached first image (for quick loading)
}
```

### ForkInfo (Fork Metadata)
When a thread is forked from another:
```javascript
{
  parentId: string,        // ID of the parent thread forked from
  parentTurn: number,      // Turn index where fork occurred
  parentImage: string,     // Image at the fork point (for vignette display)
  parentTitle: string,     // Title of parent thread
  isParentCloud: boolean,  // Whether parent was a cloud thread
  originThreadId: string,  // For lineage tracing - true origin thread
  originTurnIndex: number  // Turn index in the origin thread
}
```

---

## Storage Mechanisms

### IndexedDB (`details_matter_db`)

| Store      | Key      | Data                                  |
|------------|----------|---------------------------------------|
| `gallery`  | `id`     | Thread objects (all threads)          |
| `keyval`   | string   | Key-value pairs for settings          |

**KeyVal entries:**
- `fork_info`: Current active thread's forkInfo
- `active_conversation`: Current active conversation (Turn[])

### localStorage (Legacy/Minimal)

| Key                          | Data                          |
|------------------------------|-------------------------------|
| `details_matter_api_key`     | Gemini API key                |
| `details_matter_style`       | Current style selection       |
| `details_matter_model`       | Current model selection       |
| `details_matter_thread_id`   | Current active thread ID      |
| `details_matter_current_turn`| Current turn count            |

> **Note:** Conversation and gallery are stored in IndexedDB (no 5MB limit).
> Images are stored as base64 data URLs within the conversation array.

---

## Thread Lifecycle

### 1. New Thread Creation

**Trigger:** User clicks "New Thread" button

**Flow:**
```
handleNewThread()
├── Save current thread to gallery (if exists)
│   └── saveThreadToLocalGallery({ id, conv, style, model, forkInfo })
├── Navigate to #/new
│
resetThread() [triggered by hash change]
├── setConversation([])
├── setCurrentTurn(0)
├── setThreadId(new unique ID)
├── setForkInfo(null)
├── setInitialImage(null)
├── Clear persistence keys:
│   ├── deleteKey('active_conversation')
│   ├── deleteKey('fork_info')
│   └── localStorage.removeItem(...)
└── setView('editor')
```

### 2. Generating a Turn

**Trigger:** User clicks "Next" or provides guidance

**Flow:**
```
handleContinue(guidance)
├── Build prompt from:
│   ├── Previous turn's text (if any)
│   ├── User guidance (optional)
│   ├── Style suffix
│   └── Previous image (for context)
├── Call generateContent(prompt, context, previousImage, style, model)
│   └── API returns { text, image }
├── Create new turn:
│   {
│     id: unique,
│     text: result.text,
│     image: result.image (data URL),
│     style: currentStyle,
│     model_name: currentModel
│   }
├── setConversation([...prev, newTurn])
├── setCurrentTurn(prev + 1)
└── Triggers auto-save effect (after debounce)
```

### 3. Auto-Save to Gallery

**Trigger:** `conversation` state changes (debounced 500ms)

**Flow:**
```
Auto-snapshot effect
├── Guard: Skip if autoSnapshotEnabled=false or isRemote=true
├── Guard: Skip if conversation is empty
├── Guard: Skip if signature unchanged (no new content)
├── saveThreadToLocalGallery({ id, conv, style, model, forkInfo, silent: true })
│   ├── Guard: Skip if content unchanged (same conversation length)
│   ├── compressConversation(conv) - downscale images
│   ├── Build gallery entry
│   └── Update gallery state
└── Update lastSnapshotSig
```

### 4. Gallery Persistence Effect

**Trigger:** `gallery` state changes

**Flow:**
```
Gallery persistence effect
├── Guard: Skip if gallery === null (initial state)
├── Guard: Skip if dataLoadedRef.current === false (load not complete)
├── Deduplicate threads by ID
├── saveGallery(threads)
│   ├── Clear IndexedDB gallery store
│   └── Put all threads
└── Handle QuotaExceededError
```

---

## Fork Logic

### Creating a Fork from Gallery

**Trigger:** User clicks "Fork" on a gallery card

**Flow:**
```
handleForkThread(entry, isCloud)
├── Load thread data (fetch if cloud)
├── Create new threadId
├── Copy conversation to new thread
├── Build forkInfo:
│   {
│     parentId: source thread ID,
│     parentTurn: last turn index,
│     parentImage: last image,
│     parentTitle: source title,
│     isParentCloud: true/false,
│     originThreadId: trace to root,
│     originTurnIndex: trace to root
│   }
├── setConversation(data.conversation)
├── setThreadId(newThreadId)
├── setForkInfo(forkInfo)
└── Navigate to #/thread/{newThreadId}
```

### Creating a Fork from a Turn (Mid-Thread)

**Trigger:** User clicks "Fork" on a specific turn in conversation

**Flow:**
```
handleForkFromTurn(turnIndex)
├── Snapshot current thread to gallery (preserve parent)
├── Slice conversation up to turnIndex + 1
├── Create new threadId
├── Build forkInfo (pointing to current thread as parent)
├── setConversation(sliced conversation)
├── setThreadId(newThreadId)
├── setForkInfo(forkInfo)
└── Navigate to #/thread/{newThreadId}
```

### Detaching Fork Info

**Trigger:** User clicks "Unfork" in settings

**Flow:**
```
handleDetachFork()
├── setForkInfo(null)
├── Auto-save to gallery with forkInfo: null
│   └── saveThreadToLocalGallery({ ..., f: null })
└── Show success message
```

---

## ForkInfo Persistence

**Trigger:** `forkInfo` state changes

**Flow:**
```
ForkInfo persistence effect
├── Guard: Skip if dataLoadedRef.current === false
├── If forkInfo !== null:
│   └── saveKey('fork_info', forkInfo)
├── If forkInfo === null:
│   └── deleteKey('fork_info')
```

---

## Image Display Logic in Gallery

### Wall Card Preview Image (`getPreviewImages`)

```
getPreviewImages(thread)
├── Extract all images from conversation with indices
├── Check if thread has valid forkInfo (parentId + parentTurn)
├── If FORK:
│   ├── Filter images where idx > parentTurn (post-fork only)
│   ├── If post-fork images exist: return first 4
│   └── Else: return parentImage as fallback
├── If NOT FORK:
│   └── Return first 4 images from beginning
```

### Fork Vignette (Origin Indicator)

```
originImage (in RPGThreadCard)
├── Find first image in conversation (idx 0)
├── If no images: fallback to forkInfo.parentImage
└── Display in corner vignette (only if forkInfo.parentId exists)
```

---

## Race Condition Guards

To prevent data loss during hot reload or initial mount:

1. **`dataLoadedRef`**: Tracks if initial IDB load is complete
2. **Gallery effect**: Skips save until `dataLoadedRef.current === true`
3. **ForkInfo effect**: Skips save/delete until `dataLoadedRef.current === true`
4. **Conversation effect**: Skips save until `dataLoadedRef.current === true`
5. **ThreadId effect**: Skips save until `dataLoadedRef.current === true`
6. **Null guard**: Gallery effect also skips if `gallery === null`

---

## Debugging Tips

### View IndexedDB Data
```javascript
// In browser console:
const request = indexedDB.open('details_matter_db');
request.onsuccess = () => {
  const db = request.result;
  const tx = db.transaction('gallery', 'readonly');
  tx.objectStore('gallery').getAll().onsuccess = (e) => {
    console.log('All threads:', e.target.result);
  };
};
```

### Check Persistence State
Look for console logs:
- `⏳ Skipping gallery save - initial load not complete`
- `✅ Initial data load complete, persistence enabled`
- `📸 Auto-saving thread to gallery: X turns`

### Common Issues

| Symptom | Likely Cause |
|---------|--------------|
| Thread disappears after reload | Race condition - persistence ran before load |
| Wrong preview image | forkInfo incorrectly set, or corrupted parentTurn |
| Fork vignette on non-fork | Thread has stale forkInfo |
| "No image generated" | API response missing image, check responseModalities |
