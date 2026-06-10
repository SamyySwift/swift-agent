import os

from dotenv import load_dotenv

load_dotenv()  # take environment variables from .env.


SUPABASE_ACCESS_TOKEN = os.getenv("SUPABASE_ACCESS_TOKEN", None)
CAL_API_KEY = os.getenv("CAL_API_KEY", None)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", None)
LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY", None)
REDIS_URI = os.getenv("REDIS_URI", None)
GROQ_API_KEY = os.getenv("GROQ_API_KEY", None)
DATABASE_URI = os.getenv("DATABASE_URI", None)


required_env_vars = [
    "SUPABASE_ACCESS_TOKEN",
    "CAL_API_KEY",
    "OPENAI_API_KEY",
    "DATABASE_URI"
]

for var in required_env_vars:
    if not var:
        raise ValueError(f"Missing required environment variable: {var}")
