/**
 * Cloudflare Worker for Details Matter Gallery
 * 
 * Setup:
 * 1. Create a KV Namespace named "GALLERY_KV" and bind it to this worker. (For metadata index)
 * 2. Create an R2 Bucket named "GALLERY_BUCKET" and bind it to this worker. (For full thread data)
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // PUT /upload - Upload a thread
    if (method === 'PUT' && url.pathname === '/upload') {
      try {
        const data = await request.json();
        const threadId = data.threadId || crypto.randomUUID();

        // Process images: Extract, Hash, Store separately
        // We modify the 'data' object in-place to replace base64 with URLs
        if (data.conversation && Array.isArray(data.conversation)) {
          for (let turn of data.conversation) {
            if (turn.image && turn.image.startsWith('data:')) {
              try {
                // Parse base64
                const [meta, base64Data] = turn.image.split(',');
                if (base64Data) {
                  // Hash content for deduplication
                  const hash = await sha256(base64Data);
                  const mimeType = meta.split(':')[1].split(';')[0];
                  // Use hash as filename (e.g. img-a1b2c3d4.png)
                  // Extension is just for clarity, R2 relies on stored content-type
                  const ext = mimeType.split('/')[1] || 'bin';
                  const imageKey = `img-${hash}.${ext}`;

                  // Check if exists (optional optimization: skip checking if we trust hash collisions are rare and overwrites are cheap)
                  // For R2, blindly putting is often faster/cheaper than checking head first,
                  // but let's check to avoid bandwidth if possible? Actually, R2 Class A ops (put) cost money.
                  // Checking head (Class B) is cheaper.
                  const exists = await env.GALLERY_BUCKET.head(imageKey);

                  if (!exists) {
                    const binary = base64ToArrayBuffer(base64Data);
                    await env.GALLERY_BUCKET.put(imageKey, binary, {
                      httpMetadata: { contentType: mimeType }
                    });
                  }

                  // Replace in JSON with public URL (relative to worker domain)
                  // Format: /image/img-HASH.ext
                  turn.image = `${url.origin}/image/${imageKey}`;
                }
              } catch (e) {
                console.error("Failed to process image", e);
                // Keep original base64 if processing fails
              }
            }
          }
        }

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
          thumbnail: data.thumbnail || data.conversation.find(t => t.image)?.image || null
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

    // GET /gallery - List threads (from KV metadata index)
    if (method === 'GET' && url.pathname === '/gallery') {
      try {
        // List keys starting with 'meta:'
        const list = await env.GALLERY_KV.list({ prefix: 'meta:' });
        const threads = [];

        for (const key of list.keys) {
          const metaStr = await env.GALLERY_KV.get(key.name);
          if (metaStr) threads.push(JSON.parse(metaStr));
        }

        // Sort by timestamp desc
        threads.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return new Response(JSON.stringify(threads), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
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
        return new Response(data, {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};





