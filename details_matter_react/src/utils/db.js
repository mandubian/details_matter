export const DB_NAME = 'details_matter_db';
export const DB_VERSION = 1;
export const STORE_GALLERY = 'gallery';
export const STORE_KEYVAL = 'keyval';

let dbInstance = null;

// Initialize the database
export const initDB = () => {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Store for threads (keypath: id)
            if (!db.objectStoreNames.contains(STORE_GALLERY)) {
                db.createObjectStore(STORE_GALLERY, { keyPath: 'id' });
            }

            // Store for key-value pairs (settings, etc.)
            if (!db.objectStoreNames.contains(STORE_KEYVAL)) {
                db.createObjectStore(STORE_KEYVAL);
            }
        };
    });
};

// Save the entire gallery (upsert + prune pattern for safety)
// This avoids the dangerous clear+rewrite that can lose data if React state is stale
export const saveGallery = async (threads = []) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_GALLERY], 'readwrite');
        const store = transaction.objectStore(STORE_GALLERY);

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);

        // Get current IDs we want to keep
        const newIds = new Set((threads || []).map(t => t.id).filter(Boolean));

        // First, get all existing IDs to find ones to delete
        const getAllReq = store.getAllKeys();
        getAllReq.onsuccess = () => {
            const existingIds = getAllReq.result || [];

            // Delete threads that are no longer in the list
            for (const existingId of existingIds) {
                if (!newIds.has(existingId)) {
                    store.delete(existingId);
                }
            }

            // Upsert all current threads
            (threads || []).forEach(thread => {
                if (!thread.id) return; // Skip threads without ID
                store.put({ ...thread });
            });
        };
    });
};

// Load all threads
export const loadGallery = async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_GALLERY], 'readonly');
        const store = transaction.objectStore(STORE_GALLERY);
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result || []);
        };
        request.onerror = (event) => reject(event.target.error);
    });
};

// Key-Value helpers (replacing localStorage for simple keys)
export const saveKey = async (key, value) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_KEYVAL], 'readwrite');
        const store = transaction.objectStore(STORE_KEYVAL);
        const request = store.put(value, key);

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
};

export const getKey = async (key) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_KEYVAL], 'readonly');
        const store = transaction.objectStore(STORE_KEYVAL);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
};

export const deleteKey = async (key) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_KEYVAL], 'readwrite');
        const store = transaction.objectStore(STORE_KEYVAL);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
};

// Delete a single thread from the gallery
export const deleteThread = async (id) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_GALLERY], 'readwrite');
        const store = transaction.objectStore(STORE_GALLERY);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
};

// Migration helper
export const migrateFromLocalStorage = async () => {
    const localGallery = localStorage.getItem('details_matter_gallery');
    if (localGallery) {
        try {
            const threads = JSON.parse(localGallery);
            if (Array.isArray(threads) && threads.length > 0) {
                console.log('📦 Migrating', threads.length, 'threads to IndexedDB...');
                await saveGallery(threads);
                console.log('✅ Migration complete. Clearing localStorage.');
                localStorage.removeItem('details_matter_gallery'); // Only remove if successful
            }
        } catch (e) {
            console.error('Migration failed:', e);
        }
    }

    // Migrate other keys if needed
    const forkInfo = localStorage.getItem('details_matter_fork_info');
    if (forkInfo) {
        await saveKey('fork_info', JSON.parse(forkInfo));
        // localStorage.removeItem('details_matter_fork_info'); // Optional: keep for safety for now
    }
};
