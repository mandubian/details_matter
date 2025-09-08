import { GoogleGenAI } from "@google/genai";

const MODEL_ID = "gemini-2.5-flash-image-preview";

// Initialize the Google AI client
let genAI = null;
let currentApiKey = null;

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

export const generateContent = async (prompt, context = "", previousImage = null, style = "") => {
  if (!genAI) {
    throw new Error('Google AI client not initialized. Please set your API key first.');
  }

  console.log('🚀 Starting content generation with API key:', currentApiKey ? currentApiKey.substring(0, 8) + '...' : 'NO KEY');

  try {
    // Build the full prompt
    let fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
    if (style) {
      fullPrompt += `\nStyle: ${style}.`;
    }

    // Prepare contents for the API call (matching documentation exactly)
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
        contents = fullPrompt;
      }
    } else {
      // Text-only format (matching documentation)
      contents = fullPrompt;
    }

    // Generate content with image modality (matching documentation exactly)
    const response = await genAI.models.generateContent({
      model: MODEL_ID,
      contents: contents,
    });

    // Extract text and image from the response (matching documentation exactly)
    let text = null;
    let image = null;

    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        text = (text || '') + part.text;
      } else if (part.inlineData) {
        // Convert base64 data to blob URL (matching documentation)
        const imageData = part.inlineData.data;
        const mimeType = part.inlineData.mimeType;

        try {
          // Create blob from base64 data
          const byteCharacters = atob(imageData);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });

          // Create object URL for the blob
          image = URL.createObjectURL(blob);
        } catch (error) {
          console.error('Error processing image data:', error);
        }
      }
    }

    // If no image was found but we have text, try to generate image-only
    if (!image && text) {
      try {
        console.log('No image in initial response, attempting image-only generation...');

        const imageOnlyResponse = await genAI.models.generateContent({
          model: MODEL_ID,
          contents: text,
        });

        // Handle fallback response (matching documentation)
        for (const part of imageOnlyResponse.candidates[0].content.parts) {
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
            }
          }
        }
      } catch (fallbackError) {
        console.error('Fallback image generation failed:', fallbackError);
      }
    }

    return { text, image };

  } catch (error) {
    console.error('Error generating content:', error);

    if (error.message && error.message.includes('API_KEY_INVALID')) {
      throw new Error('Invalid API key. Please check your Gemini API key.');
    } else if (error.message && error.message.includes('QUOTA_EXCEEDED')) {
      throw new Error('API quota exceeded. Please check your usage limits.');
    } else if (error.message && error.message.includes('PERMISSION_DENIED')) {
      throw new Error('Permission denied. Please check your API key permissions.');
    } else {
      throw new Error(`Generation failed: ${error.message || 'Unknown error'}`);
    }
  }
};

export const isInitialized = () => {
  return genAI !== null;
};

export const getCurrentApiKey = () => {
  return currentApiKey;
};
