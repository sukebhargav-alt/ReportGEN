from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import os
import sys
from dotenv import load_dotenv

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from modules.cpet.router import router as cpet_router
from modules.profiling.router import router as profiling_router
from modules.auth.router import router as auth_router
from modules.athletes.router import router as athletes_router

# ===============================
# INIT
# ===============================

load_dotenv()
load_dotenv("Backend.env")

app = FastAPI()

frontend_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "*").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===============================
# INCLUDE ROUTERS
# ===============================

app.include_router(cpet_router, tags=["CPET"])
app.include_router(profiling_router, tags=["Profiling"])
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(athletes_router, prefix="/athletes", tags=["Athletes"])

@app.get("/")
async def root():
    return {"message": "Acrophase Backend API is running"}
