import { compressConversation } from '../utils/imageUtils';

// Configuration - Hardcoded Worker URL (Service provided by maintainer)
const DEFAULT_WORKER_URL = 'https://details-matter-gallery.pascal-voitot.workers.dev';
// Allow localStorage override for dev/testing, but default to the official one
const WORKER_URL = localStorage.getItem('details_matter_worker_url') || DEFAULT_WORKER_URL;

export const setWorkerUrl = (url) => {
  localStorage.setItem('details_matter_worker_url', url);
};

export const getWorkerUrl = () => {
  return WORKER_URL;
};

export const uploadThread = async (threadData) => {
  const url = getWorkerUrl();
  if (!url) throw new Error('Cloudflare Worker URL not configured');

  // Compress images before upload
  const compressedConversation = await compressConversation(threadData.conversation);

  const payload = {
    ...threadData,
    conversation: compressedConversation,
    timestamp: new Date().toISOString(),
  };

  const response = await fetch(`${url}/upload`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  return await response.json(); // Should return { id: "thread-id" }
};

/**
 * Fetch cloud gallery with offset-based pagination
 * @param {number} offset - Offset from start (default: 0)
 * @param {number} limit - Number of items per page (default: 20, max: 50)
 * @returns {{ threads: Array, offset: number, total: number, hasMore: boolean }}
 */
export const fetchCloudGalleryPage = async (offset = 0, limit = 20) => {
  const url = getWorkerUrl();
  if (!url) return { threads: [], offset: 0, total: 0, hasMore: false };

  try {
    const params = new URLSearchParams();
    params.set('offset', String(offset));
    params.set('limit', String(limit));

    const response = await fetch(`${url}/gallery?${params}`);
    if (!response.ok) throw new Error('Failed to fetch gallery');
    return await response.json();
  } catch (error) {
    console.error('Cloud gallery fetch error:', error);
    return { threads: [], offset: 0, total: 0, hasMore: false };
  }
};

/**
 * Search cloud gallery
 * @param {string} query - Search query
 * @param {string|null} style - Style filter (optional)
 * @param {number} limit - Max results (default: 20)
 * @returns {{ threads: Array, query: string, count: number }}
 */
export const searchCloudGallery = async (query, style = null, limit = 20) => {
  const url = getWorkerUrl();
  if (!url) return { threads: [], query, count: 0 };

  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (style) params.set('style', style);
    params.set('limit', String(limit));

    const response = await fetch(`${url}/gallery/search?${params}`);
    if (!response.ok) throw new Error('Failed to search gallery');
    return await response.json();
  } catch (error) {
    console.error('Cloud gallery search error:', error);
    return { threads: [], query, count: 0 };
  }
};

/**
 * Fetch cloud gallery (backward compatible - fetches first page)
 * @deprecated Use fetchCloudGalleryPage for pagination
 */
export const fetchCloudGallery = async () => {
  const result = await fetchCloudGalleryPage(null, 50);
  return result.threads || [];
};

export const fetchThread = async (threadId) => {
  const url = getWorkerUrl();
  if (!url) throw new Error('Cloudflare Worker URL not configured');

  const response = await fetch(`${url}/thread/${threadId}`);
  if (!response.ok) throw new Error('Failed to fetch thread');
  return await response.json();
};
