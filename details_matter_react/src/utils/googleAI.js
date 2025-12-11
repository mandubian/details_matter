// import { GoogleGenAI } from "@google/genai";

export const AVAILABLE_MODELS = [
  // Fallback list; Banana models will be injected if found via ListModels
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "gemini-3.0-pro-preview", name: "Gemini 3.0 Pro Preview" }
];

// Default: prefer 2.5-flash if no Banana is found via ListModels
let DEFAULT_MODEL_ID = "gemini-2.5-flash";
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Initialize the Google AI client
// let genAI = null; // Removing SDK client
let currentApiKey = null;
let generationInProgress = false; // single-flight guard to prevent concurrent generations

// Flag to use direct REST API calls (more reliable for user-provided keys)
// const useDirectRestAPI = true;

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

// Fetch available models from Google API
export const fetchAvailableModels = async (apiKey) => {
  if (!apiKey) return [];
  
  try {
    const url = `${API_BASE_URL}/models?key=${encodeURIComponent(apiKey)}&pageSize=50`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('Failed to fetch models:', response.statusText);
      return [];
    }
    
    const data = await response.json();
    if (data.models) {
      console.log('📦 Raw Models Data:', data.models); // Debug log for user
      
      // Filter for gemini models that support content generation
      const fetched = data.models
        .filter(m => 
          m.name.includes('gemini') && 
          m.supportedGenerationMethods && 
          m.supportedGenerationMethods.includes('generateContent')
        )
        .map(m => {
           const id = m.name.replace('models/', '');
           return {
             id: id,
             name: m.displayName || id,
             description: m.description || '',
           };
        });

      // Prefer Banana (any variant), then keep defaults (2.5 / 3.0)
      const banana = fetched.filter(m => (m.id + m.name).toLowerCase().includes('banana'));

      const merged = [...banana];
      AVAILABLE_MODELS.forEach(def => {
        if (!merged.find(m => m.id === def.id)) merged.push(def);
      });

      // If we found at least one banana model, set default to the first banana
      if (banana.length > 0) {
        DEFAULT_MODEL_ID = banana[0].id;
      } else {
        DEFAULT_MODEL_ID = "gemini-2.5-flash"; // fallback
      }

      // Filter out TTS and keep original order: Banana first (if any), then defaults
      return merged
        .filter(m => !m.id.toLowerCase().includes('tts'));
    }
    return AVAILABLE_MODELS; // Fallback if no models field
  } catch (error) {
    console.error('Error fetching models:', error);
    return AVAILABLE_MODELS; // Fallback on error
  }
};

export const initializeGoogleAI = (apiKey) => {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  // Only reinitialize if the API key has changed
  if (currentApiKey !== apiKey) {
    console.log('🔄 Initializing Google AI with new API key (override detected)');
    // genAI = new GoogleGenAI({
    //   apiKey: apiKey
    // });
    currentApiKey = apiKey;
  } else {
    console.log('✅ Using existing Google AI client (same API key)');
  }

  return null; // genAI;
};

// Direct REST API call function that explicitly uses the user's API key
const generateContentDirectRest = async (apiKey, prompt, context = "", previousImage = null, style = "", model = DEFAULT_MODEL_ID) => {
  if (!apiKey) {
    throw new Error('API key is required for generation');
  }

  console.log(`🚀 Using direct REST API with user API key on model ${model}:`, apiKey.substring(0, 8) + '...');

  // Build the full prompt
  let fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
  if (style) {
    fullPrompt += `\nStyle: ${style}.`;
  }

  // Prepare contents for the API call
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

      // Format matching documentation for image+text
      contents = [
        { text: fullPrompt },
        {
          inlineData: {
            mimeType: mimeType,
            data: imageData
          }
        }
      ];
    } catch (error) {
      console.error('Error processing previous image:', error);
      // Fall back to text-only if image processing fails
      contents = [{ text: fullPrompt }];
    }
  } else {
    // Text-only format
    contents = [{ text: fullPrompt }];
  }

  // Build request payload
  const requestPayload = {
    contents: [{
      parts: contents
    }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"]
    }
  };

  // Compute request payload size
  const requestJson = JSON.stringify(requestPayload);
  const requestBytes = utf8ByteLength(requestJson);
  
  // Compute total decoded image bytes
  let imageDecodedBytes = 0;
  for (const part of contents) {
    if (part && part.inlineData && part.inlineData.data) {
      imageDecodedBytes += base64DecodedBytes(part.inlineData.data);
    }
  }

  console.log(`📦 Outgoing request size ≈ ${(requestBytes/1024).toFixed(1)} KB` + (imageDecodedBytes > 0 ? ` | images (decoded) ≈ ${(imageDecodedBytes/1024).toFixed(1)} KB` : ''));

  // Make direct REST API call with user's API key
  const url = `${API_BASE_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: requestJson,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
    
    if (response.status === 429 || errorMessage.toUpperCase().includes('QUOTA')) {
      throw new Error(`API quota exceeded. Please check your usage limits and billing settings. Error: ${errorMessage}`);
    } else if (response.status === 401 || errorMessage.includes('API_KEY')) {
      throw new Error(`Invalid API key. Please check your Gemini API key. Error: ${errorMessage}`);
    } else if (response.status === 403 || errorMessage.includes('PERMISSION')) {
      throw new Error(`Permission denied. Please check your API key permissions. Error: ${errorMessage}`);
    } else {
      throw new Error(`Generation failed: ${errorMessage}`);
    }
  }

  const responseData = await response.json();
  
  // Debug log full response
  console.log('📦 API Response:', JSON.stringify(responseData, null, 2));

  // Extract text and image from the response
  let text = null;
  let image = null;

  if (responseData.candidates && responseData.candidates[0] && responseData.candidates[0].content) {
    // Check finish reason
    const finishReason = responseData.candidates[0].finishReason;
    if (finishReason && finishReason !== 'STOP') {
      console.warn('⚠️ Generation finished with reason:', finishReason);
      if (finishReason === 'SAFETY') {
         throw new Error('Generation blocked by safety filters. Please try a different prompt or simpler image.');
      }
    }

    if (responseData.candidates[0].safetyRatings) {
       console.log('🛡️ Safety Ratings:', responseData.candidates[0].safetyRatings);
    }

    for (const part of responseData.candidates[0].content.parts) {
      if (part.text) {
        text = (text || '') + part.text;
      } else if (part.inlineData) {
        // Convert base64 data to blob URL
        const imageData = part.inlineData.data;
        const mimeType = part.inlineData.mimeType;

        try {
          const byteCharacters = atob(imageData);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          image = URL.createObjectURL(blob);
        } catch (error) {
          console.error('Error processing image data:', error);
        }
      }
    }
  }

  // If no image was found but we have text, try to generate image-only
  let generationError = null;

  if (!image && text) {
    try {
      console.log('No image in initial response, attempting image-only generation...');

      const imageOnlyPayload = {
        contents: [{
          parts: [{ text: text }]
        }],
        generationConfig: {
          responseModalities: ["IMAGE"]
        }
      };

      const imageOnlyResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(imageOnlyPayload),
      });

      if (imageOnlyResponse.ok) {
        const imageOnlyData = await imageOnlyResponse.json();
        
        if (imageOnlyData.candidates && imageOnlyData.candidates[0] && imageOnlyData.candidates[0].content) {
          for (const part of imageOnlyData.candidates[0].content.parts) {
            if (part.inlineData) {
              const imageData = part.inlineData.data;
              const mimeType = part.inlineData.mimeType;

              try {
                const byteCharacters = atob(imageData);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: mimeType });
                image = URL.createObjectURL(blob);
                console.log('Fallback image generation succeeded');
                break;
              } catch (error) {
                console.error('Error processing fallback image data:', error);
                generationError = `Image processing failed: ${error.message}`;
              }
            }
          }
        } else {
           generationError = "Fallback generation returned no content.";
        }
      } else {
        generationError = `Fallback generation failed: ${imageOnlyResponse.statusText}`;
      }
    } catch (fallbackError) {
      console.error('Fallback image generation failed:', fallbackError);
      generationError = `Fallback generation error: ${fallbackError.message}`;
    }
  } else if (!image && !text) {
     generationError = "Model returned empty response (no text or image).";
  }

  return { text, image, metrics: { requestBytes, imageDecodedBytes }, error: generationError };
};

export const generateContent = async (prompt, context = "", previousImage = null, style = "", model = DEFAULT_MODEL_ID) => {
  if (!currentApiKey) {
    throw new Error('Google AI client not initialized. Please set your API key first.');
  }

  console.log(`🚀 Starting content generation with API key on ${model}:`, currentApiKey ? currentApiKey.substring(0, 8) + '...' : 'NO KEY');

  // Prevent concurrent generateContent calls from this module
  if (generationInProgress) {
    throw new Error('A generation request is already in progress. Please wait for it to complete.');
  }

  try {
    generationInProgress = true;

    // Use direct REST API calls to ensure user's API key is always used
    // This prevents the SDK from potentially using a default/fallback API key
    return await generateContentDirectRest(currentApiKey, prompt, context, previousImage, style, model);

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
  return currentApiKey !== null;
};

export const getCurrentApiKey = () => {
  return currentApiKey;
};
