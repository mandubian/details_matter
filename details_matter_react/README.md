# Only Details Matter - React Version

A React web application that demonstrates how generative AI models preserve visual details across iterative image generations.

## Features

- **Client-side Google AI integration**: All API calls happen in the browser using Gemini 2.5 Flash with @google/genai SDK
- **Local-first storage**: Sessions saved to browser localStorage by default
- **Cloud sync (optional)**: Publish threads to a shared Cloudflare R2 gallery
- **Iterative image generation**: Watch how AI preserves single visual details across generations
- **Art style selection**: Choose from 20+ different art styles
- **Gallery views**: Browse threads as a **Wall** (masonry grid) or **Tree** (fork visualization)
- **Forking**: Branch off from any point in any thread (local or cloud)
- **Responsive design**: Works on desktop and mobile devices

## Setup Instructions

### 1. Install Dependencies

```bash
cd details_matter_react
npm install
```

### 2. Get a Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create a new API key
3. Copy the API key (use a throwaway/dev key for testing)

### 3. (Optional) Set up Google Sign-In

To allow users to sign in with their Google account instead of pasting an API key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Go to **APIs & Services > Credentials**
4. Create **OAuth Client ID** (Application type: Web application)
5. Add Authorized JavaScript origins: `http://localhost:3000` (and your production URL)
6. Copy the **Client ID**
7. Set the Client ID in `.env` file (create one in root `details_matter_react/`):
   ```
   REACT_APP_GOOGLE_CLIENT_ID=your-client-id-here
   ```

### 4. Start the Development Server

```bash
npm start
```

The app will open in your browser at `http://localhost:3000`

### 4. Set Your API Key

1. In the left sidebar, enter your Gemini API key
2. The key is stored only in your browser's localStorage
3. Never use a production API key

## How to Use

1. **Set up your session**: Enter an initial prompt describing what you want to generate
2. **Optional**: Upload an initial image to seed the evolution
3. **Begin**: Click "🎬 Begin Single-Model Evolution" to generate the first image
4. **Continue**: Click "Continue Next Turn" to see how the AI preserves details
5. **Regenerate**: Use individual turn regeneration if you're not happy with a result
6. **Style**: Change art styles between generations
7. **Save**: Your session is automatically saved to browser localStorage

## Architecture

- **Frontend**: React with hooks for state management
- **AI Integration**: Direct client-side calls to Google Gemini API
- **Local Storage**: Browser localStorage for session persistence
- **Cloud Storage**: Cloudflare R2 (blobs) + KV (metadata index)
- **Styling**: CSS with responsive design
- **Images**: Compressed to 720p WebP before storage

## Cloud Sync (Optional)

The app supports publishing threads to a shared cloud gallery using Cloudflare Workers + R2.

### Worker Deployment

1. **Install Wrangler** (Cloudflare CLI):
   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. **Create Resources** in Cloudflare Dashboard:
   - KV Namespace (e.g., `GALLERY_KV`)
   - R2 Bucket (e.g., `details-matter-threads`)

3. **Create `wrangler.toml`** in `worker/`:
   ```toml
   name = "details-matter-gallery"
   main = "worker.js"
   compatibility_date = "2024-01-01"

   [[kv_namespaces]]
   binding = "GALLERY_KV"
   id = "your-kv-namespace-id"

   [[r2_buckets]]
   binding = "GALLERY_BUCKET"
   bucket_name = "details-matter-threads"
   ```

4. **Deploy**:
   ```bash
   cd worker
   wrangler deploy
   ```

5. **Configure in App**: Enter your Worker URL in the Cloud tab settings.

### How It Works

- **Metadata** (title, timestamp, thumbnail) → stored in **KV** for fast listing
- **Full thread data** (with images) → stored in **R2** for cost-effective blob storage
- Images are compressed to **720p WebP** client-side before upload


## Security Notes

- API keys are stored only in browser localStorage
- All AI API calls happen client-side
- No data is sent to any server
- Use throwaway/dev API keys only
- Generated images are stored as blob URLs in memory

## Differences from Streamlit Version

- **No server dependency**: Runs entirely in the browser
- **Better mobile support**: Responsive design
- **Faster UI**: React's virtual DOM provides smoother interactions
- **Persistent sessions**: Automatic saving to localStorage
- **Simplified deployment**: Can be deployed to any static hosting service

## Alternative AI Services

If Gemini image generation is not available in your region, you can modify the app to use other AI services:

### Option 1: OpenAI DALL-E
- Replace the Google AI integration with OpenAI's API
- Update `src/utils/googleAI.js` to use OpenAI's image generation endpoint
- More widely available globally

### Option 2: Stability AI
- Use Stable Diffusion API through Stability AI
- May have fewer geographic restrictions
- Good for creative image generation

### Option 3: Replicate
- Cloud-hosted AI models including image generation
- Supports various models (Stable Diffusion, etc.)
- Generally more permissive access

## Deployment to Google AI Studio

1. Build the production version:
   ```bash
   npm run build
   ```

2. The `build` folder contains static files that can be deployed to any web server

3. For Google AI Studio, you can:
   - Host on GitHub Pages
   - Use Vercel or Netlify for free hosting
   - Deploy to any static web hosting service

## Troubleshooting

**API Key Issues:**
- Make sure your API key is valid and has proper permissions
- Check the browser console for error messages
- Try refreshing the page if the key doesn't seem to work

**Content Format Errors:**
- If you see errors about "Invalid value at 'contents[0]'", the app has been updated to fix this
- The app now uses the correct @google/genai SDK and API format matching official documentation
- Make sure you're using the latest version of the app
- Clear browser cache if issues persist

**Image Generation Failures:**
- Some prompts may not generate images - try different wording
- Check your API quota/limits
- Try regenerating failed turns individually
- Make sure your API key has access to Gemini models

**Geographic Restrictions:**
- **"Image generation is not available in your country"**: This is a Google service limitation
- Gemini image generation is only available in certain countries/regions
- Check [Google AI availability](https://ai.google.dev/available_regions) for your location
- If unavailable, consider using a VPN or alternative AI services

**Model Compatibility:**
- The app uses Gemini 2.5 Flash Image Preview for native image generation
- If you encounter model-related errors, try refreshing the page
- Check Google AI Studio for any service updates

**Performance:**
- Large images may take longer to generate
- Complex prompts can cause timeouts
- Try simpler prompts for faster results
- Image processing may take longer on slower connections

## License

Apache-2.0 (same as original project)
