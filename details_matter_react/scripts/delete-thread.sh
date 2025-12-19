#!/bin/bash
# Admin script to delete a thread from Cloudflare R2 + KV
#
# Usage: ./delete-thread.sh <thread-id>
#
# Prerequisites:
# - Node.js installed
# - Logged in to Cloudflare: npx wrangler login
# - Environment variables set (or edit below):
#   GALLERY_KV_ID - Your KV namespace ID
#   GALLERY_BUCKET - Your R2 bucket name

set -e

if [ -z "$1" ]; then
  echo "Usage: ./delete-thread.sh <thread-id>"
  echo "Example: ./delete-thread.sh thread-m4k2x7a-abc12"
  exit 1
fi

THREAD_ID="$1"

# === CONFIG: Edit these if not using environment variables ===
KV_NAMESPACE_ID="${GALLERY_KV_ID:-YOUR_KV_NAMESPACE_ID}"
R2_BUCKET="${GALLERY_BUCKET:-details-matter-gallery}"
# =============================================================

echo "🗑️ Deleting thread: $THREAD_ID"

# 1. Delete metadata from KV
echo "  → Removing KV metadata: meta:$THREAD_ID"
echo "y" | npx wrangler kv key delete "meta:$THREAD_ID" --namespace-id="$KV_NAMESPACE_ID" --remote 2>/dev/null || echo "    (KV key not found or already deleted)"

# 2. Delete thread JSON from R2
# Worker stores as: thread-${threadId}.json where threadId = "thread-xxx"
# So R2 key is: thread-thread-xxx.json
echo "  → Removing R2 thread file: thread-$THREAD_ID.json"
npx wrangler r2 object delete "$R2_BUCKET/thread-$THREAD_ID.json" --remote 2>/dev/null || echo "    (R2 object not found or already deleted)"

echo ""
echo "✅ Thread deleted: $THREAD_ID"
echo ""
echo "Note: Orphaned images (used only by this thread) are NOT automatically deleted."
echo "To clean up orphaned images, you'd need to scan all remaining threads and compare."
