import os
from dotenv import load_dotenv
from supabase import create_client

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)
load_dotenv()

supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

supabase = create_client(supabase_url, supabase_key)

def cleanup():
    print("Fetching topics from DB...")
    response = supabase.table("topics").select("id, category, prompt").execute()
    data = response.data
    print(f"Total topics fetched: {len(data)}")
    
    unique_topics = {}
    duplicates = []
    
    for row in data:
        key = (row["category"], row["prompt"])
        if key in unique_topics:
            duplicates.append(row["id"])
        else:
            unique_topics[key] = row
            
    print(f"Unique topics: {len(unique_topics)}, Duplicates to remove: {len(duplicates)}")
    
    if duplicates:
        # Delete duplicates in chunks to avoid URL size limits if list is huge
        chunk_size = 100
        for i in range(0, len(duplicates), chunk_size):
            chunk = duplicates[i:i + chunk_size]
            print(f"Deleting chunk {i // chunk_size + 1}...")
            supabase.table("topics").delete().in_("id", chunk).execute()
        print("Duplicates successfully removed!")
    else:
        print("No duplicates to delete.")

if __name__ == "__main__":
    cleanup()
