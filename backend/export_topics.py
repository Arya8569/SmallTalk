import os
import json
from dotenv import load_dotenv
from supabase import create_client

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)
load_dotenv()

supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

supabase = create_client(supabase_url, supabase_key)

def export_to_ts():
    print("Fetching clean topics from DB with pagination...")
    all_data = []
    limit = 1000
    offset = 0
    while True:
        response = supabase.table("topics").select("id, category, prompt").range(offset, offset + limit - 1).order("id").execute()
        data = response.data
        if not data:
            break
        all_data.extend(data)
        if len(data) < limit:
            break
        offset += limit
        
    print(f"Total topics fetched from DB: {len(all_data)}")
    
    unique_topics = []
    seen = set()
    for row in all_data:
        key = (row["category"].strip(), row["prompt"].strip())
        if key not in seen:
            seen.add(key)
            unique_topics.append(row)
            
    print(f"Total unique topics to export: {len(unique_topics)}")
    
    # Generate fallbackTopics.ts contents
    lines = []
    lines.append("export interface Topic {")
    lines.append("  id: number;")
    lines.append("  category: string;")
    lines.append("  prompt: string;")
    lines.append("}")
    lines.append("")
    lines.append("export const FALLBACK_TOPICS: Topic[] = [")
    
    for row in unique_topics:
        escaped_prompt = row['prompt'].replace("'", "\\'")
        lines.append(f"  {{ id: {row['id']}, category: '{row['category']}', prompt: '{escaped_prompt}' }},")
        
    lines.append("];")
    
    ts_file_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "lib", "fallbackTopics.ts")
    print(f"Writing TS file to {ts_file_path}...")
    with open(ts_file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("TypeScript fallback file updated successfully!")

if __name__ == "__main__":
    export_to_ts()
