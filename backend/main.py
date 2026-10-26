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
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.client import Config

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
try:
    os.makedirs("backend/static/recordings", exist_ok=True)
    app.mount("/static", StaticFiles(directory="backend/static"), name="static")
except Exception as static_err:
    print(f"Notice: static dir mount skipped: {static_err}")

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

# Initialize API Keys, Neon Postgres, and Neon Object Storage Clients
groq_api_key = os.getenv("GROQ_API_KEY")
gemini_api_key = os.getenv("GEMINI_API_KEY")
database_url = os.getenv("DATABASE_URL") or os.getenv("DATABASE_URL_UNPOOLED")

s3_endpoint = os.getenv("AWS_ENDPOINT_URL_S3")
s3_access_key = os.getenv("AWS_ACCESS_KEY_ID")
s3_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
s3_region = os.getenv("AWS_REGION", "us-east-2")
NEON_BUCKET_NAME = "recordings"

if not all([groq_api_key, gemini_api_key]):
    print("Warning: Missing required LLM API keys in environment variables!")

def get_db():
    if not database_url:
        raise ValueError("DATABASE_URL is not set in environment variables!")
    return psycopg2.connect(database_url)

s3_client = None
if s3_endpoint and s3_access_key and s3_secret_key:
    s3_client = boto3.client(
        "s3",
        endpoint_url=s3_endpoint,
        aws_access_key_id=s3_access_key,
        aws_secret_access_key=s3_secret_key,
        region_name=s3_region,
        config=Config(s3={"addressing_style": "path"})
    )
    print("Initialized Neon Object Storage S3 client.")
else:
    print("Warning: Neon Object Storage credentials not fully set; will use local fallback.")

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
@app.get("/api/backend")
def read_root():
    return {"message": "Welcome to the Speech Evaluation API"}

@app.get("/health")
@app.get("/api/backend/health")
def health_check():
    return {"status": "healthy", "service": "speech-evaluation-api"}

@app.get("/topics/random")
@app.get("/api/backend/topics/random")
def get_random_topic_endpoint(categories: str = "Casual,Professional,Technology,Philosophy,Personal Growth,Culture & Society", exclude_ids: str = ""):
    cat_list = [c.strip() for c in categories.split(",") if c.strip()]
    ex_list = [int(i.strip()) for i in exclude_ids.split(",") if i.strip().isdigit()]
    try:
        with get_db() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM get_random_topic(%s, %s);", (cat_list, ex_list))
                rows = cur.fetchall()
                if rows:
                    return [dict(r) for r in rows]
    except Exception as e:
        print(f"Error fetching topic from Neon DB: {e}")
    # Fallback
    return [{"id": 1, "category": "Casual", "prompt": FALLBACK_PROMPTS.get(1)}]

@app.post("/upload")
@app.post("/api/backend/upload")
async def upload_audio(
    file: UploadFile = File(...),
    topic_id: int = Form(...)
):
    # 1. Validate uploaded file format
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Uploaded file is not an audio format")

    # 2. Get prompt context from Neon Postgres
    prompt_text = "General topic speech evaluation"
    try:
        with get_db() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT prompt FROM topics WHERE id = %s;", (topic_id,))
                topic_row = cur.fetchone()
                if topic_row:
                    prompt_text = topic_row["prompt"]
                else:
                    prompt_text = FALLBACK_PROMPTS.get(topic_id, "General speech topic")
    except Exception as db_err:
        print(f"Neon prompt lookup failed: {db_err}")
        prompt_text = FALLBACK_PROMPTS.get(topic_id, "General speech topic")

    try:
        public_url = None
        
        # 3. Upload recording to Neon Object Storage bucket named 'recordings'
        try:
            if s3_client is None:
                raise ValueError("S3 client not initialized")
                
            unique_filename = f"{uuid.uuid4()}-{file.filename}"
            file.file.seek(0)
            file_bytes = file.file.read()
            
            s3_client.put_object(
                Bucket=NEON_BUCKET_NAME,
                Key=unique_filename,
                Body=file_bytes,
                ContentType=file.content_type
            )
            
            # Construct public URL for Neon Object Storage
            public_url = f"{s3_endpoint}/{NEON_BUCKET_NAME}/{unique_filename}"
            print(f"Successfully uploaded recording to Neon Object Storage: {public_url}")
        except Exception as storage_err:
            print(f"Neon Storage Upload failed (falling back to local static file serving): {storage_err}")
            
            # Local fallback storage (with safe fallback for serverless read-only filesystems)
            local_id = str(uuid.uuid4())
            local_filename = f"{local_id}-{file.filename}"
            try:
                os.makedirs("backend/static/recordings", exist_ok=True)
                local_path = f"backend/static/recordings/{local_filename}"
                file.file.seek(0)
                with open(local_path, "wb") as local_file:
                    local_file.write(file.file.read())
                public_url = f"http://localhost:8000/static/recordings/{local_filename}"
            except Exception as write_err:
                tmp_path = os.path.join("/tmp", local_filename)
                file.file.seek(0)
                with open(tmp_path, "wb") as local_file:
                    local_file.write(file.file.read())
                public_url = f"/api/backend/static/{local_filename}"
            print(f"Saved recording to fallback storage: {public_url}")
        
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
        
        # 6. Database Insertion into recordings table in Neon Postgres
        record_id = str(uuid.uuid4())
        created_at_dt = datetime.now(timezone.utc)
        created_at_str = created_at_dt.isoformat()
        
        try:
            with get_db() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        """
                        INSERT INTO recordings (id, topic_id, audio_url, rating, feedback_json, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        RETURNING id, topic_id, audio_url, rating, feedback_json, created_at;
                        """,
                        (record_id, topic_id, public_url, rating, json.dumps(feedback_json), created_at_dt)
                    )
                    saved_row = cur.fetchone()
                    conn.commit()
                    if saved_row:
                        saved_dict = dict(saved_row)
                        if isinstance(saved_dict.get("created_at"), datetime):
                            saved_dict["created_at"] = saved_dict["created_at"].isoformat()
                        return saved_dict
        except Exception as db_insert_err:
            print(f"Neon DB insert failed, returning local payload fallback: {db_insert_err}")
            
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

@app.delete("/recordings/{recording_id}")
@app.delete("/api/backend/recordings/{recording_id}")
async def delete_recording(recording_id: str):
    try:
        # 1. Fetch recording details to get the audio URL from Neon
        audio_url = None
        with get_db() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT audio_url FROM recordings WHERE id = %s;", (recording_id,))
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Recording not found")
                audio_url = row.get("audio_url")
                
                # 2. If it's stored in Neon Object Storage, delete the file from the bucket
                if audio_url and f"/{NEON_BUCKET_NAME}/" in audio_url and s3_client:
                    try:
                        filename = audio_url.split(f"/{NEON_BUCKET_NAME}/")[-1]
                        s3_client.delete_object(Bucket=NEON_BUCKET_NAME, Key=filename)
                        print(f"Successfully deleted storage file from Neon bucket: {filename}")
                    except Exception as s3_del_err:
                        print(f"Failed to delete storage file from Neon bucket: {s3_del_err}")
                        
                # 3. Delete the database row from Neon
                cur.execute("DELETE FROM recordings WHERE id = %s;", (recording_id,))
                conn.commit()
                print(f"Successfully deleted database record for recording ID: {recording_id}")
                
        return {"status": "success", "message": f"Recording {recording_id} deleted successfully"}
        
    except Exception as e:
        print(f"Error during recording deletion: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error deleting recording: {str(e)}"
        )
