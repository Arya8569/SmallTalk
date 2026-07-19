import os
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load variables from root .env and backend/.env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv()

gemini_api_key = os.getenv("GEMINI_API_KEY")

if not gemini_api_key:
    print("Error: Missing environment variable GEMINI_API_KEY")
    exit(1)

genai_client = genai.Client(api_key=gemini_api_key)

CATEGORIES = [
    "Casual",
    "Professional",
    "Technology",
    "Philosophy",
    "Personal Growth",
    "Culture & Society",
    "Arts & Literature",
    "History & Education",
    "Health & Wellness",
    "Travel & Adventure"
]

def generate_prompts(category: str, count: int = 100):
    print(f"Generating {count} prompts for category '{category}'...")
    prompt = f"""
    Generate exactly {count} unique, engaging, and thought-provoking public speaking prompt questions for the category '{category}'.
    Each prompt should be a single clear question or task suitable for an impromptu 1-2 minute speech.
    Return them as a numbered list with one prompt per line. Do not include any JSON, markdown code blocks, or extra text.
    Example format:
    1. First question?
    2. Second question?
    """
    
    try:
        response = genai_client.models.generate_content(
            model='gemini-flash-latest',
            contents=prompt
        )
        lines = response.text.strip().split("\n")
        prompts = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            # Strip number prefix, e.g. "1. ", "10. ", "100. "
            if "." in line[:6]:
                parts = line.split(".", 1)
                p = parts[1].strip()
                if p:
                    prompts.append(p)
            elif line:
                prompts.append(line)
        return prompts
    except Exception as e:
        print(f"Error generating prompts for {category}: {e}")
        return []

def generate_prompts_with_retry(category: str, count: int = 100):
    for attempt in range(3):
        prompts = generate_prompts(category, count)
        if len(prompts) >= count - 10:  # Allow small tolerance
            return prompts[:count]
        print(f"Attempt {attempt + 1} failed or returned too few ({len(prompts)}). Retrying in 12 seconds...")
        time.sleep(12)
    return []

def main():
    print("Starting database seeding generator for 1000+ topics...")
    
    all_rows = []
    for cat in CATEGORIES:
        prompts = generate_prompts_with_retry(cat, 100)
        
        # Fallback if generation failed or returned too few
        if len(prompts) < 100:
            print(f"Warning: Only generated {len(prompts)} prompts for '{cat}'. Supplementing with unique templates.")
            fallback_templates = [
                f"Discuss the importance of {cat} in modern life and how it affects our day-to-day decisions.",
                f"What is the biggest myth or misconception people hold about {cat}?",
                f"How will the future of {cat} change in the next fifty years?",
                f"Should the government regulate aspects of {cat} to protect the general public?",
                f"What is the single most valuable lesson you have learned through your experience with {cat}?",
                f"How does our cultural background shape our individual perspective on {cat}?",
                f"Is {cat} a universal human experience, or is it specific to certain environments?",
                f"What is the biggest challenge humanity faces regarding {cat} today?",
                f"Describe a recent innovation in the field of {cat} that excites you the most.",
                f"How can we teach children the value of {cat} from an early age?"
            ]
            while len(prompts) < 100:
                index = len(prompts) % len(fallback_templates)
                prompts.append(f"{fallback_templates[index]} (System Seed {len(prompts) + 1})")
        
        for p in prompts[:100]:
            all_rows.append({"category": cat, "prompt": p})
            
        print(f"Collected {len(prompts[:100])} prompts for '{cat}'.")
        # Sleep to avoid hitting free-tier RPM rate limits
        time.sleep(8)

    # Write all rows to seed_1000.sql
    sql_file_path = os.path.join(os.path.dirname(__file__), "..", "seed_1000.sql")
    print(f"Writing {len(all_rows)} SQL inserts to {sql_file_path}...")
    
    try:
        with open(sql_file_path, "w", encoding="utf-8") as f:
            f.write("-- SQL script to seed 1000 topics\n")
            f.write("TRUNCATE TABLE topics CASCADE;\n\n")
            f.write("INSERT INTO topics (category, prompt) VALUES\n")
            
            for i, row in enumerate(all_rows):
                # Escape single quotes in prompt values for PostgreSQL compatibility
                escaped_prompt = row['prompt'].replace("'", "''")
                ending = ";\n" if i == len(all_rows) - 1 else ",\n"
                f.write(f"('{row['category']}', '{escaped_prompt}'){ending}")
                
        print("SQL seeding file generated successfully!")
    except Exception as e:
        print(f"Error writing SQL file: {e}")

if __name__ == "__main__":
    main()
