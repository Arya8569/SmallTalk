import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

print(f"Testing connection to: {supabase_url}")

if not supabase_url or not supabase_key:
    print("Error: Missing Supabase URL or Key in environment variables.")
    exit(1)

try:
    supabase = create_client(supabase_url, supabase_key)
    # Try fetching a single row from the topics table
    response = supabase.table("topics").select("id").limit(1).execute()
    print("Success! Successfully connected to Supabase and read the 'topics' table.")
    print("Data:", response.data)
except Exception as e:
    print("\n--- CONNECTION FAILED ---")
    print(f"Error Type: {type(e)}")
    print(f"Error Details: {e}")
