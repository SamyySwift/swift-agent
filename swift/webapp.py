"""
Custom FastAPI app for LangGraph server.
Mounts the file upload router alongside the default LangGraph endpoints.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from swift.upload import router as upload_router

app = FastAPI(title="Swift Agent")

# Allow the Next.js frontend to call the upload endpoint
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "https://swift-agent-five.vercel.app/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
