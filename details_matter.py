import streamlit as st
import os
import google.genai as genai
from google.genai import types
from PIL import Image
import uuid
import time
from datetime import datetime
from typing import List, Dict, Any, Optional
import base64
import io
import json
import re
import shutil  # For copying images to session directory

# Configure page
st.set_page_config(
    page_title="Single AI Image Evolution",
    page_icon="🎨",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state
if 'conversation' not in st.session_state:
    st.session_state.conversation = []
if 'current_turn' not in st.session_state:
    st.session_state.current_turn = 0
if 'api_key_set' not in st.session_state:
    st.session_state.api_key_set = False  # maintained for UI logic but no env writes
if 'gemini_api_key' not in st.session_state:
    st.session_state.gemini_api_key = None
if 'style' not in st.session_state:
    st.session_state.style = "Photorealistic"
if 'initial_image' not in st.session_state:
    st.session_state.initial_image = None

MODEL_ID = "gemini-2.5-flash-image-preview"

# Name used for AI-generated turns in the conversation UI; changeable role name
MODEL_ROLE_NAME = "Chief of Details"

# Prompt templates for easy modification
FIRST_TURN_PROMPT_TEMPLATE = "Generate an image based on this prompt: '{initial_prompt}'. Provide a description of the image."
EVOLVE_PROMPT_TEMPLATE = (
    "Based on the previous image, select one important detail for you independently of the rest of the image (e.g., a specific object, character, or element). "
    "Describe your choice in text and then imagine a new story in which that detail is preserved as a detail of the story, not necessarily the main subject of the image. "
    "Then, generate a new image from your story keeping only this detail recognizable."
)
ENHANCE_PROMPT_TEMPLATE = (
    # "Enhance and continue the existing image according to the new prompt while maintaining character consistency, style, and scene elements. "
    "Build upon the visual composition intelligently."
)
CONTEXT_PREFIX_TEMPLATE = "{context}\n\n{prompt}"
STYLE_SUFFIX_TEMPLATE = "\nStyle: {style}."

class CreativeDialog:
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)

    def generate_content(self, prompt: str, context: str = "", previous_image: Optional[Image.Image] = None, style: str = "") -> Dict[str, Any]:
        """Generate combined content (text + image) using nano-banana model, improving on previous image if provided."""
        full_prompt = CONTEXT_PREFIX_TEMPLATE.format(context=context, prompt=prompt) if context else prompt
        if style:
            full_prompt += STYLE_SUFFIX_TEMPLATE.format(style=style)

        try:
            if previous_image:
                enhanced_prompt = ENHANCE_PROMPT_TEMPLATE + " " + full_prompt
                contents = [enhanced_prompt, previous_image]
            else:
                contents = [full_prompt]

            st.write("**Model Prompt (truncated):**")
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
            # Protect against response or missing parts and return structured error info
            if response is None:
                msg = "Model returned no response (None)"
                st.warning(msg)
                return {"error": {"message": msg, "response": None}}

            parts = getattr(response, 'parts', None)
            if parts is None:
                msg = "Model response has no 'parts' attribute or it is None"
                st.warning(msg)
                try:
                    resp_str = str(response)
                except Exception:
                    resp_str = "<unserializable response>"
                return {"error": {"message": msg, "response": resp_str}}

            st.write(f"Response parts: {len(parts)}")

            out_text: Optional[str] = None
            out_image: Optional[Image.Image] = None

            for i, part in enumerate(parts):
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
            st.write(f"**Parts processed: {len(response.parts)}, image found: {out_image is not None}**")

            # If no image was found but text description exists, attempt a second generation
            # requesting only an image using the descriptive text as the prompt. This helps
            # when the model returns only a text description in the first pass.
            if out_image is None and out_text:
                try:
                    st.info("No image in initial response — attempting image-only generation using the returned description...")
                    # Avoid passing the previous_image in this fallback to let the model synthesize
                    # a fresh image purely from the descriptive text.
                    fallback_prompt = out_text if isinstance(out_text, str) else str(out_text)
                    # Call generate_content again but request only Image modality
                    fallback_response = self.client.models.generate_content(
                        model=MODEL_ID,
                        contents=[fallback_prompt],
                        config=types.GenerateContentConfig(
                            response_modalities=['Image']
                        )
                    )

                    if fallback_response is None:
                        st.write("Fallback response was None")
                    else:
                        fb_parts = getattr(fallback_response, 'parts', None)
                        if fb_parts:
                            for p in fb_parts:
                                try:
                                    if hasattr(p, 'as_image'):
                                        img = p.as_image()
                                        if img:
                                            out_image = img
                                            st.write("**Fallback image generation succeeded via part.as_image()**")
                                            break
                                except Exception as fb_e:
                                    st.write(f"Fallback image extraction error: {fb_e}")

                                # Try raw bytes/base64 attributes as before
                                for attr in ('image', 'image_bytes', 'binary', 'data'):
                                    if hasattr(p, attr):
                                        try:
                                            val = getattr(p, attr)
                                            if isinstance(val, (bytes, bytearray)):
                                                img = Image.open(io.BytesIO(val))
                                                out_image = img
                                                st.write(f"**Fallback: Image extracted from attribute '{attr}' (bytes)**")
                                                break
                                            if isinstance(val, str):
                                                try:
                                                    decoded = base64.b64decode(val)
                                                    img = Image.open(io.BytesIO(decoded))
                                                    out_image = img
                                                    st.write(f"**Fallback: Image extracted from attribute '{attr}' (base64 string)**")
                                                    break
                                                except Exception:
                                                    pass
                                        except Exception as ex_attr_fb:
                                            st.write(f"Could not extract fallback image from attribute '{attr}': {ex_attr_fb}")
                                if out_image:
                                    break

                except Exception as fb_exception:
                    st.write(f"Fallback image generation failed: {fb_exception}")

            return {"text": out_text, "image": out_image}
        except Exception as e:
            st.error(f"Error generating content: {str(e)}")
            st.error(f"Exception type: {type(e)}")
            st.write("**Full traceback:**")
            import traceback
            st.code(traceback.format_exc())
            return {"text": None, "image": None}

def save_image(image: Image.Image, filename: str) -> str:
    """Save image to file and return filename"""
    filepath = f"generated_turn_{filename}_{uuid.uuid4().hex[:8]}.png"
    image.save(filepath)
    return filepath

def generate_next_turn(conversation: List[Dict], current_turn: int, model, style: str = "", initial_prompt: str = "", initial_image: Optional[Image.Image] = None) -> tuple[Dict[str, Any], Optional[Image.Image]]:
    """Generate the next turn: select a detail from the previous image and generate a new image with that detail keeping only this detail consistent."""
    
    if current_turn == 0 or (current_turn == 1 and initial_prompt):
        # First generation: based on initial prompt
        auto_prompt = FIRST_TURN_PROMPT_TEMPLATE.format(initial_prompt=initial_prompt)
        previous_image = initial_image
    elif current_turn == 1 and not initial_prompt:
        # Regenerating first turn after undo, use human's input
        human_turn = conversation[0] if conversation else None
        if human_turn:
            regen_prompt = human_turn.get('text', '')
            regen_image = None
            if human_turn.get('image_path') and os.path.exists(human_turn['image_path']):
                try:
                    regen_image = Image.open(human_turn['image_path'])
                except:
                    pass
            auto_prompt = FIRST_TURN_PROMPT_TEMPLATE.format(initial_prompt=regen_prompt)
            previous_image = regen_image
        else:
            st.error("No human input found to regenerate.")
            return None, None
    else:
        # Subsequent turns: evolve from previous image
        previous_turn = conversation[-1] if conversation else None
        # If the immediate previous turn has no image, try to locate the nearest available prior image
        if not previous_turn or not previous_turn.get('image_path'):
            # search backwards for the last available image in conversation
            last_index_with_image = None
            for j in range(len(conversation) - 1, -1, -1):
                p = conversation[j].get('image_path')
                if p and os.path.exists(p):
                    last_index_with_image = j
                    break

            # If we found an available prior image, load it and proceed
            if last_index_with_image is not None:
                image_path = conversation[last_index_with_image]['image_path']
                st.write(f"Loading fallback image from turn {last_index_with_image}: {image_path}")
                try:
                    previous_image = Image.open(image_path)
                except Exception as e:
                    st.error(f"Could not load previous image: {e}")
                    # create a failed turn so the UI can surface a regenerate action
                    failed_turn = {
                        'model_name': MODEL_ROLE_NAME,
                        'text': None,
                        'image_path': None,
                        'image_description': None,
                        'prompt': EVOLVE_PROMPT_TEMPLATE,
                        'timestamp': time.strftime("%H:%M:%S"),
                        'image_missing': True,
                        'failed_reason': 'could_not_load_fallback',
                        'fallback_from': last_index_with_image,
                        'style': style,
                    }
                    return failed_turn, None
            else:
                # No prior image at all - if an initial_image was provided, use it
                if initial_image is not None:
                    previous_image = initial_image
                else:
                    # Return a failed turn object so the thread records failure and stores where to fallback (None)
                    failed_turn = {
                        'model_name': MODEL_ROLE_NAME,
                        'text': None,
                        'image_path': None,
                        'image_description': None,
                        'prompt': EVOLVE_PROMPT_TEMPLATE,
                        'timestamp': time.strftime("%H:%M:%S"),
                        'image_missing': True,
                        'failed_reason': 'no_previous_image',
                        'fallback_from': None,
                        'style': style,
                    }
                    return failed_turn, None
        else:
            # Load previous image normally
            image_path = previous_turn['image_path']
            if not os.path.exists(image_path):
                st.error(f"Image file does not exist: {image_path}")
                return None, None
            st.write(f"Loading image: {image_path}")
            try:
                previous_image = Image.open(image_path)
            except Exception as e:
                st.error(f"Could not load previous image: {e}")
                return None, None

        # Craft prompt for evolution
        auto_prompt = EVOLVE_PROMPT_TEMPLATE

    # Generate content
    content_response = model.generate_content(auto_prompt, "", previous_image, style)

    # If the model returned a structured error, create an error turn to surface in the UI
    if isinstance(content_response, dict) and content_response.get("error"):
        err = content_response.get("error")
        new_turn = {
            'model_name': MODEL_ROLE_NAME,
            'text': f"[Error] {err.get('message', 'Model error')}",
            'image_path': None,
            'image_description': None,
            'prompt': auto_prompt,
            'timestamp': time.strftime("%H:%M:%S"),
            'image_missing': True,
            'failed_reason': 'model_response_error',
            'error_info': err,
            'style': style,
        }
        return new_turn, None

    new_turn = {
        'model_name': MODEL_ROLE_NAME,
        'text': content_response.get("text"),
        'image_path': None,
        'image_description': content_response.get("text"),  # Use text as description
        'prompt': auto_prompt,
        'timestamp': time.strftime("%H:%M:%S"),
        'style': style,
    }

    new_image = content_response.get("image")
    if new_image:
        image_filename = save_image(new_image, f"{current_turn}")
        new_turn['image_path'] = image_filename
        new_turn['image_missing'] = False

    else:
        # Mark that no image was produced for this turn so the UI can surface a regenerate action
        new_turn['image_missing'] = True
    return new_turn, new_image

def main():
    st.title("🎨 Matter of Details")
    st.markdown("**Iteratively test how a generative model latches onto a single visual detail and reimagines it inside entirely new scenes.**")
    st.markdown(
        "Each turn: the model picks one salient detail from the previous image (a shape, object, texture, motif) and invents a different context that preserves only that detail's recognizable identity. "
        "By chaining these transformations you can observe what the model treats as the 'essence' of a thing—how far the surrounding world can drift while that tiny anchor persists."
    )

    # Removed automatic environment variable loading to prevent leaking key across users.
    # Key now only resides in per-user session_state.gemini_api_key.

    # Main content area
    # Show a short how-to when there is no conversation yet
    if not st.session_state.conversation:
        with st.expander("How to start (quick)", expanded=True):
            st.markdown("1. Set or paste a Gemini API key in the left sidebar (use a throwaway or scoped key for demos).\n\n2. Enter an initial prompt in the 'Initial Prompt / Scene Setup' box.\n\n3. (Optional) Upload an initial image to seed the evolution.\n\n4. Click '🎬 Begin Single-Model Evolution' to generate the first AI turn.\n\n5. Use 'Continue Next Turn' or per-turn Regenerate buttons to explore how the model preserves a single detail across contexts.")

    # If API key not set, show a warning but continue rendering the sidebar so the user
    # can enter or override the GEMINI_API_KEY there. Previously this returned early
    # and prevented the sidebar from being displayed.
    if not st.session_state.api_key_set:
        st.warning("Please set the Google Gemini API Key in the left panel.")

        # Create sidebar for configuration and controls
    with st.sidebar:
        st.header("⚙️ Configuration")

        # API Key setup
        if not st.session_state.api_key_set:
            st.info("Enter your Gemini API key below. It is stored only in your local session_state (never written to environment or disk, not shared with other users).")
            st.warning("Security: Use a throwaway/dev key here. This demo keeps it only in memory for your session, but if this app is deployed on a shared server, operators could still modify code to log it. Never use a production or billing-critical key.")
            input_key = st.text_input("Gemini API Key", type="password", key="gemini_key", value="")

            if st.button("Set API Key"):
                if input_key.strip():
                    st.session_state.gemini_api_key = input_key.strip()
                    st.session_state.api_key_set = True
                    st.success("API Key stored in session only.")
                    st.rerun()
                else:
                    st.warning("Please provide a non-empty key.")
        else:
            # Provide override without revealing existing key
            new_key = st.text_input("Override Gemini API Key", type="password", key="override_gemini", value="")
            st.warning("Overriding replaces the in-memory key. Same constraints: do not paste a sensitive production key.")
            if st.button("🔄 Override with New Key"):
                if new_key.strip():
                    st.session_state.gemini_api_key = new_key.strip()
                    st.success("API Key overridden in session.")
                    st.rerun()
                else:
                    st.info("No override provided; existing session key kept.")

            st.caption("Key never leaves this session process memory and is not exposed in environment variables.")

        if st.session_state.api_key_set:
            # Initialize model from session-held key only
            model = CreativeDialog(st.session_state.gemini_api_key)

            # Continue button if conversation exists
            if len(st.session_state.conversation) > 0:
                # Emphasize continuation visually
                st.header("🎬 Continue Evolution")
                if st.button("Continue Next Turn"):
                    with st.spinner("Evolving image..."):
                        new_turn, _ = generate_next_turn(
                            st.session_state.conversation, 
                            st.session_state.current_turn, 
                            model, 
                            st.session_state.style,
                            "",  # no initial_prompt
                            st.session_state.initial_image
                        )
                        if new_turn:
                            st.session_state.conversation.append(new_turn)
                            st.session_state.current_turn += 1
                            st.success(f"Turn {st.session_state.current_turn} generated!")
                            st.rerun()

            # Style selection
            st.markdown("### Art Style")
            st.session_state.style = st.selectbox(
                "Art Style",
                ["Photorealistic", "Cartoon", "Abstract", "Fantasy", "Sci-Fi", "Surreal", "Anime", "Watercolor", "Oil Painting", "Digital Art", "Minimalist", "Vintage", "Cyberpunk", "Steampunk", "Impressionist", "Gothic", "Noir", "Pop Art", "Cubist", "Art Nouveau"],
                index=["Photorealistic", "Cartoon", "Abstract", "Fantasy", "Sci-Fi", "Surreal", "Anime", "Watercolor", "Oil Painting", "Digital Art", "Minimalist", "Vintage", "Cyberpunk", "Steampunk", "Impressionist", "Gothic", "Noir", "Pop Art", "Cubist", "Art Nouveau"].index(st.session_state.style) if st.session_state.style in ["Photorealistic", "Cartoon", "Abstract", "Fantasy", "Sci-Fi", "Surreal", "Anime", "Watercolor", "Oil Painting", "Digital Art", "Minimalist", "Vintage", "Cyberpunk", "Steampunk", "Impressionist", "Gothic", "Noir", "Pop Art", "Cubist", "Art Nouveau"] else 0,
                key="style_select_sidebar",
            )

            # --- Start Evolution (moved here) ---
            if len(st.session_state.conversation) == 0:
                st.subheader("🚀 Start Evolution")

                # Use session state key so the button reads the latest value on first click
                st.text_area(
                    "Initial Prompt / Scene Setup",
                    placeholder="Describe starting point... e.g., 'A mysterious forest with glowing trees'",
                    height=80,
                    key="initial_prompt_input"
                )

                uploaded_file = st.file_uploader("Upload Initial Image (Optional)", type=['png', 'jpg', 'jpeg'])
                if uploaded_file is not None:
                    st.session_state.initial_image = Image.open(uploaded_file)
                    st.image(st.session_state.initial_image, caption="Uploaded Initial Image", width=200)

                # Trigger generation on button click; read the latest prompt from session_state inside the handler
                if st.button("🎬 Begin Single-Model Evolution", type="primary"):
                    initial_prompt = st.session_state.get("initial_prompt_input", "").strip()
                    if not initial_prompt:
                        st.warning("Please enter an initial prompt before starting.")
                    else:
                        with st.spinner("Generating first image..."):
                            # Add human input as turn 0
                            initial_turn = {
                                'model_name': 'Human Input',
                                'text': initial_prompt,
                                'image_path': None,
                                'image_description': "Initial uploaded image" if st.session_state.initial_image else None,
                                'prompt': None,
                                'timestamp': time.strftime("%H:%M:%S")
                            }
                            if st.session_state.initial_image:
                                initial_image_path = save_image(st.session_state.initial_image, "initial")
                                initial_turn['image_path'] = initial_image_path
                            st.session_state.conversation.append(initial_turn)

                            # Generate AI turn 1
                            new_turn, _ = generate_next_turn(
                                st.session_state.conversation, 
                                1,  # current_turn = 1
                                model, 
                                st.session_state.style,
                                initial_prompt,
                                st.session_state.initial_image
                            )
                            if new_turn:
                                st.session_state.conversation.append(new_turn)
                                st.session_state.current_turn = 2
                                st.success("First image generated!")
                                st.rerun()
            # --- End moved Start Evolution ---

            # Controls
            # add space before the controls to separate from configuration
            st.markdown("<br><br>", unsafe_allow_html=True)
            st.header("🎮 Controls")

            # Export session
            st.subheader("📤 Save Session to Directory")
            st.info("Note: Saved sessions are stored in the app's `sessions/` directory and are accessible to anyone using this app instance while it is running. If the host restarts or the workspace is cleaned, those sessions may be removed — download the ZIP to retain a local copy.")
            if st.button("Save Current Session"):
                timestamp = datetime.now().strftime("%Y%m%d_%H%M")
                session_id = f"{timestamp}_{uuid.uuid4().hex[:8]}"
                session_dir = f"sessions/session_{session_id}"
                os.makedirs(session_dir, exist_ok=True)
                os.makedirs(f"{session_dir}/images", exist_ok=True)
                
                export_data = {
                    "session_id": session_id,
                    "style": st.session_state.style,
                    "turns": st.session_state.conversation,
                    "images": {}
                }
                
                # Copy images
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
                try:
                    # Update URL to include the newly saved session so it can be shared/bookmarked
                    st.query_params['session'] = session_dir
                except Exception:
                    pass
                
                # Create and persist the ZIP on disk so it's available after a reload.
                import zipfile
                zip_path = f"{session_dir}/session.zip"
                try:
                    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
                        zip_file.writestr("session.json", json.dumps(export_data, indent=2, default=str))
                        for src, dest in image_map.items():
                            try:
                                zip_file.write(src, dest)
                            except Exception:
                                # If a file can't be added, skip it
                                pass

                    # Provide immediate download from persisted file so the button still works after reload
                    with open(zip_path, "rb") as zf:
                        st.download_button(
                            label="Download Session Zip",
                            data=zf.read(),
                            file_name=os.path.basename(zip_path),
                            mime="application/zip"
                        )
                except Exception as e:
                    st.error(f"Failed to create session ZIP: {e}")

            # Load session
            st.subheader("📁 Load Past Session")
            sessions_dir = "sessions"
            st.caption("Sessions are stored globally for this app instance; they are not private per-browser session.")

            # Support loading a saved session directly via URL query parameter.
            # Example: /?session=sessions/session_20250908_... will auto-load that session.json
            try:
                params = st.query_params.to_dict()
                target = params.get('session', None)
            except Exception:
                params = {}
                target = None

            if target:
                # If we've already loaded this session from the URL during this app run,
                # skip re-loading to avoid a reload loop while keeping the param in the URL.
                if st.session_state.get('loaded_session_from_url') == target:
                    # already loaded, do nothing
                    pass
                else:
                    # Normalize path and ensure it points inside the sessions directory
                    target_path = os.path.normpath(target)
                    # Only allow loading from the sessions dir for safety
                    if target_path.startswith(sessions_dir) and os.path.isdir(target_path):
                        json_path = os.path.join(target_path, 'session.json')
                        if os.path.exists(json_path):
                            with open(json_path, 'r') as f:
                                loaded_data = json.load(f)

                            st.session_state.conversation = loaded_data.get("turns", [])
                            st.session_state.current_turn = len(loaded_data.get("turns", []))
                            st.session_state.style = loaded_data.get("style", st.session_state.style)

                            # Restore images referenced in the session (copy into workspace if present)
                            image_map = loaded_data.get("images", {})
                            for original_path, session_img_path in image_map.items():
                                full_session_img = os.path.join(target_path, session_img_path)
                                if os.path.exists(full_session_img):
                                    dest_path = original_path
                                    try:
                                        shutil.copy2(full_session_img, dest_path)
                                    except Exception:
                                        pass
                                    for turn in st.session_state.conversation:
                                        if turn.get('image_path') == original_path:
                                            turn['image_path'] = dest_path

                            # Record that we've loaded this session from URL so we don't reload again
                            st.session_state['loaded_session_from_url'] = target

                            st.success(f"Session loaded from URL: {target}")
                            # Rerun to reflect loaded session; because we've set loaded_session_from_url,
                            # this will not re-trigger the load when the page re-executes, and the URL
                            # param remains intact for sharing/bookmarking.
                            st.rerun()
                    else:
                        st.error("Invalid or disallowed session path provided in URL parameter.")
            available_sessions = []
            if os.path.exists(sessions_dir):
                for item in os.listdir(sessions_dir):
                    session_path = os.path.join(sessions_dir, item)
                    if os.path.isdir(session_path):
                        json_path = os.path.join(session_path, "session.json")
                        if os.path.exists(json_path):
                            available_sessions.append(f"{sessions_dir}/{item}")
            
            if available_sessions:
                selected_session = st.selectbox("Select Session to Load", ["None"] + available_sessions)
                # If session is present in URL params, show its ZIP download if available
                try:
                    params = st.query_params.to_dict()
                    url_session = params.get('session')
                except Exception:
                    url_session = None

                if url_session:
                    candidate_zip = os.path.join(url_session, 'session.zip')
                    if os.path.exists(candidate_zip):
                        try:
                            with open(candidate_zip, 'rb') as f:
                                st.download_button(label="Download Session ZIP (from URL)", data=f.read(), file_name=os.path.basename(candidate_zip), mime="application/zip")
                        except Exception:
                            pass

                # Also show download button for the selected session (if it contains session.zip)
                if selected_session != "None":
                    candidate_zip = f"{selected_session}/session.zip"
                    if os.path.exists(candidate_zip):
                        try:
                            with open(candidate_zip, "rb") as f:
                                st.download_button(label="Download Session ZIP", data=f.read(), file_name=os.path.basename(candidate_zip), mime="application/zip")
                        except Exception:
                            pass
                if st.button("Load Session") and selected_session != "None":
                    json_path = f"{selected_session}/session.json"
                    if os.path.exists(json_path):
                        with open(json_path, 'r') as f:
                            loaded_data = json.load(f)
                        
                        st.session_state.conversation = loaded_data.get("turns", [])
                        st.session_state.current_turn = len(loaded_data.get("turns", []))
                        st.session_state.style = loaded_data.get("style", "Photorealistic")
                        
                        # Restore images
                        image_map = loaded_data.get("images", {})
                        for original_path, session_img_path in image_map.items():
                            full_session_img = f"{selected_session}/{session_img_path}"
                            if os.path.exists(full_session_img):
                                dest_path = original_path
                                shutil.copy2(full_session_img, dest_path)
                                for turn in st.session_state.conversation:
                                    if turn.get('image_path') == original_path:
                                        turn['image_path'] = dest_path
                        # Update the URL so the loaded session can be shared/bookmarked.
                        try:
                            # Use the selected session path as the session query parameter.
                            st.query_params['session']=selected_session
                        except Exception:
                            # If setting query params fails, fall back to success message and rerun.
                            pass

                        st.success(f"Session loaded! Continuing with {len(st.session_state.conversation)} turns.")
                        # Rerun to reflect the loaded session and updated URL
                        st.rerun()
                    else:
                        st.error(f"Session file not found: {json_path}")
            else:
                st.warning("No saved sessions found in the 'sessions' directory.")

            # Show current state
            if st.session_state.conversation:
                with st.expander("🎬 Current Status"):
                    col1_status, col2_status = st.columns(2)
                    with col1_status:
                        st.metric("Current Turn", st.session_state.current_turn)
                    with col2_status:
                        st.metric("Total Turns", len(st.session_state.conversation))

            # Controls
            st.subheader("🔄 Controls")
            col1_ctrl, col2_ctrl = st.columns(2)
            with col1_ctrl:
                if st.button("🔄 Reset Evolution"):
                    for turn in st.session_state.conversation:
                        if turn['image_path'] and os.path.exists(turn['image_path']):
                            os.remove(turn['image_path'])
                    st.session_state.conversation = []
                    st.session_state.current_turn = 0
                    st.session_state.initial_image = None
                    st.rerun()
            with col2_ctrl:
                if st.button("⬅️ Undo Last Turn") and len(st.session_state.conversation) > 0:
                    last_turn = st.session_state.conversation.pop()
                    if last_turn['image_path'] and os.path.exists(last_turn['image_path']):
                        os.remove(last_turn['image_path'])
                    st.session_state.current_turn -= 1
                    if st.session_state.current_turn < 0:
                        st.session_state.current_turn = 0
                    st.rerun()

            # Statistics
            st.subheader("📊 Evolution Stats")
            total_turns = len(st.session_state.conversation)
            total_images = sum(1 for turn in st.session_state.conversation if turn['image_path'])
            st.metric("Total Turns", total_turns)
            st.metric("Images Generated", total_images)

    # Main content area - Conversation display
    st.header("🎬 Look for more Details")

    # Display conversation
    for i, turn in enumerate(st.session_state.conversation):
        model_name = turn['model_name']
        timestamp = turn.get('timestamp', '')

        with st.container():
            # Model header
            if "Human" in model_name:
                st.markdown(f"### 👤 {model_name} (Initial Input)")
            else:
                style_label = turn.get('style') or st.session_state.get('style') or ''
                style_suffix = f" - Style: {style_label}" if style_label else ''
                st.markdown(f"### 🎨 Turn {i}{style_suffix}")

            # Text content
            if turn['text']:
                # Extract the first sentence (assumed to describe the chosen detail) and display it in bold
                text_str = str(turn['text']).strip()
                # Split on first sentence-ending punctuation followed by a space; fallback to whole text if no match
                parts = re.split(r'(?<=[.!?])\s', text_str, 1)
                first_sentence = parts[0].strip()
                st.markdown(f"**{first_sentence}**")

            # Image content
            if turn.get('image_path'):
                st.image(turn['image_path'], caption=turn.get('image_description', 'Generated image'), width=1024)
            else:
                if turn.get('image_missing'):
                        st.warning("No image was generated for this turn.")
                        # If this turn has structured error info, show it nicely
                        if turn.get('failed_reason') == 'model_response_error' and turn.get('error_info'):
                            err = turn['error_info']
                            st.error(f"Model error: {err.get('message','Unknown')}")
                            with st.expander("Show raw model response"):
                                st.write(err.get('response'))

                        if st.button(f"🔁 Regenerate image for Turn {i}"):
                            # Attempt to regenerate this turn by using its prompt or previous image
                            model = CreativeDialog(st.session_state.get("gemini_api_key", ""))
                            prev_image = None
                            # If the turn recorded a fallback_from index, prefer that
                            if turn.get('fallback_from') is not None:
                                fb = turn.get('fallback_from')
                                p = None
                                if fb is not None and fb >= 0 and fb < len(st.session_state.conversation):
                                    p = st.session_state.conversation[fb].get('image_path')
                                if p and os.path.exists(p):
                                    try:
                                        prev_image = Image.open(p)
                                    except Exception:
                                        prev_image = None

                            # If no explicit fallback, try immediate prior turn chain or uploaded initial image
                            if prev_image is None:
                                if i == 0:
                                    if st.session_state.initial_image:
                                        prev_image = st.session_state.initial_image
                                    else:
                                        st.info("Human input turn has no image to regenerate.")
                                else:
                                    # Search backwards for the nearest existing image file in prior turns
                                    for j in range(i-1, -1, -1):
                                        p = st.session_state.conversation[j].get('image_path')
                                        if p and os.path.exists(p):
                                            try:
                                                prev_image = Image.open(p)
                                                break
                                            except Exception:
                                                prev_image = None
                                                continue
                                    # Fallback to the uploaded initial image if still None
                                    if prev_image is None and st.session_state.initial_image:
                                        prev_image = st.session_state.initial_image

                            new_turn, new_image = generate_next_turn(st.session_state.conversation, i, model, st.session_state.style, "", prev_image)
                            if new_turn and new_image:
                                # replace the turn at index i
                                st.session_state.conversation[i] = new_turn
                                st.success(f"Turn {i} regenerated with image.")
                                st.rerun()
                            else:
                                st.error("Regeneration failed or returned no image.")

            st.divider()

    if st.session_state.conversation:
        st.markdown(f"**🎯 Next: Evolve from Turn {st.session_state.current_turn - 1} | Style: {st.session_state.style}**")

        # Allow continuing directly from the thread
        if st.button("Continue Next Turn from Thread"):
            if not st.session_state.api_key_set:
                st.warning("Please set the API key in the sidebar first.")
            else:
                model = CreativeDialog(st.session_state.get("gemini_api_key", ""))
                with st.spinner("Evolving image from thread..."):
                    new_turn, _ = generate_next_turn(
                        st.session_state.conversation,
                        st.session_state.current_turn,
                        model,
                        st.session_state.style,
                        "",
                        None
                    )
                    if new_turn:
                        st.session_state.conversation.append(new_turn)
                        st.session_state.current_turn += 1
                        st.success(f"Turn {st.session_state.current_turn} generated from thread!")
                        st.rerun()

    # (Duplicate main-area controls removed — sidebar controls and single conversation display are retained above.)

if __name__ == "__main__":
    main()