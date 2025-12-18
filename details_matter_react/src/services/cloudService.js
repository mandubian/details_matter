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

export const fetchCloudGallery = async () => {
  const url = getWorkerUrl();
  if (!url) return []; // Return empty if no backend configured

  try {
    const response = await fetch(`${url}/gallery`);
    if (!response.ok) throw new Error('Failed to fetch gallery');
    return await response.json();
  } catch (error) {
    console.error('Cloud gallery fetch error:', error);
    return [];
  }
};

export const fetchThread = async (threadId) => {
  const url = getWorkerUrl();
  if (!url) throw new Error('Cloudflare Worker URL not configured');

  const response = await fetch(`${url}/thread/${threadId}`);
  if (!response.ok) throw new Error('Failed to fetch thread');
  return await response.json();
};







