import os
import uuid
import json
from datetime import datetime, timezone
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List, Literal
from supabase import create_client, Client

import re
from fastapi.staticfiles import StaticFiles

def generate_heuristic_evaluation(transcript: str) -> dict:
    words = re.findall(r'\S+|\s+', transcript)
    
    fillers = {"um", "uh", "like", "so", "basically", "actually", "literally", "well", "youknow"}
    strong_words = {
        "achieve", "achieved", "achieving", "success", "successful", "successfully",
        "grow", "growth", "growing", "grows", "challenge", "challenges", "challenging",
        "improve", "improving", "improved", "critical", "significant", "significantly",
        "opportunity", "opportunities", "future", "benefit", "benefits", "beneficial",
        "essential", "essentially", "key", "important", "importance", "clearly",
        "absolute", "absolutely", "creative", "innovative", "innovation", "innovations"
    }
    
    segments = []
    current_segment = ""
    current_type = None
    
    def add_current():
        nonlocal current_segment, current_type
        if current_segment:
            segments.append({
                "text_segment": current_segment,
                "type": current_type
            })
            current_segment = ""
            current_type = None
            
    for item in words:
        if item.isspace():
            if current_segment:
                current_segment += item
            else:
                current_segment = item
                current_type = 'neutral'
            continue
            
        word_clean = re.sub(r'[^\w]', '', item.lower())
        
        item_type = 'neutral'
        if word_clean in fillers:
            item_type = 'red'
        elif word_clean in strong_words:
            item_type = 'green'
            
        if current_type is None:
            current_type = item_type
            current_segment = item
        elif current_type == item_type:
            current_segment += item
        else:
            add_current()
            current_type = item_type
            current_segment = item
            
    add_current()
    
    red_count = sum(1 for s in segments if s["type"] == 'red')
    rating = max(1, min(5, 5 - int(red_count / 2)))
    
    return {
        "rating": rating,
        "transcript_analysis": segments
    }

# Load local environment variables from backend/.env or root .env
load_dotenv()

app = FastAPI(
    title="Speech Evaluation API",
    description="Backend service for speech evaluation and analysis powered by AI",
    version="0.2.0",
)

# Ensure local static directory exists for fallback recording hosting
os.makedirs("backend/static/recordings", exist_ok=True)
app.mount("/static", StaticFiles(directory="backend/static"), name="static")

# Configure CORS Middleware
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_str:
    origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]
else:
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase, Groq, and Gemini GenAI Clients
supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
groq_api_key = os.getenv("GROQ_API_KEY")
gemini_api_key = os.getenv("GEMINI_API_KEY")

if not all([supabase_url, supabase_key, groq_api_key, gemini_api_key]):
    print("Warning: Missing required API keys in environment variables!")

supabase_client: Client = create_client(
    supabase_url or "https://placeholder.supabase.co",
    supabase_key or "placeholder-key"
)

# Pydantic Schemas for Structured LLM Outputs
class Segment(BaseModel):
    text_segment: str
    type: Literal['neutral', 'red', 'green']

class EvaluationResult(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Overall speech rating between 1 (poor) and 5 (exceptional)")
    transcript_analysis: List[Segment] = Field(
        ...,
        description="Chronological breakdown of the transcription. Every word must be part of a segment. Flag grammatical/filler errors as red, strong phrases/words as green, and everything else as neutral."
    )

# Fallback Prompt Dictionary in case database row is missing/offline
FALLBACK_PROMPTS = {
    1: "If you could invent a new holiday, what would it be about and how would people celebrate it?",
    2: "What is a small, simple pleasure that instantly makes your day better?",
    3: "If you could swap lives with your pet for a day, what do you think they would do in your body?",
    4: "What is the strangest food combination you secretly enjoy?",
    5: "If your life was a sitcom, what would the title be and what would be the plot of the pilot episode?",
    6: "What is the most useless talent you possess?",
    7: "If you had to eat the exact same meal every day for the rest of your life, what would you choose?",
    8: "What is the funniest thing that has ever happened to you as a child?",
    9: "If you were an alien visiting Earth for the first time, what human habit would confuse you the most?",
    10: "If you could be any animal for a day, which one would you choose and why?",
    31: "Describe the most useful piece of professional advice you have ever ignored and what you learned from it.",
    32: "How do you prioritize tasks when everything seems urgent?",
    33: "Describe a time you pushed back on a decision at work and were ultimately proven right.",
    61: "Will artificial intelligence ultimately create more jobs than it destroys?",
    62: "If you had to eliminate one piece of modern technology completely, what would it be?",
    91: "If you could know the exact date and time of your death, would you want to know it?",
    92: "Does true altruism exist, or is every good deed driven by a selfish motive?",
    121: "What is something you have had to let go of in order to grow?",
    122: "Describe a moment in your life when you truly felt proud of yourself.",
    151: "Should traveling abroad be a mandatory prerequisite before entering a university or job market?",
    152: "How has social media changed our definition of a true friend?"
}

@app.get("/")
def read_root():
    return {"message": "Welcome to the Speech Evaluation API"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "speech-evaluation-api"}

@app.post("/upload")
async def upload_audio(
    file: UploadFile = File(...),
    topic_id: int = Form(...)
):
    # 1. Validate uploaded file format
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Uploaded file is not an audio format")

    # 2. Get prompt context
    prompt_text = "General topic speech evaluation"
    try:
        topic_response = supabase_client.table("topics").select("prompt").eq("id", topic_id).execute()
        if topic_response.data and len(topic_response.data) > 0:
            prompt_text = topic_response.data[0]["prompt"]
        else:
            prompt_text = FALLBACK_PROMPTS.get(topic_id, "General speech topic")
    except Exception as db_err:
        print(f"Supabase prompt lookup failed: {db_err}")
        prompt_text = FALLBACK_PROMPTS.get(topic_id, "General speech topic")

    try:
        public_url = None
        
        # 3. Upload recording to Supabase Storage bucket named 'recordings'
        try:
            from storage3.types import FileOptions
            
            unique_filename = f"{uuid.uuid4()}-{file.filename}"
            
            # Read file bytes
            file.file.seek(0)
            file_bytes = file.file.read()
            
            # Upload directly to Supabase storage
            supabase_client.storage.from_("recordings").upload(
                path=unique_filename,
                file=file_bytes,
                file_options=FileOptions(content_type=file.content_type)
            )
            
            # Generate the public URL
            public_url = supabase_client.storage.from_("recordings").get_public_url(unique_filename)
            print(f"Successfully uploaded recording to Supabase Storage: {public_url}")
        except Exception as storage_err:
            print(f"Supabase Storage Upload failed (falling back to local static file serving): {storage_err}")
            
            # Local fallback storage
            local_id = str(uuid.uuid4())
            local_filename = f"{local_id}-{file.filename}"
            local_path = f"backend/static/recordings/{local_filename}"
            
            file.file.seek(0)
            with open(local_path, "wb") as local_file:
                local_file.write(file.file.read())
                
            # Point to local server hosting path
            public_url = f"http://localhost:8000/static/recordings/{local_filename}"
            print(f"Successfully saved recording to local storage fallback: {public_url}")
        
        # 4. Transcribe recording via Groq Whisper API
        # Read the uploaded file bytes
        file.file.seek(0)
        file_bytes = file.file.read()
        
        groq_client = Groq(api_key=groq_api_key)
        transcription_res = groq_client.audio.transcriptions.create(
            file=(file.filename, file_bytes, file.content_type),
            model="whisper-large-v3"
        )
        raw_transcript = transcription_res.text
        
        if not raw_transcript or len(raw_transcript.strip()) == 0:
            raise HTTPException(status_code=422, detail="Unable to transcribe speech. Please ensure you spoke clearly.")

        # 5. Evaluate transcription via Google Gemini with structured schema
        rating = 3
        transcript_analysis = []
        
        try:
            genai_client = genai.Client(api_key=gemini_api_key)
            
            user_prompt = f"""
            Original Speaking Prompt: "{prompt_text}"
            Speech Transcript: "{raw_transcript}"
            """
            
            system_instruction = """
            You are a strict, professional public speaking coach. Evaluate the user's speech transcript based on the original speaking prompt.
            
            Provide:
            1. A strict rating from 1 to 5 (1 being poor, 5 being exceptional).
            2. A chronological analysis breaking down the transcript text. Slice the transcript into contiguous, logical segments. For each segment, classify it as:
               - 'red': grammatical errors, filler words ('uh', 'um', 'like', 'so'), long awkward stuttering.
               - 'green': high-impact vocabulary, excellent logic flow, strong rhetorical devices.
               - 'neutral': standard factual connecting text or average transitions.
            Every word in the transcription must be accounted for. Be highly analytical.
            """
            
            gemini_response = genai_client.models.generate_content(
                model='gemini-2.0-flash',
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_schema=EvaluationResult,
                ),
            )
            
            feedback_data = json.loads(gemini_response.text)
            rating = feedback_data.get("rating", 3)
            transcript_analysis = feedback_data.get("transcript_analysis", [])
            print("Successfully evaluated speech via Gemini API.")
        except Exception as gemini_err:
            print(f"Gemini API call failed, using heuristic fallback. Error details: {gemini_err}")
            fallback_res = generate_heuristic_evaluation(raw_transcript)
            rating = fallback_res["rating"]
            transcript_analysis = fallback_res["transcript_analysis"]
            
        feedback_json = {
            "transcript": raw_transcript,
            "analysis": transcript_analysis
        }
        
        # 6. Database Insertion into recordings table
        record_id = str(uuid.uuid4())
        created_at_str = datetime.now(timezone.utc).isoformat()
        
        try:
            insert_response = supabase_client.table("recordings").insert({
                "topic_id": topic_id,
                "audio_url": public_url,
                "rating": rating,
                "feedback_json": feedback_json
            }).execute()
            
            if insert_response.data and len(insert_response.data) > 0:
                # Return the saved database record
                return insert_response.data[0]
        except Exception as db_insert_err:
            print(f"Supabase insert failed, returning local payload fallback: {db_insert_err}")
            
        return {
            "id": record_id,
            "topic_id": topic_id,
            "audio_url": public_url,
            "rating": rating,
            "feedback_json": feedback_json,
            "created_at": created_at_str
        }
        
    except Exception as e:
        print(f"Error during audio processing workflow: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error processing speech: {str(e)}"
        )
