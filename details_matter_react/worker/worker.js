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
          thumbnail: data.conversation.find(t => t.image)?.image || null
        };

        // Store full thread in R2
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

