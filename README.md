# Banana Hack - Directed AI Creative Dialog with Nano-Banana

An advanced Python project for multimodal AI creativity using Google Gemini Nano-Banana. This application implements a **three-AI collaborative system** where a Director AI orchestrates two creative models (Artist and Storyteller) to produce unpredictable, dramatic, and richly evolving creative content. The philosophy centers on **emergent creativity through tension and direction**: the Director doesn't create but guides, critiques, and transforms the creative process, creating dynamic interactions that lead to surprising narratives and visuals. Enhanced with session management for persistent world-building and iterative development.

## Philosophy

The core philosophy is **orchestrated emergence** - rather than linear generation, this system creates a dynamic ecosystem where:
- **Director AI** acts as a creative conductor, providing critiques, inspirations, persona shifts, world updates, or direct guidance
- **Artist & Storyteller** collaborate under direction, with roles that can shift dramatically (e.g., from "Dreamer" to "Critic")
- **World Bible** evolves organically, maintaining consistency while allowing dramatic changes
- **Session Persistence** enables returning to complex creative states, building long-term universes

This approach produces content that's not just generated, but **emergently co-authored** through AI-AI interaction, leading to unpredictable, dramatic, and deeply creative results.

## Applications

### Details Matter App (`details_matter.py`)
An intentionally minimalist companion app focused on visual evolution through micro-detail preservation. You start with a prompt (and optionally an image). Each AI turn: (1) inspects the previous image, (2) chooses exactly one visually meaningful detail (object, motif, texture, symbol), (3) states that choice in the first sentence (shown in bold), (4) invents a new narrative context where only that detail remains recognizable, and (5) generates a new image that discards everything else. Over successive turns the scene drifts radically while a tiny thread of continuity persists—letting you observe how meaning mutates when anchored by a single fragment. The app supports style switching per turn, fallback image regeneration if the model returns only text, second‑pass image-only retries, per-turn regeneration for failures, and full session save/load (JSON + images + ZIP). Use it to study constraint-driven divergence, aesthetic decay, or emergent reinterpretation of a chosen visual seed.

## Features

### Core Three-AI System
- **Director AI Orchestration**: Uses OpenRouter's DeepSeek model to provide real-time direction, choosing from:
  - **CRITIQUE**: Specific feedback that must be addressed
  - **INSPIRATION**: Cryptic creative concepts to incorporate
  - **PERSONA_SHIFT**: Dynamic role changes for Artist/Storyteller (e.g., "The Rebel" vs "The Visionary")
  - **WORLD_UPDATE**: Adds/modifies elements to the shared World Bible
  - **DIRECTION**: Specific guidance for collaborative steps
- **Dynamic Personas**: Artist and Storyteller roles evolve based on Director decisions, creating creative tension and drama
- **World Bible Management**: JSON-based shared memory that AIs consult and update for consistency across sessions

### Enhanced Creative Generation
- **Multimodal Input/Output**: Upload initial images + prompts; generates styled text + images with visual consistency
- **Generation Modes**:
  - **Autonomous Story**: Narrative progression with visual support
  - **Visual Evolution**: Progressive image enhancement and transformation
  - **Surreal Injection**: Dream-like, unexpected creative twists
  - **Free Imagination**: Open-ended collaborative creativity
- **Art Style Integration**: Photorealistic, Cartoon, Abstract, Fantasy, Sci-Fi styles infused into prompts
- **Turn-Based Collaboration**: Alternating Artist (visual) and Storyteller (narrative) turns, each directed by the Director AI

### Session Management
- **Comprehensive Saving**: Export entire sessions to directories with:
  - `session.json`: Complete state (conversation, personas, world bible, metadata)
  - `images/` folder: All generated images with mapping
  - ZIP download for easy sharing/archiving
- **Dynamic Session Loading**: Auto-detects and lists saved sessions in dropdown; restores full state including images
- **Persistent Creativity**: Load any saved session to continue complex world-building from any point

### Important: Where sessions are stored

This demo stores sessions in a local `sessions/` directory inside the application workspace. Important notes:

- Saved sessions are accessible to anyone using the same app instance while it is running (they are not private per-browser-session).
- If the host process or machine is restarted, the in-memory state and any non-downloaded session files may be deleted by the environment. Always download the ZIP when you want long-term access to generated images.

If you want per-user privacy or durable storage across reboots, run the app with a persistent storage backend or modify the code to upload session archives to a user-specific cloud storage location.

### User Interface & Controls
- **Sidebar Configuration**: API keys, model names, generation mode, art style selection
- **Real-time Display**: Conversation history with Director guidance, generated text/images, persona status
- **Interactive Controls**:
  - Manual "Continue Next Directed Turn" with fresh Director input
  - "Force Director Intervention" for guidance without generation
  - Reset collaboration, undo last turn
  - Statistics: Creative turns, images generated, world elements
- **Debug Transparency**: Shows Director prompts, API responses, and JSON parsing for transparency

## Setup

1. **Install dependencies:**
   ```bash
   uv sync
   ```
   (Includes `google-generativeai>=0.8.3`, `streamlit`, `pillow`, `requests` for OpenRouter integration.)

2. **API Keys Setup:**
   - **Google Gemini**: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)
   - **OpenRouter**: Get from [OpenRouter](https://openrouter.ai) for Director AI
   - Set environment variables:
     ```bash
     export GEMINI_API_KEY="your-gemini-key-here"
     export OPENROUTER_API_KEY="your-openrouter-key-here"
     ```
   - Or enter manually in the app sidebar.

3. **Directory Structure:**
   ```
   .
   ├── dialog_app.py          # Main application
   ├── sessions/              # Saved sessions (auto-created)
   │   └── session_XXXX/
   │       ├── session.json   # Session state
   │       └── images/        # Generated images
   ├── generated_turn_*.png   # Current session images
   ├── pyproject.toml         # Dependencies
   └── README.md              # This file
   ```

## Usage

### Run the Application
```bash
uv run streamlit run dialog_app.py
```
Open http://localhost:8501 in your browser.

### Basic Workflow
1. **Configuration**: Set API keys (auto-loaded from environment), customize Director name, Artist/Storyteller base names, generation mode, and art style
2. **Start Creation**: 
   - Enter initial prompt (e.g., "A mysterious library where books come alive")
   - Upload optional initial image
   - Set number of directed turns (2-12)
   - Optionally define initial World Bible elements
   - Click "Begin Directed Collaboration"
3. **View Evolution**: Watch the three-AI system collaborate:
   - Director provides guidance/critiques/persona shifts
   - Artist generates visuals (even turns)
   - Storyteller develops narrative (odd turns)
   - World Bible evolves automatically
4. **Continue Development**:
   - Use "Continue Next Directed Turn" for single-step progression
   - "Force Director Intervention" for guidance without generation
   - Monitor current personas and world state in expanders
5. **Session Management**:
   - "Save Current Session" creates directory with JSON + images + ZIP download
   - "Load Past Session" dropdown lists all saved sessions for easy restoration

### Advanced Features
- **Director Transparency**: View raw prompts, API responses, and JSON parsing in the interface
- **Persona Dynamics**: Watch Artist/Storyteller roles shift based on Director decisions
- **World Building**: See the evolving World Bible that maintains creative consistency
- **Visual Consistency**: Images build progressively, enhancing previous outputs
- **Debug Mode**: Full API interaction visible for troubleshooting and understanding

### Example Session Flow
1. **Human Setup**: "A floating island with ancient ruins" + fantasy image upload
2. **Turn 1 (Artist)**: Director: "Introduce mystery" → Generates mysterious glowing ruins
3. **Turn 2 (Storyteller)**: Director: "Shift to Dreamer persona" → Narrative about dream-walking explorers
4. **Turn 3 (Artist, Dreamer)**: Director: "World update: magic crystals" → Image with glowing crystal structures
5. **Continue**: Load this session later to add "crystal-powered flying ships" in Sci-Fi mode

## Technical Implementation

### AI Models
- **Creative Models**: Google Gemini 2.5 Flash (Image Preview) for text+image generation
- **Director AI**: DeepSeek Chat V3.1 via OpenRouter for orchestration and JSON-structured responses
- **Multimodal Pipeline**: Previous images fed back for consistent visual evolution

### Session Data Structure
Saved `session.json` contains:
```json
{
  "session_id": "abc123",
  "mode": "Autonomous Story",
  "style": "Fantasy",
  "director": "Creative Director",
  "current_personas": {"artist": "The Dreamer", "storyteller": "The Visionary"},
  "world_bible": {"magic_system": "Crystal resonance", "core_location": "Floating islands"},
  "turns": [/* conversation history with text, images, timestamps, director guidance */],
  "images": {/* path mappings for image restoration */}
}
```

### Error Handling & Fallbacks
- API failures trigger simulated Director responses
- JSON parsing includes cleaning and validation
- Image loading failures handled gracefully
- Session loading validates file existence before restoration

## Requirements

- **Python**: 3.12+
- **APIs**: 
  - Google Gemini API key (nano-banana access)
  - OpenRouter API key (DeepSeek model access)
- **Dependencies**: Managed via `uv` and `pyproject.toml`
- **Internet**: Required for API calls
- **Storage**: Sufficient disk space for image generation and session archives

## Cost Management

- **Generation Control**: Limit turns per session (2-12 recommended)
- **API Monitoring**: Track usage in Google AI Studio and OpenRouter dashboard
- **Image Optimization**: Generated images are 1024px width for balance of quality/cost
- **Session Reuse**: Load existing sessions to continue without regenerating prior content

## Development & Contribution

This project demonstrates advanced AI orchestration patterns. Contributions welcome for:
- Additional Director actions/responses
- Enhanced world bible management
- New generation modes or art styles
- Improved session import/export formats
- Integration with additional AI models/providers

## Future Directions

- **Interactive Branching**: Allow users to choose between Director-proposed creative paths
- **Multi-Session Workspaces**: Manage multiple parallel creative universes
- **Export Enhancements**: Direct integration with animation/video tools
- **Advanced Personas**: More complex role systems with AI-driven character development
- **Collaborative Mode**: Multiple users contributing to shared world bibles

## License & Credits

- Built with [Google Gemini Nano-Banana](https://github.com/google-gemini/nano-banana-hackathon-kit)
- UI powered by [Streamlit](https://streamlit.io)
- Director AI via [OpenRouter](https://openrouter.ai)
- Images generated by Google Gemini 2.5 Flash Image Preview

For more information, see the [Nano-Banana Guide](https://github.com/google-gemini/nano-banana-hackathon-kit/blob/main/guides/02-use-nano-banana.ipynb).

## API Key Handling & Security

The `details_matter.py` app now keeps the Gemini API key **only in the current Streamlit session's memory (`st.session_state`)**. It is:

- NOT written to environment variables
- NOT persisted to disk
- NOT embedded in exported sessions / JSON / ZIP
- NOT echoed back in the UI after entry

### Threat Model & Limitations

This is a *demo / exploratory* tool. While the key isn't stored beyond your session, if you deploy this on infrastructure you don't fully control (public server, shared container, classroom machine):

- A malicious or curious operator could still modify the code to log keys
- Other Python processes on the same machine cannot read it directly, but injected code in this process could
- Streamlit does not provide cryptographic isolation between users on a single shared process

### Recommended Practices

| Scenario | Recommended Action |
|----------|--------------------|
| Local personal experimentation | Paste a normal key; low risk |
| Shared internal demo (trusted team) | Use a **scoped or secondary key** with quota limits |
| Public internet demo | Proxy requests through a backend you control; never expose raw key |
| Production multi-user service | Implement server-side tokenization or per-user OAuth-style brokerage |

### Hardening Options (Not Implemented Here)

- Reverse proxy microservice that accepts high-level generation requests and injects the real key server-side
- Rate limiting & anomaly detection on backend calls
- Ephemeral short-lived signed tokens exchanged for real key usage
- Audit logging with redaction (hash keys before logging)

### Why Not Environment Variables Anymore?

Environment variables are **process-global**. In multi-user deployments, a single user setting `GEMINI_API_KEY` would unintentionally expose it to others and to any later code paths. Removing env writes enforces per-session isolation.

### Quick Summary

> Treat any browser-entered API key as recoverable by someone with deploy access. Use throwaway or limited-scope keys for demos.



## Future Concepts & Enhancements

#### Advanced Interactive Elements

While more complex to integrate, allowing the AIs to generate interactive elements would transform the user experience from passive observation to active participation.
-   **AI-Generated Choices:** The Storyteller AI could propose two narrative paths, letting the user choose which one to follow.
-   **Clickable Image Objects:** The Artist AI could tag an object in its generated image (e.g., a mysterious door). The user could then click it to prompt the AIs to generate a new turn focused entirely on
