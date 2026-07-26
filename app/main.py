from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app.models import Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Dispose engine on shutdown
    await engine.dispose()

from app.auth import router as auth_router
from app.webhooks import router as webhooks_router
from app.rate_limiter import RateLimitMiddleware

app = FastAPI(
    title="CreditFlow",
    description="A multi-tenant BFSI API gateway",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(webhooks_router)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
