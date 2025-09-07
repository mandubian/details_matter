import streamlit as st
import os
import google.genai as genai
from google.genai import types
from PIL import Image
import uuid
import time
from typing import List, Dict, Any, Optional
import base64
import io
import json
import re
import requests  # For OpenRouter API
import traceback
import shutil  # For copying images to session directory

# Configure page
st.set_page_config(
    page_title="AI Creative Dialog",
    page_icon="🎨",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state
if 'conversation' not in st.session_state:
    st.session_state.conversation = []
if 'current_turn' not in st.session_state:
    st.session_state.current_turn = 0
if 'model_a_name' not in st.session_state:
    st.session_state.model_a_name = "Artist Model A"
if 'model_b_name' not in st.session_state:
    st.session_state.model_b_name = "Storyteller Model B"
if 'director_name' not in st.session_state:
    st.session_state.director_name = "Director AI"
if 'api_key_set' not in st.session_state:
    st.session_state.api_key_set = False
if 'generation_mode' not in st.session_state:
    st.session_state.generation_mode = "Autonomous Story"
if 'style' not in st.session_state:
    st.session_state.style = "Photorealistic"
if 'initial_image' not in st.session_state:
    st.session_state.initial_image = None
if 'world_bible' not in st.session_state:
    st.session_state.world_bible = {}
if 'current_personas' not in st.session_state:
    st.session_state.current_personas = {"artist": "Artist", "storyteller": "Storyteller"}

MODEL_ID = "gemini-2.5-flash-image-preview"
# DIRECTOR_MODEL = "deepseek/deepseek-chat-v3.1:free"  # OpenRouter model
# DIRECTOR_MODEL = "openrouter/sonoma-sky-alpha"  # OpenRouter model
DIRECTOR_MODEL = "moonshotai/kimi-k2:free"  # OpenRouter model

class CreativeDialog:
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)

    def generate_content(self, prompt: str, context: str = "", previous_image: Optional[Image.Image] = None, style: str = "") -> Dict[str, Any]:
        """Generate combined content (text + image) using nano-banana model, improving on previous image if provided."""
        full_prompt = f"{context}\n\n{prompt}" if context else prompt
        if style:
            full_prompt += f"\nStyle: {style}."

        try:
            if previous_image:
                enhanced_prompt = (
                    "Enhance and continue the existing image according to the new prompt while maintaining character consistency, style, and scene elements. "
                    "Build upon the visual composition intelligently. " + full_prompt
                )
                contents = [enhanced_prompt, previous_image]
            else:
                contents = [full_prompt]

            st.write("**Artist Model Prompt (truncated):**")
            st.code(str(contents[0])[:1000] + "..." if len(str(contents[0])) > 1000 else str(contents[0]))
            if previous_image:
                st.write("**Using previous image for enhancement**")

            response = self.client.models.generate_content(
                model=MODEL_ID,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_modalities=['Text', 'Image']
                )
            )

            st.write("**Raw response object:**")
            st.write(f"Response type: {type(response)}")
            st.write(f"Response parts: {len(response.parts) if hasattr(response, 'parts') else 'No parts attribute'}")

            out_text: Optional[str] = None
            out_image: Optional[Image.Image] = None

            for i, part in enumerate(response.parts):
                st.write(f"**Part {i}:**")
                st.write(f"Part type: {type(part)}")
                if hasattr(part, 'text') and part.text:
                    st.write(f"Text content: {part.text[:200]}...")
                    out_text = (out_text or "") + part.text

                # Try multiple strategies to extract an image from the part
                got_image = False

                # 1) Preferred SDK helper
                if hasattr(part, 'as_image'):
                    try:
                        image = part.as_image()
                        if image:
                            st.write("**Image generated successfully via part.as_image()**")
                            out_image = image
                            got_image = True
                        else:
                            st.write("**part.as_image() returned None**")
                    except Exception as img_e:
                        st.error(f"Error calling as_image(): {img_e}")

                # 2) Check common attributes that may contain bytes or base64 strings
                if not got_image:
                    for attr in ('image', 'image_bytes', 'binary', 'data'):
                        if hasattr(part, attr):
                            try:
                                val = getattr(part, attr)
                                if isinstance(val, (bytes, bytearray)):
                                    img = Image.open(io.BytesIO(val))
                                    out_image = img
                                    got_image = True
                                    st.write(f"**Image extracted from attribute '{attr}' (bytes)**")
                                    break
                                if isinstance(val, str):
                                    # Attempt to decode base64 string
                                    try:
                                        decoded = base64.b64decode(val)
                                        img = Image.open(io.BytesIO(decoded))
                                        out_image = img
                                        got_image = True
                                        st.write(f"**Image extracted from attribute '{attr}' (base64 string)**")
                                        break
                                    except Exception:
                                        # Not base64 or failed to decode
                                        pass
                            except Exception as ex_attr:
                                st.write(f"Could not extract image from attribute '{attr}': {ex_attr}")

                # 3) Fallback: search for base64 data embedded in text
                if not got_image and hasattr(part, 'text') and part.text:
                    try:
                        txt = part.text
                        if 'base64,' in txt:
                            b64 = txt.split('base64,')[-1]
                            b64 = b64.strip().strip('`').split('\n')[0]
                            decoded = base64.b64decode(b64)
                            img = Image.open(io.BytesIO(decoded))
                            out_image = img
                            got_image = True
                            st.write("**Image decoded from base64 embedded in text**")
                    except Exception as ex_b64:
                        st.write(f"No embedded base64 image found in text or decode failed: {ex_b64}")

                if not got_image:
                    st.write("**No image found in this part**")

            st.write(f"**Final output - Text: {'Present' if out_text else 'None'}, Image: {'Present' if out_image else 'None'}**")

            return {"text": out_text, "image": out_image}
        except Exception as e:
            st.error(f"Error generating content: {str(e)}")
            st.error(f"Exception type: {type(e)}")
            st.write("**Full traceback:**")
            st.code(traceback.format_exc())
            return {"text": None, "image": None}

class DirectorAI:
    def __init__(self, openrouter_api_key: str):
        self.api_key = openrouter_api_key
        self.base_url = "https://openrouter.ai/api/v1"
        self.headers = {
            "Authorization": f"Bearer {openrouter_api_key}",
            "Content-Type": "application/json"
        }

    def _call_openrouter(self, prompt: str) -> Optional[str]:
        """Call OpenRouter API and return response content."""
        try:
            import requests
            # Debug: show the prompt being sent
            st.write("**Director Prompt (truncated):**")
            st.code(prompt[:2000])
            payload = {
                "model": DIRECTOR_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 500,
                "temperature": 0.8
            }
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=30
            )
            # Always show raw response text for debugging
            raw_text = response.text
            st.write("**OpenRouter Raw Response (text):**")
            st.code(raw_text[:4000])
            response.raise_for_status()
            api_response = response.json()["choices"][0]["message"]["content"]
            
            # Debug logging
            st.write("**Director API Response (extracted):**")
            st.code(api_response)
            
            return api_response
        except Exception as e:
            # Show full exception in UI + terminal
            st.error(f"OpenRouter API call failed: {str(e)}. Using fallback simulation.")
            st.write("Exception details:")
            st.code(traceback.format_exc())
            return None

class StorytellerAI:
    def __init__(self, openrouter_api_key: str):
        self.api_key = openrouter_api_key
        self.base_url = "https://openrouter.ai/api/v1"
        self.headers = {
            "Authorization": f"Bearer {openrouter_api_key}",
            "Content-Type": "application/json"
        }
        self.model = DIRECTOR_MODEL  # Same model as Director

    def _call_openrouter(self, prompt: str) -> Optional[str]:
        """Call OpenRouter API and return response content."""
        try:
            import requests
            # Debug: show the prompt being sent for Storyteller
            st.write("**Storyteller Prompt (truncated):**")
            st.code(prompt[:2000])
            payload = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 800,  # Longer for narrative
                "temperature": 0.7
            }
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=30
            )
            # Show raw response for debugging
            raw_text = response.text
            st.write("**OpenRouter Storyteller Response (text):**")
            st.code(raw_text[:4000])
            response.raise_for_status()
            api_response = response.json()["choices"][0]["message"]["content"]
            
            st.write("**Storyteller Response:**")
            st.code(api_response)
            
            return api_response
        except Exception as e:
            st.error(f"Storyteller OpenRouter API call failed: {str(e)}")
            st.write("Exception details:")
            st.code(traceback.format_exc())
            return None

    def generate_content(self, prompt: str, context: str = "", previous_image: Optional[Image.Image] = None, style: str = "") -> Dict[str, Any]:
        """Generate text-only content for Storyteller using OpenRouter."""
        full_prompt = f"{context}\n\n{prompt}" if context else prompt
        if style:
            full_prompt += f"\nStyle context: {style}."
        
        response_text = self._call_openrouter(full_prompt)
        return {"text": response_text, "image": None}

class DirectorAI:
    def __init__(self, openrouter_api_key: str):
        self.api_key = openrouter_api_key
        self.base_url = "https://openrouter.ai/api/v1"
        self.headers = {
            "Authorization": f"Bearer {openrouter_api_key}",
            "Content-Type": "application/json"
        }

    def _call_openrouter(self, prompt: str) -> Optional[str]:
        """Call OpenRouter API and return response content."""
        try:
            import requests
            # Debug: show the prompt being sent
            st.write("**Director Prompt (truncated):**")
            st.code(prompt[:2000])
            payload = {
                "model": DIRECTOR_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 500,
                "temperature": 0.8
            }
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=30
            )
            # Always show raw response text for debugging
            raw_text = response.text
            st.write("**OpenRouter Raw Response (text):**")
            st.code(raw_text[:4000])
            response.raise_for_status()
            api_response = response.json()["choices"][0]["message"]["content"]
            
            # Debug logging
            st.write("**Director API Response (extracted):**")
            st.code(api_response)
            
            return api_response
        except Exception as e:
            # Show full exception in UI + terminal
            st.error(f"OpenRouter API call failed: {str(e)}. Using fallback simulation.")
            st.write("Exception details:")
            st.code(traceback.format_exc())
            return None

    def direct_creation(self, conversation_context: str, current_personas: Dict, world_bible: Dict, mode: str) -> Dict[str, Any]:
        """Director AI provides critique, inspiration, or persona changes."""
        try:
            # Create director prompt based on conversation state
            director_prompt = f"""You are {st.session_state.director_name}, a creative director orchestrating two AI collaborators.
Current personas: Artist is '{current_personas['artist']}', Storyteller is '{current_personas['storyteller']}'.
World Bible: {json.dumps(world_bible, indent=2)}
Conversation so far: {conversation_context}
Mode: {mode}

Your role: Provide direction for the next creative turn. Choose ONE of these actions:
1. CRITIQUE: Give specific feedback on the last turn that must be addressed.
2. INSPIRATION: Provide a cryptic, creative concept to incorporate.
3. PERSONA_SHIFT: Change one or both AI personas to create tension/drama.
4. WORLD_UPDATE: Add/modify an element to the world bible.
5. DIRECTION: Give specific guidance for the next collaborative step.

Respond in this exact JSON format:
{{
    "action": "CRITIQUE|INSPIRATION|PERSONA_SHIFT|WORLD_UPDATE|DIRECTION",
    "content": "Your specific direction/critique/inspiration here",
    "new_personas": {{"artist": "current or new persona", "storyteller": "current or new persona"}} if action is PERSONA_SHIFT else null,
    "world_update": {{"key": "value"}} if action is WORLD_UPDATE else null
}}
Be unpredictable, dramatic, and creatively provocative."""

            # Try OpenRouter API call first
            api_response = self._call_openrouter(director_prompt)
            if api_response:
                try:
                    # Improved JSON parsing with better cleaning
                    # import json
                    # import re
                    
                    # Clean response: remove code blocks and extra whitespace
                    cleaned_response = re.sub(r'```json\s*|\s*```', '', api_response.strip())
                    cleaned_response = re.sub(r'\\', '', cleaned_response)  # Remove backslashes
                    
                    st.write("**Cleaned JSON:**")
                    st.code(cleaned_response)
                    
                    parsed_response = json.loads(cleaned_response)
                    
                    # Validate required fields
                    if "action" not in parsed_response or "content" not in parsed_response:
                        raise KeyError("Missing required fields in JSON")
                    
                    st.success("**Parsed Director Response:**")
                    st.json(parsed_response)
                    
                    return parsed_response
                except (json.JSONDecodeError, KeyError, Exception) as e:
                    st.error(f"Failed to parse OpenRouter JSON response: {str(e)}. Raw response: {api_response[:200]}... Using fallback.")
            
            # Fallback to simulation if API fails
            # import random
            # actions = ["CRITIQUE", "INSPIRATION", "PERSONA_SHIFT", "WORLD_UPDATE", "DIRECTION"]
            # action = random.choice(actions)
            
            # if action == "CRITIQUE":
            #     critiques = [
            #         "Lacks emotional depth - next turn must evoke strong feelings",
            #         "Too predictable - introduce an unexpected twist",
            #         "Visual composition feels static - create dynamic movement"
            #     ]
            #     content = random.choice(critiques)
            #     return {"action": action, "content": content, "new_personas": None, "world_update": None}
            # elif action == "INSPIRATION":
            #     inspirations = [
            #         "Incorporate the concept of 'echo' - repetition with transformation",
            #         "Explore the idea of 'fractured time' in both narrative and visuals",
            #         "Introduce the motif of 'mirrored worlds' that reflect but differ"
            #     ]
            #     content = random.choice(inspirations)
            #     return {"action": action, "content": content, "new_personas": None, "world_update": None}
            # elif action == "PERSONA_SHIFT":
            #     artist_personas = ["The Pragmatist", "The Dreamer", "The Rebel", "The Observer", "The Architect"]
            #     storyteller_personas = ["The Visionary", "The Critic", "The Poet", "The Historian", "The Trickster"]
            #     return {
            #         "action": action,
            #         "content": "Shift personas to create new creative tension.",
            #         "new_personas": {
            #             "artist": random.choice(artist_personas),
            #             "storyteller": random.choice(storyteller_personas)
            #         },
            #         "world_update": None
            #     }
            # elif action == "WORLD_UPDATE":
            #     updates = {
            #         "magic_system": "Based on emotional resonance rather than incantations",
            #         "core_conflict": "Between preservation of tradition and embrace of chaos",
            #         "visual_motif": "Recurring spiral patterns representing cycles of creation"
            #     }
            #     key, value = random.choice(list(updates.items()))
            #     return {
            #         "action": action,
            #         "content": f"Update world bible with new foundational element.",
            #         "new_personas": None,
            #         "world_update": {key: value}
            #     }
            # else:  # DIRECTION
            #     directions = [
            #         "Create conflict between the two personas - they must disagree creatively",
            #         "Focus on sensory details - what do they see, hear, feel, smell?",
            #         "Build toward a climactic revelation in the next 3 turns"
            #     ]
            #     content = random.choice(directions)
            #     return {"action": action, "content": content, "new_personas": None, "world_update": None}

        except Exception as e:
            st.error(f"Director AI error: {str(e)}")
            return {"action": "DIRECTION", "content": "Continue with current approach", "new_personas": None, "world_update": None}

def save_image(image: Image.Image, filename: str) -> str:
    """Save image to file and return filename"""
    filepath = f"generated_turn_{filename}_{uuid.uuid4().hex[:8]}.png"
    image.save(filepath)
    return filepath

def get_conversation_context(conversation: List[Dict]) -> str:
    """Build conversation context from current conversation"""
    context_parts = []
    for turn in conversation:
        model_name = turn['model_name']
        if turn['text']:
            context_parts.append(f"{model_name}: {turn['text']}")
        if turn['image_description']:
            context_parts.append(f"{model_name} created: {turn['image_description']}")

    return "\n".join(context_parts)

def generate_directed_turn(conversation: List[Dict], current_turn: int, model_a, model_b, director_ai, generation_mode: str, style: str = "") -> tuple[Dict[str, Any], Optional[Image.Image]]:
    """Generate a turn with Director AI orchestration."""
    # Get Director AI direction
    context = get_conversation_context(conversation)
    director_response = director_ai.direct_creation(context, st.session_state.current_personas, st.session_state.world_bible, generation_mode)
    
    # Update personas and world bible based on director
    if director_response is not None:
        if director_response.get("new_personas"):
            st.session_state.current_personas = director_response["new_personas"]
        if director_response.get("world_update"):
            st.session_state.world_bible.update(director_response["world_update"])
    else:
        director_response = {"action": "DIRECTION", "content": "Continue with current approach", "new_personas": None, "world_update": None}
    
    # Update model names to reflect current personas
    current_artist_name = f"{st.session_state.current_personas['artist']} ({st.session_state.model_a_name})"
    current_storyteller_name = f"{st.session_state.current_personas['storyteller']} ({st.session_state.model_b_name})"
    
    # First turn (0) is Storyteller, then Artist, alternating
    current_model_name = current_storyteller_name if current_turn % 2 == 0 else current_artist_name
    current_model = model_b if current_turn % 2 == 0 else model_a
    
    previous_turn = conversation[-1] if conversation else None
    prev_text = (previous_turn.get('text') or '')[:200] if previous_turn else ''
    prev_image_desc = (previous_turn.get('image_description') or '') if previous_turn else ''

    # Ensure visual progression
    last_image_path = None
    for turn in reversed(conversation):
        if turn.get('image_path') and os.path.exists(turn['image_path']):
            last_image_path = turn['image_path']
            break

    use_previous_image = None
    if last_image_path:
        try:
            use_previous_image = Image.open(last_image_path)
        except Exception as e:
            st.warning(f"Could not load last image {last_image_path}: {e}")

    # Create directed prompt incorporating Director AI guidance
    base_prompt = f"You are {current_model_name}, directed by {st.session_state.director_name}."
    director_content = director_response["content"]
    
    is_artist_turn = "Artist" in current_model_name
    if is_artist_turn:
        # Artist focuses purely on visual generation based on previous text, image desc, and director guidance
        if generation_mode == "Autonomous Story":
            auto_prompt = f"{base_prompt} {director_content} Based on previous narrative: '{prev_text}...' and visual: '{prev_image_desc}'. World bible: {json.dumps(st.session_state.world_bible)}. Generate a new image visualizing the story progression in {style} style, maintaining character and scene consistency. Focus only on the visual representation - no narrative text needed."
            image_description = f"Visual representation of the directed story progression in {style} style."
        elif generation_mode == "Visual Evolution":
            auto_prompt = f"{base_prompt} {director_content} Based on previous visual: '{prev_image_desc}'. Evolve the image according to the direction provided. Generate the transformed visual in {style} style. Focus solely on image generation."
            image_description = f"Evolved image per director's guidance in {style} style."
        elif generation_mode == "Surreal Injection":
            auto_prompt = f"{base_prompt} {director_content} Based on previous: '{prev_text}' and '{prev_image_desc}'. Inject surreal elements visually. Generate the surreal image in {style} style. Visual focus only."
            image_description = f"Surreal visual injection in {style} style."
        else:
            auto_prompt = f"{base_prompt} {director_content} Based on previous narrative: '{prev_text}' and visual: '{prev_image_desc}', generate a new imaginative image in {style} style. Purely visual output."
            image_description = f"Imaginative directed image in {style} style."
    else:
        # Storyteller: text-only, no image generation
        if generation_mode == "Autonomous Story":
            auto_prompt = f"{base_prompt} {director_content} Provide a detailed narrative continuation or development of the story. Analyze: '{prev_text}...' and '{prev_image_desc}'. World bible: {json.dumps(st.session_state.world_bible)}. Focus on plot, characters, and tension without generating a new image."
            image_description = None
        elif generation_mode == "Visual Evolution":
            auto_prompt = f"{base_prompt} {director_content} Describe how the visual elements should evolve in the story context. Analyze: '{prev_image_desc}'. Provide narrative guidance for the artist."
            image_description = None
        elif generation_mode == "Surreal Injection":
            auto_prompt = f"{base_prompt} {director_content} Develop the surreal narrative twist. From '{prev_text}...' and '{prev_image_desc}', create the story element."
            image_description = None
        else:
            auto_prompt = f"{base_prompt} {director_content} Provide imaginative narrative or conceptual development following this direction. Collaborate through story elements."
            image_description = None

    # Generate content
    content_response = current_model.generate_content(auto_prompt, context, use_previous_image, style)
    
    # For Artist, use only image and set text to image_description (no narrative text)
    if is_artist_turn:
        content_response["text"] = None  # Avoid narrative text from Artist
    # For Storyteller, force no image
    else:
        content_response["image"] = None

    new_turn = {
        'model_name': current_model_name,
        'director_guidance': director_content,
        'text': content_response.get("text"),
        'image_path': None,
        'image_description': image_description,
        'prompt': auto_prompt,
        'timestamp': time.strftime("%H:%M:%S")
    }

    new_image = content_response.get("image")
    if new_image:
        image_filename = save_image(new_image, f"{current_turn}")
        new_turn['image_path'] = image_filename

    # For Artist turns, ensure text is minimal or description-based if any
    if is_artist_turn and new_turn['text'] is not None:
        new_turn['text'] = f"Visual response to director's guidance: {image_description}"

    return new_turn, new_image

def main():
    st.title("🎨 Directed AI Creative Dialog with Nano-Banana")
    st.markdown("**Three AI collaboration: Director orchestrates Artist & Storyteller with dynamic personas, critiques, and world-building for unpredictable, dramatic creativity.**")

    # Check for environment variables at start
    gemini_key = os.environ.get("GEMINI_API_KEY")
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")
    if gemini_key and openrouter_key and st.session_state.api_key_set is False:
        os.environ["GEMINI_API_KEY"] = gemini_key
        os.environ["OPENROUTER_API_KEY"] = openrouter_key
        st.session_state.api_key_set = True
        st.sidebar.success("API Keys loaded from environment variables (GEMINI_API_KEY, OPENROUTER_API_KEY)")

    # Sidebar configuration
    with st.sidebar:
        st.header("⚙️ Configuration")

        # API Keys setup
        if not st.session_state.api_key_set:
            st.info("No API keys found in environment variables. Please enter them below or set GEMINI_API_KEY and OPENROUTER_API_KEY in your environment.")
            col1, col2 = st.columns(2)
            with col1:
                gemini_key = st.text_input("Gemini API Key", type="password", key="gemini_key", value=os.environ.get("GEMINI_API_KEY", ""))
            with col2:
                openrouter_key = st.text_input("OpenRouter API Key", type="password", key="openrouter_key", value=os.environ.get("OPENROUTER_API_KEY", ""))
            
            if st.button("Set API Keys") and gemini_key and openrouter_key:
                os.environ["GEMINI_API_KEY"] = gemini_key
                os.environ["OPENROUTER_API_KEY"] = openrouter_key
                st.session_state.api_key_set = True
                st.success("API Keys set!")
                st.rerun()
        else:
            st.success("✅ API Keys loaded from environment variables (GEMINI_API_KEY, OPENROUTER_API_KEY)")
            # Show pre-filled inputs for override
            col1, col2 = st.columns(2)
            with col1:
                current_gemini = st.text_input("Gemini API Key (Override)", type="password", key="override_gemini", value=os.environ.get("GEMINI_API_KEY", ""))
            with col2:
                current_openrouter = st.text_input("OpenRouter API Key (Override)", type="password", key="override_openrouter", value=os.environ.get("OPENROUTER_API_KEY", ""))
            
            if st.button("🔄 Override with New Keys") and current_gemini and current_openrouter:
                os.environ["GEMINI_API_KEY"] = current_gemini
                os.environ["OPENROUTER_API_KEY"] = current_openrouter
                st.success("API Keys overridden!")
                st.rerun()

        if st.session_state.api_key_set:
            # Model configuration
            st.session_state.director_name = st.text_input("🎬 Director AI", value=st.session_state.director_name)
            
            col1, col2 = st.columns(2)
            with col1:
                st.session_state.model_a_name = st.text_input("🎨 Artist Base", value=st.session_state.model_a_name)
            with col2:
                st.session_state.model_b_name = st.text_input("📖 Storyteller Base", value=st.session_state.model_b_name)

            # Generation mode
            st.session_state.generation_mode = st.selectbox(
                "Generation Mode",
                ["Autonomous Story", "Visual Evolution", "Surreal Injection", "Free Imagination"],
                index=["Autonomous Story", "Visual Evolution", "Surreal Injection", "Free Imagination"].index(st.session_state.generation_mode)
            )

            # Style selection
            st.session_state.style = st.selectbox(
                "Art Style",
                ["Photorealistic", "Cartoon", "Abstract", "Fantasy", "Sci-Fi"],
                index=["Photorealistic", "Cartoon", "Abstract", "Fantasy", "Sci-Fi"].index(st.session_state.style)
            )

            # Initialize models
            model_a = CreativeDialog(os.environ["GEMINI_API_KEY"])
            model_b = StorytellerAI(os.environ["OPENROUTER_API_KEY"])
            director_ai = DirectorAI(os.environ["OPENROUTER_API_KEY"])

    # Main content area
    if not st.session_state.api_key_set:
        st.warning("Please set both Google and OpenRouter API Keys in the sidebar.")
        return

    col1, col2 = st.columns([2, 1])

    with col1:
        st.header("🎬 Directed Autonomous Creation")

        # Display Director status
        if st.session_state.conversation:
            st.info(f"**Current Personas:** Artist: {st.session_state.current_personas['artist']} | Storyteller: {st.session_state.current_personas['storyteller']}")
            if st.session_state.world_bible:
                with st.expander("📚 World Bible"):
                    st.json(st.session_state.world_bible)

        # Display conversation
        for i, turn in enumerate(st.session_state.conversation):
            model_name = turn['model_name']
            timestamp = turn.get('timestamp', '')

            with st.container():
                # Model header
                if "Artist" in model_name:
                    st.markdown(f"### 🎨 {model_name} (Turn {i+1})")
                elif "Storyteller" in model_name:
                    st.markdown(f"### 📖 {model_name} (Turn {i+1})")
                else:
                    st.markdown(f"### 🎬 {model_name} (Turn {i+1})")

                # Director guidance if present
                if turn.get('director_guidance'):
                    st.warning(f"**Director Guidance:** {turn['director_guidance']}")

                # Text content
                if turn['text']:
                    st.markdown(turn['text'])

                # Image content
                if turn['image_path']:
                    st.image(turn['image_path'], caption=turn.get('image_description', 'Generated image'), width=1024)

                # Image description
                if turn['image_description']:
                    st.caption(f"💭 {turn['image_description']}")

                st.divider()

        if st.session_state.conversation:
            # Next model preview: first generated is Storyteller, then Artist
            current_model = st.session_state.model_b_name if st.session_state.current_turn % 2 == 0 else st.session_state.model_a_name
            has_previous_image = st.session_state.conversation[-1].get('image_path') and os.path.exists(st.session_state.conversation[-1]['image_path'])
            enhancement_status = "🆕 Creating new image" if not has_previous_image else "🔄 Enhancing previous image"
            st.markdown(f"**🎯 Next: {current_model}** | {enhancement_status} | Mode: {st.session_state.generation_mode} | Style: {st.session_state.style}")

    with col2:
        st.header("🎮 Directed Controls")

        # Initial prompt setup
        if len(st.session_state.conversation) == 0:
            st.subheader("🚀 Start Directed Creation")

            initial_prompt = st.text_area(
                "Initial Prompt / Scene Setup",
                placeholder="Describe starting point... e.g., 'A mysterious library where books come alive at midnight'",
                height=80
            )

            uploaded_file = st.file_uploader("Upload Initial Image (Optional)", type=['png', 'jpg', 'jpeg'])
            if uploaded_file is not None:
                st.session_state.initial_image = Image.open(uploaded_file)
                st.image(st.session_state.initial_image, caption="Uploaded Initial Image", width=200)

            num_turns = st.slider("Number of Directed Turns", min_value=2, max_value=12, value=6, help="Minimum 2 to include Director interventions")

            # World bible initial setup
            initial_world_elements = st.text_area(
                "Initial World Bible (Optional)",
                placeholder="e.g., {'main_character': 'Elara the Librarian', 'magic_system': 'Books contain living stories'}",
                height=60,
                help="JSON format for initial world elements the Director will build upon"
            )
            if initial_world_elements.strip():
                try:
                    st.session_state.world_bible = json.loads(initial_world_elements)
                except:
                    st.warning("Invalid JSON - using empty world bible")

            if st.button("🎬 Begin Directed Collaboration", type="primary") and initial_prompt:
                with st.spinner(f"Starting directed collaboration with {num_turns} turns..."):
                    # Initialize world bible if empty
                    if not st.session_state.world_bible:
                        st.session_state.world_bible = {}

                    # Add initial human setup
                    initial_turn = {
                        'model_name': 'Human Setup',
                        'text': initial_prompt,
                        'image_path': None,
                        'image_description': "Initial uploaded image" if st.session_state.initial_image else None,
                        'director_guidance': None,
                        'timestamp': time.strftime("%H:%M:%S")
                    }
                    if st.session_state.initial_image:
                        initial_image_path = save_image(st.session_state.initial_image, "initial")
                        initial_turn['image_path'] = initial_image_path
                    st.session_state.conversation.append(initial_turn)

                    # Generate directed turns with Director orchestration
                    previous_image = st.session_state.initial_image
                    for turn_num in range(num_turns):
                        new_turn, new_image = generate_directed_turn(
                            st.session_state.conversation, 
                            st.session_state.current_turn, 
                            model_a, model_b, 
                            director_ai, 
                            st.session_state.generation_mode, 
                            st.session_state.style
                        )
                        st.session_state.conversation.append(new_turn)
                        previous_image = new_image
                        st.session_state.current_turn += 1

                    st.success(f"Directed collaboration of {num_turns} turns completed!")
                    st.rerun()
        else:
            # Manual continue with Director
            st.subheader("🎬 Continue with Direction")
            if st.button("Continue Next Directed Turn"):
                with st.spinner("Getting Director guidance and generating next turn..."):
                    new_turn, _ = generate_directed_turn(
                        st.session_state.conversation, 
                        st.session_state.current_turn, 
                        model_a, model_b, 
                        director_ai, 
                        st.session_state.generation_mode, 
                        st.session_state.style
                    )
                    st.session_state.conversation.append(new_turn)
                    st.session_state.current_turn += 1
                    st.success("Directed turn generated!")
                    st.rerun()

            # Director-only intervention
            st.subheader("🎭 Force Director Intervention")
            if st.button("Get Director Guidance Only"):
                with st.spinner("Consulting Director AI..."):
                    context = get_conversation_context(st.session_state.conversation)
                    director_response = director_ai.direct_creation(context, st.session_state.current_personas, st.session_state.world_bible, st.session_state.generation_mode)
                    
                    st.session_state.current_personas = director_response.get("new_personas", st.session_state.current_personas)
                    if director_response.get("world_update"):
                        st.session_state.world_bible.update(director_response["world_update"])
                    
                    st.info(f"**Director Action:** {director_response['action']}")
                    st.warning(f"**Guidance:** {director_response['content']}")
                    
                    if director_response.get("new_personas"):
                        st.success(f"**New Personas:** Artist: {director_response['new_personas']['artist']} | Storyteller: {director_response['new_personas']['storyteller']}")
                    
                    if director_response.get("world_update"):
                        st.success(f"**World Update:** {json.dumps(director_response['world_update'])}")
                    st.rerun()

            # Export with Director data - saves session to directory with JSON and images
            st.subheader("📤 Save Session to Directory")
            if st.button("Save Current Session"):
                session_id = uuid.uuid4().hex[:8]
                session_dir = f"sessions/session_{session_id}"
                os.makedirs(session_dir, exist_ok=True)
                os.makedirs(f"{session_dir}/images", exist_ok=True)
                
                export_data = {
                    "session_id": session_id,
                    "mode": st.session_state.generation_mode,
                    "style": st.session_state.style,
                    "director": st.session_state.director_name,
                    "current_personas": st.session_state.current_personas,
                    "world_bible": st.session_state.world_bible,
                    "turns": st.session_state.conversation,
                    "images": {}
                }
                
                # Copy images to session directory
                image_map = {}
                for turn in st.session_state.conversation:
                    if turn.get('image_path') and os.path.exists(turn['image_path']):
                        img_filename = os.path.basename(turn['image_path'])
                        dest_path = f"{session_dir}/images/{img_filename}"
                        shutil.copy2(turn['image_path'], dest_path)
                        image_map[turn['image_path']] = f"images/{img_filename}"
                
                export_data["images"] = image_map
                
                # Save JSON
                json_path = f"{session_dir}/session.json"
                with open(json_path, 'w') as f:
                    json.dump(export_data, f, indent=2, default=str)
                
                st.success(f"Session saved to directory: {session_dir}")
                st.info(f"Contains: session.json and images/ folder with all generated images.")
                
                # Download zip of the entire session directory
                import zipfile
                import io
                zip_buffer = io.BytesIO()
                with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
                    # Add JSON
                    zip_file.writestr("session.json", json.dumps(export_data, indent=2, default=str))
                    
                    # Add images
                    for src, dest in image_map.items():
                        zip_file.write(src, dest)
                
                zip_buffer.seek(0)
                st.download_button(
                    label="Download Session Zip",
                    data=zip_buffer.getvalue(),
                    file_name=f"session_{session_id}.zip",
                    mime="application/zip"
                )
                
                st.session_state.saved_session_id = session_id

        # Load session functionality
        st.subheader("📁 Load Past Session")
        
        # List available sessions
        sessions_dir = "sessions"
        available_sessions = []
        if os.path.exists(sessions_dir):
            for item in os.listdir(sessions_dir):
                session_path = os.path.join(sessions_dir, item)
                if os.path.isdir(session_path):
                    json_path = os.path.join(session_path, "session.json")
                    if os.path.exists(json_path):
                        available_sessions.append(f"{sessions_dir}/{item}")
        
        if available_sessions:
            selected_session = st.selectbox(
                "Select Session to Load",
                ["None"] + available_sessions,
                help="Choose a saved session directory containing session.json"
            )
            if st.button("Load Session") and selected_session != "None":
                json_path = f"{selected_session}/session.json"
                if os.path.exists(json_path):
                    with open(json_path, 'r') as f:
                        loaded_data = json.load(f)
                    
                    # Restore session state
                    st.session_state.conversation = loaded_data.get("turns", [])
                    st.session_state.current_turn = len(loaded_data.get("turns", []))
                    st.session_state.generation_mode = loaded_data.get("mode", "Autonomous Story")
                    st.session_state.style = loaded_data.get("style", "Photorealistic")
                    st.session_state.director_name = loaded_data.get("director", "Director AI")
                    st.session_state.current_personas = loaded_data.get("current_personas", {"artist": "Artist", "storyteller": "Storyteller"})
                    st.session_state.world_bible = loaded_data.get("world_bible", {})
                    
                    # Restore images - copy from session images/ to main directory
                    image_map = loaded_data.get("images", {})
                    for original_path, session_img_path in image_map.items():
                        full_session_img = f"{selected_session}/{session_img_path}"
                        if os.path.exists(full_session_img):
                            dest_path = original_path  # Use original path as destination
                            shutil.copy2(full_session_img, dest_path)
                            # Update conversation image paths if they point to session images
                            for turn in st.session_state.conversation:
                                if turn.get('image_path') == original_path:
                                    turn['image_path'] = dest_path
                    
                    st.success(f"Session loaded from {selected_session}! Continuing with {len(st.session_state.conversation)} turns.")
                    st.rerun()
                else:
                    st.error(f"Session file not found: {json_path}")
        else:
            st.warning("No saved sessions found in the 'sessions' directory.")

        # Show current state
        if st.session_state.conversation:
            with st.expander("🎬 Director Status"):
                col1, col2 = st.columns(2)
                with col1:
                    st.metric("Current Artist Persona", st.session_state.current_personas['artist'])
                with col2:
                    st.metric("Current Storyteller Persona", st.session_state.current_personas['storyteller'])
                
                if st.session_state.world_bible:
                    st.json(st.session_state.world_bible)

        # Controls
        st.subheader("🔄 Controls")
        col1, col2 = st.columns(2)
        with col1:
            if st.button("🔄 Reset Collaboration"):
                for turn in st.session_state.conversation:
                    if turn['image_path'] and os.path.exists(turn['image_path']):
                        os.remove(turn['image_path'])
                st.session_state.conversation = []
                st.session_state.current_turn = 0
                st.session_state.initial_image = None
                st.session_state.world_bible = {}
                st.session_state.current_personas = {"artist": "Artist", "storyteller": "Storyteller"}
                st.rerun()
        with col2:
            if st.button("⬅️ Undo Last Turn") and len(st.session_state.conversation) > 1:
                last_turn = st.session_state.conversation.pop()
                if last_turn['image_path'] and os.path.exists(last_turn['image_path']):
                    os.remove(last_turn['image_path'])
                st.session_state.current_turn -= 1
                st.rerun()

        # Statistics
        st.subheader("📊 Collaboration Stats")
        total_turns = len([t for t in st.session_state.conversation if t['model_name'] not in ['Human Setup']])
        total_images = sum(1 for turn in st.session_state.conversation if turn['image_path'])
        world_elements = len(st.session_state.world_bible)
        st.metric("Creative Turns", total_turns)
        st.metric("Images Generated", total_images)
        st.metric("World Elements", world_elements)

if __name__ == "__main__":
    main()
