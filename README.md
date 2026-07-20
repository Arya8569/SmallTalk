# 🎙️ SmallTalk: Speech Evaluation & Impromptu Practice

SmallTalk is a premium full-stack web application designed to help users practice impromptu public speaking. Users select categories, spin an interactive roulette wheel to receive a random prompt, record a 1-to-2 minute speech, and receive instant, structured AI evaluation of their delivery (filler words, grammar, impact phrases) and an overall rating.

---

## ✨ Features

*   **Interactive Theme & Audio Recording:** Smooth audio recording directly in the browser with visual feedback and dynamic ambient ring animations.
*   **Smart Topic Roulette:** Spin to select a topic from multiple categories (Casual, Professional, Tech, Philosophy, etc.).
*   **Topic Uniqueness:** Uses browser-based `localStorage` tracking to guarantee you never get a duplicate topic in a session, with automatic history reset when topics are exhausted.
*   **Instant AI Transcription:** Powered by **Groq Whisper API** (`whisper-large-v3`) for lightning-fast and highly accurate voice-to-text.
*   **Structured Speech Evaluation:** Powered by **Google Gemini 2.0 Flash API** using structured JSON output to analyze:
    *   **Filler Words & Errors (Red):** Flags filler words like *um, uh, like, so, basically* and grammatical errors.
    *   **High-Impact Vocabulary (Green):** Highlights powerful rhetorical phrases, transitions, and strong vocabulary.
    *   **Neutral Text (Gray):** Captures standard connecting context.
    *   **Strict Rating (1-5):** Provides a public-speaking coach assessment.
*   **Supabase Storage & DB Integration:** Speeches and feedback data are stored securely, with a fully offline preview mode fallback if the database is disconnected.

---

## 🛠️ Technology Stack

*   **Frontend:** React / Next.js (TypeScript, Tailwind CSS, Lucide Icons)
*   **Backend:** Python / FastAPI (Uvicorn, Pydantic Structured Outputs)
*   **Database & Storage:** Supabase (PostgreSQL, Row Level Security, Supabase Storage)
*   **AI Models:** Groq Whisper (`whisper-large-v3`), Google Gemini (`gemini-2.0-flash`)

---

## 📂 Project Structure

```text
SmallTalk/
├── backend/            # FastAPI Python backend
│   ├── main.py         # Primary API routing and AI workflows
│   ├── requirements.txt# Backend dependencies
│   └── .env            # Backend configuration
├── frontend/           # Next.js React frontend
│   ├── src/
│   │   ├── app/        # App router page logic
│   │   └── components/ # Audio Recorder, Spinner, Category Selection
│   └── .env.local      # Frontend configuration
├── schema.sql          # Supabase SQL table definitions & RPC functions
└── README.md           # Documentation
```

---

## 🚀 Local Development Setup

### 1. Prerequisites
Make sure you have **Node.js (v18+)** and **Python (v3.8+)** installed.

### 2. Database Setup (Supabase)
Run the SQL script inside [schema.sql](file:///d:/PROJECTS/SmallTalk/schema.sql) in your Supabase SQL Editor. This will create the `topics` and `recordings` tables, configure row-level security, and install the `get_random_topic` RPC function.

### 3. Run Backend (FastAPI)
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Set up virtual environment and install packages:
   ```bash
   python -m venv venv
   # Activate on Windows:
   .\venv\Scripts\activate
   # Activate on macOS/Linux:
   source venv/bin/activate

   pip install -r requirements.txt
   ```
3. Start the server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### 4. Run Frontend (Next.js)
1. Open a new terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install packages and start development server:
   ```bash
   npm install
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Production Deployment

### Backend (Render / Railway)
1. Host your FastAPI project as a **Web Service** on [Render](https://render.com/).
2. Set **Root Directory** to `backend`.
3. Build Command: `pip install -r requirements.txt`.
4. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
5. Configure Environment Variables in the Render dashboard:
   - `GEMINI_API_KEY`, `GROQ_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - `ALLOWED_ORIGINS` = `https://your-app.vercel.app` (your live frontend domain).

### Frontend (Vercel)
1. Deploy your Next.js project on [Vercel](https://vercel.com/).
2. Set **Root Directory** to `frontend`.
3. Add Environment Variables in the Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - `NEXT_PUBLIC_BACKEND_API_URL` = `https://your-backend.onrender.com` (your live backend domain).
