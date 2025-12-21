/**
 * Cloudflare Worker for Details Matter Gallery
 * 
 * Setup:
 * 1. Create a KV Namespace named "GALLERY_KV" and bind it to this worker. (For metadata index)
 * 2. Create an R2 Bucket named "GALLERY_BUCKET" and bind it to this worker. (For full thread data)
 * 3. Set ADMIN_SECRET via: wrangler secret put ADMIN_SECRET
 *
 * Example wrangler.toml:
 * [[kv_namespaces]]
 * binding = "GALLERY_KV"
 * id = "your-kv-id"
 * 
 * [[r2_buckets]]
 * binding = "GALLERY_BUCKET"
 * bucket_name = "your-bucket-name"
 */

// Helper to hash a string (for image deduplication)
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper to convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper to generate searchText from thread data
function generateSearchText(threadData) {
  let texts = [];

  // Add title from first turn
  if (threadData.conversation?.[0]?.text) {
    texts.push(threadData.conversation[0].text.slice(0, 200));
  }

  // Add all turn texts (truncated)
  if (threadData.conversation) {
    for (const turn of threadData.conversation) {
      if (turn.text) {
        texts.push(turn.text.slice(0, 100));
      }
    }
  }

  // Join and limit total length
  return texts.join(' ').slice(0, 1000).toLowerCase();
}

// Helper to extract all unique styles from a thread
function extractStyles(threadData) {
  const styles = new Set();
  if (threadData.style) styles.add(threadData.style);
  if (threadData.conversation) {
    for (const turn of threadData.conversation) {
      if (turn.style) styles.add(turn.style);
    }
  }
  return Array.from(styles);
}

// Helper to process a base64 image and return its cloud URL
async function processBase64Image(imageUrl, url, env) {
  if (imageUrl && imageUrl.startsWith('data:')) {
    try {
      const [meta, base64Data] = imageUrl.split(',');
      if (base64Data) {
        const hash = await sha256(base64Data);
        const mimeType = meta.split(':')[1].split(';')[0];
        const ext = mimeType.split('/')[1] || 'bin';
        const imageKey = `img-${hash}.${ext}`;

        const exists = await env.GALLERY_BUCKET.head(imageKey);
        if (!exists) {
          const binary = base64ToArrayBuffer(base64Data);
          await env.GALLERY_BUCKET.put(imageKey, binary, {
            httpMetadata: { contentType: mimeType }
          });
        }
        return `${url.origin}/image/${imageKey}`;
      }
    } catch (e) {
      console.error("Failed to process image", e);
    }
  }
  return imageUrl;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // POST /admin/migrate - One-time migration to enhance metadata with searchText
    if (method === 'POST' && url.pathname === '/admin/migrate') {
      // Check admin secret
      const adminToken = request.headers.get('X-Admin-Token');
      if (!env.ADMIN_SECRET || adminToken !== env.ADMIN_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check if already migrated
      const migrationKey = 'migration:v1:searchtext';
      const alreadyMigrated = await env.GALLERY_KV.get(migrationKey);
      if (alreadyMigrated) {
        return new Response(JSON.stringify({
          message: 'Migration already completed',
          migratedAt: alreadyMigrated
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      try {
        // List all metadata keys
        let cursor = null;
        let migratedCount = 0;
        let errorCount = 0;

        do {
          const listResult = await env.GALLERY_KV.list({
            prefix: 'meta:',
            cursor: cursor
          });

          for (const key of listResult.keys) {
            try {
              // Get current metadata
              const metaStr = await env.GALLERY_KV.get(key.name);
              if (!metaStr) continue;
              const metadata = JSON.parse(metaStr);

              // Skip if already has searchText
              if (metadata.searchText) {
                migratedCount++;
                continue;
              }

              // Fetch full thread from R2
              const threadObj = await env.GALLERY_BUCKET.get(`thread-${metadata.id}.json`);
              if (!threadObj) {
                errorCount++;
                continue;
              }

              const threadData = JSON.parse(await threadObj.text());

              // Generate searchText and styles
              const searchText = generateSearchText(threadData);
              const styles = extractStyles(threadData);

              // Update metadata
              const enhancedMetadata = {
                ...metadata,
                searchText,
                styles
              };

              // Save back to KV
              await env.GALLERY_KV.put(key.name, JSON.stringify(enhancedMetadata));
              migratedCount++;
            } catch (e) {
              console.error(`Failed to migrate ${key.name}:`, e);
              errorCount++;
            }
          }

          cursor = listResult.cursor;
        } while (cursor);

        // Mark migration as complete
        await env.GALLERY_KV.put(migrationKey, new Date().toISOString());

        return new Response(JSON.stringify({
          success: true,
          migratedCount,
          errorCount
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // PUT /upload - Upload a thread
    if (method === 'PUT' && url.pathname === '/upload') {
      try {
        const data = await request.json();
        const threadId = data.threadId || crypto.randomUUID();

        // Process images: Extract, Hash, Store separately
        if (data.conversation && Array.isArray(data.conversation)) {
          for (let turn of data.conversation) {
            turn.image = await processBase64Image(turn.image, url, env);
          }
        }

        // Process parentImage in forkInfo as well
        if (data.forkInfo && data.forkInfo.parentImage) {
          data.forkInfo.parentImage = await processBase64Image(data.forkInfo.parentImage, url, env);
        }

        // Generate searchText and styles for the new thread
        const searchText = generateSearchText(data);
        const styles = extractStyles(data);

        // Metadata for the gallery list (exclude heavy conversation data)
        const metadata = {
          id: threadId,
          title: data.conversation[0]?.text?.slice(0, 100) || 'Untitled Thread',
          timestamp: data.timestamp,
          turnCount: data.conversation.length,
          style: data.style,
          model: data.model,
          forkInfo: data.forkInfo,
          // Store first image thumbnail if available
          thumbnail: data.thumbnail || data.conversation.find(t => t.image)?.image || null,
          // New: searchable text and styles
          searchText,
          styles
        };

        // Store full thread in R2 (now lightweight)
        await env.GALLERY_BUCKET.put(`thread-${threadId}.json`, JSON.stringify(data), {
          httpMetadata: { contentType: 'application/json' },
        });

        // Store metadata in KV for fast listing
        await env.GALLERY_KV.put(`meta:${threadId}`, JSON.stringify(metadata));

        return new Response(JSON.stringify({ success: true, id: threadId }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // GET /image/:key - Serve raw image from R2
    if (method === 'GET' && url.pathname.startsWith('/image/')) {
      const key = url.pathname.split('/image/')[1];
      if (!key) return new Response('Bad Request', { status: 400, headers: corsHeaders });

      try {
        const object = await env.GALLERY_BUCKET.get(key);
        if (!object) {
          return new Response('Image not found', { status: 404, headers: corsHeaders });
        }

        const headers = new Headers(corsHeaders);
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        // Cache heavily - these are content-addressed (hashed) so they never change!
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');

        return new Response(object.body, { headers });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // GET /gallery - List threads with pagination
    // Params: offset (optional, default 0), limit (optional, default 20, max 50)
    // Note: We fetch ALL metadata from KV (lightweight), sort by timestamp, then paginate
    // This is necessary because KV list order is undefined and doesn't match timestamp order
    if (method === 'GET' && url.pathname === '/gallery') {
      try {
        const offsetParam = parseInt(url.searchParams.get('offset') || '0', 10);
        const limitParam = parseInt(url.searchParams.get('limit') || '20', 10);
        const offset = Math.max(offsetParam, 0);
        const limit = Math.min(Math.max(limitParam, 1), 50); // Clamp between 1-50

        // Fetch ALL metadata keys (metadata is small, this is efficient)
        let allThreads = [];
        let cursor = null;

        do {
          const listResult = await env.GALLERY_KV.list({
            prefix: 'meta:',
            cursor
          });

          for (const key of listResult.keys) {
            const metaStr = await env.GALLERY_KV.get(key.name);
            if (metaStr) allThreads.push(JSON.parse(metaStr));
          }

          cursor = listResult.cursor;
        } while (cursor);

        // Sort ALL threads by timestamp desc (newest first)
        allThreads.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Apply offset/limit pagination
        const paginatedThreads = allThreads.slice(offset, offset + limit);
        const hasMore = offset + limit < allThreads.length;

        const headers = new Headers(corsHeaders);
        headers.set('Content-Type', 'application/json');
        // Cache metadata for 60 seconds
        headers.set('Cache-Control', 'public, max-age=60');

        return new Response(JSON.stringify({
          threads: paginatedThreads,
          offset: offset,
          limit: limit,
          total: allThreads.length,
          hasMore
        }), {
          headers
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // GET /gallery/search - Search threads
    // Params: q (search query), style (filter), cursor, limit
    if (method === 'GET' && url.pathname === '/gallery/search') {
      try {
        const query = (url.searchParams.get('q') || '').toLowerCase().trim();
        const styleFilter = url.searchParams.get('style') || null;
        const limitParam = parseInt(url.searchParams.get('limit') || '20', 10);
        const limit = Math.min(Math.max(limitParam, 1), 50);

        // For search, we need to scan all metadata (KV doesn't support text search)
        // This is a limitation - for large datasets, we'd need a search index
        let cursor = null;
        const matchingThreads = [];

        do {
          const listResult = await env.GALLERY_KV.list({
            prefix: 'meta:',
            cursor
          });

          for (const key of listResult.keys) {
            const metaStr = await env.GALLERY_KV.get(key.name);
            if (!metaStr) continue;

            const metadata = JSON.parse(metaStr);

            // Check style filter
            if (styleFilter && !metadata.styles?.includes(styleFilter)) {
              continue;
            }

            // Check query match
            if (query) {
              const titleMatch = metadata.title?.toLowerCase().includes(query);
              const searchMatch = metadata.searchText?.includes(query);
              if (!titleMatch && !searchMatch) continue;
            }

            matchingThreads.push(metadata);

            // Stop early if we have enough results
            if (matchingThreads.length >= limit) break;
          }

          cursor = listResult.cursor;
        } while (cursor && matchingThreads.length < limit);

        // Sort by timestamp desc
        matchingThreads.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const headers = new Headers(corsHeaders);
        headers.set('Content-Type', 'application/json');
        // Cache search results for 60 seconds
        headers.set('Cache-Control', 'public, max-age=60');

        return new Response(JSON.stringify({
          threads: matchingThreads.slice(0, limit),
          query,
          styleFilter,
          count: matchingThreads.length
        }), {
          headers
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // GET /thread/:id - Fetch full thread from R2
    if (method === 'GET' && url.pathname.startsWith('/thread/')) {
      const id = url.pathname.split('/')[2];

      try {
        const object = await env.GALLERY_BUCKET.get(`thread-${id}.json`);

        if (!object) {
          return new Response('Thread not found', { status: 404, headers: corsHeaders });
        }

        const data = await object.text();
        const headers = new Headers(corsHeaders);
        headers.set('Content-Type', 'application/json');
        // Use no-cache so browsers always revalidate - threads are mutable (can be re-published)
        headers.set('Cache-Control', 'no-cache');

        return new Response(data, {
          headers
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};
