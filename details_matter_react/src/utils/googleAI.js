import { GoogleGenAI } from "@google/genai";

// NOTE: We keep SDK usage here for generation, but:
// - We accept a model id at call time
// - We return images as data URLs (not blob:) so they persist across reloads
// - We expose a dynamic model list helper for the UI

const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export const AVAILABLE_MODELS = [
  // Fallback list (API may return a different set per key/region).
  // Keep this small and conservative.
  { id: "gemini-2.5-flash-image-preview", name: "Gemini 2.5 Flash (Image Preview)" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
];

// Default to a model that (when available) supports image output.
export const DEFAULT_MODEL_ID = "gemini-2.5-flash-image-preview";

// Initialize the Google AI client
let genAI = null;
let currentApiKey = null;
let generationInProgress = false; // single-flight guard to prevent concurrent generations

// Utility: estimate decoded bytes of a base64 string
const base64DecodedBytes = (b64) => {
  if (!b64) return 0;
  const len = b64.length;
  const padding = (b64.endsWith('==') ? 2 : (b64.endsWith('=') ? 1 : 0));
  return Math.max(0, Math.floor((len * 3) / 4) - padding);
};

// Utility: get byte length of a string in UTF-8
const utf8ByteLength = (str) => {
  try {
    return new TextEncoder().encode(str).length;
  } catch {
    // Fallback for older environments
    return unescape(encodeURIComponent(str)).length;
  }
};

export const initializeGoogleAI = (apiKey) => {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  // Only reinitialize if the API key has changed
  if (currentApiKey !== apiKey) {
    console.log('🔄 Initializing Google AI with new API key (override detected)');
    genAI = new GoogleGenAI({
      apiKey: apiKey
    });
    currentApiKey = apiKey;
  } else {
    console.log('✅ Using existing Google AI client (same API key)');
  }

  return genAI;
};

export const fetchAvailableModels = async (apiKey) => {
  if (!apiKey) return AVAILABLE_MODELS;
  try {
    const url = `${API_BASE_URL}/models?key=${encodeURIComponent(apiKey)}&pageSize=100`;
    const res = await fetch(url);
    if (!res.ok) return AVAILABLE_MODELS;
    const data = await res.json();
    const models = (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => {
        const id = (m.name || '').replace('models/', '');
        return { id, name: m.displayName || id, description: m.description || '' };
      })
      // remove obvious non-image/TTS variants
      .filter(m => !m.id.toLowerCase().includes('tts'));

    // Keep only gemini-ish
    const filtered = models.filter(m => m.id.toLowerCase().includes('gemini'));

    const priority = [
      "gemini-2.5-flash-image-preview",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
    ];

    const score = (id) => {
      const idx = priority.indexOf(id);
      return idx === -1 ? 999 : idx;
    };

    const merged = [...filtered];
    for (const def of AVAILABLE_MODELS) {
      if (!merged.find(m => m.id === def.id)) merged.push(def);
    }

    return merged.sort((a, b) => {
      const sa = score(a.id);
      const sb = score(b.id);
      if (sa !== sb) return sa - sb;
      return a.id.localeCompare(b.id);
    });
  } catch (e) {
    console.error('Error fetching models:', e);
    return AVAILABLE_MODELS;
  }
};

export const generateContent = async (prompt, context = "", previousImage = null, style = "", model = DEFAULT_MODEL_ID) => {
  if (!genAI) {
    throw new Error('Google AI client not initialized. Please set your API key first.');
  }

  console.log('🚀 Starting content generation with API key:', currentApiKey ? currentApiKey.substring(0, 8) + '...' : 'NO KEY');

  // Prevent concurrent generateContent calls from this module
  if (generationInProgress) {
    throw new Error('A generation request is already in progress. Please wait for it to complete.');
  }

  try {
    generationInProgress = true;
    // Build the full prompt
    let fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
    if (style) {
      fullPrompt += `\nStyle: ${style}.`;
    }

    // Prepare contents for the API call.
    // @google/genai v0.3.x accepts either a string OR a list of {role, parts}.
    // We use role/parts so multimodal works consistently.
    let contents;

    if (previousImage) {
      try {
        // Convert blob URL or data URL to base64 for the API
        let imageData, mimeType;

        if (previousImage.startsWith('data:')) {
          // Handle data URL
          const [mime, data] = previousImage.split(',');
          mimeType = mime.split(':')[1].split(';')[0];
          imageData = data;
        } else if (previousImage.startsWith('blob:')) {
          // Handle blob URL - we need to fetch and convert
          const response = await fetch(previousImage);
          const blob = await response.blob();
          mimeType = blob.type;

          // Convert blob to base64
          const reader = new FileReader();
          imageData = await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
          });
        } else {
          throw new Error('Unsupported image format');
        }

        contents = [
          {
            role: 'user',
            parts: [
              { text: fullPrompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: imageData
                }
              }
            ]
          }
        ];
      } catch (error) {
        console.error('Error processing previous image:', error);
        // Fall back to text-only if image processing fails
        contents = [{ role: 'user', parts: [{ text: fullPrompt }] }];
      }
    } else {
      contents = [{ role: 'user', parts: [{ text: fullPrompt }] }];
    }

    console.log('Contents:', contents);

    // Compute request payload size (approximate over-the-wire JSON size)
    const requestPayload = { model, contents };
    const requestJson = JSON.stringify(requestPayload);
    const requestBytes = utf8ByteLength(requestJson);

    // Compute total decoded image bytes (if any inlineData present)
    let imageDecodedBytes = 0;
    if (Array.isArray(contents)) {
      for (const c of contents) {
        const parts = c?.parts || [];
        for (const p of parts) {
          if (p?.inlineData?.data) imageDecodedBytes += base64DecodedBytes(p.inlineData.data);
        }
      }
    }

    console.log(`📦 Outgoing request size ≈ ${(requestBytes/1024).toFixed(1)} KB` + (imageDecodedBytes > 0 ? ` | images (decoded) ≈ ${(imageDecodedBytes/1024).toFixed(1)} KB` : ''));

    // Generate content with image modality (matching documentation exactly)
    const response = await genAI.models.generateContent({
      model,
      contents: contents,
    });

    // Extract text and image from the response.
    // In @google/genai v0.3.x, response is a GenerateContentResponse with response.candidates.
    const candidates = response?.candidates || response?.response?.candidates || [];
    const parts = candidates?.[0]?.content?.parts || [];

    let text = response?.text || null;
    let image = null;

    for (const part of parts) {
      if (part?.text) {
        text = (text || '') + part.text;
      }
      if (part?.inlineData?.data && part?.inlineData?.mimeType) {
        const imageData = part.inlineData.data;
        const mimeType = part.inlineData.mimeType;
        image = `data:${mimeType};base64,${imageData}`;
      }
    }

    // If no image was found but we have text, try to generate image-only
    if (!image && text) {
      try {
        console.log('No image in initial response, attempting image-only generation...');

        const imageOnlyResponse = await genAI.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text }] }],
        });

        const imageCandidates = imageOnlyResponse?.candidates || imageOnlyResponse?.response?.candidates || [];
        const imageParts = imageCandidates?.[0]?.content?.parts || [];

        for (const part of imageParts) {
          if (part?.inlineData?.data && part?.inlineData?.mimeType) {
            image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            console.log('Fallback image generation succeeded');
            break;
          }
        }
      } catch (fallbackError) {
        console.error('Fallback image generation failed:', fallbackError);
      }
    }

  return { text, image, metrics: { requestBytes, imageDecodedBytes } };

  } catch (error) {
    console.error('Error generating content:', error);

    // Try to parse structured Google error info when available
    try {
      // Some SDKs stringify a JSON payload inside the error message
      const text = error.message || error.toString();
      const jsonStart = text.indexOf('{');
      if (jsonStart !== -1) {
        const maybeJson = text.slice(jsonStart);
        const parsed = JSON.parse(maybeJson);
        const status = parsed.error?.status || parsed.status || '';
        const msg = parsed.error?.message || parsed.message || '';

        // Look for RetryInfo in details
        let retrySeconds = null;
        if (Array.isArray(parsed.error?.details)) {
          for (const d of parsed.error.details) {
            if (d['@type'] && d['@type'].includes('RetryInfo') && d.retryDelay) {
              // retryDelay like "36s" or an object; attempt to parse seconds
              const rd = d.retryDelay;
              if (typeof rd === 'string') {
                const m = rd.match(/(\d+)(?:\.(\d+))?s/);
                if (m) retrySeconds = parseFloat(m[1] + (m[2] ? '.' + m[2] : ''));
              } else if (rd.seconds) {
                retrySeconds = Number(rd.seconds);
              }
            }
          }
        }

        if (status === 'RESOURCE_EXHAUSTED' || msg.toUpperCase().includes('QUOTA')) {
          const base = 'API quota exceeded. Please check your usage limits and billing settings.';
          if (retrySeconds) {
            throw new Error(`${base} Retry after ~${Math.ceil(retrySeconds)}s.`);
          }
          throw new Error(base);
        }
      }
    } catch (parseErr) {
      // fall through to generic handling
      console.debug('Could not parse detailed Google error info:', parseErr);
    }

    if (error.message && error.message.includes('API_KEY_INVALID')) {
      throw new Error('Invalid API key. Please check your Gemini API key.');
    } else if (error.message && error.message.includes('QUOTA_EXCEEDED')) {
      throw new Error('API quota exceeded. Please check your usage limits.');
    } else if (error.message && error.message.includes('PERMISSION_DENIED')) {
      throw new Error('Permission denied. Please check your API key permissions.');
    } else {
      throw new Error(`Generation failed: ${error.message || 'Unknown error'}`);
    }
  } finally {
    generationInProgress = false;
  }
};

export const isInitialized = () => {
  return genAI !== null;
};

export const getCurrentApiKey = () => {
  return currentApiKey;
};
