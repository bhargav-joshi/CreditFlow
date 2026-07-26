import os
import time
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import redis.asyncio as redis
from jose import jwt, JWTError

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-super-secret-jwt-key")
ALGORITHM = "HS256"

redis_client = redis.from_url(REDIS_URL, decode_responses=True)

TOKEN_BUCKET_SCRIPT = """
local key = KEYS[1]
local max_tokens = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local window = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = max_tokens
local last_refill = now

if bucket[1] then
    tokens = tonumber(bucket[1])
    last_refill = tonumber(bucket[2])
end

local time_passed = math.max(0, now - last_refill)
local tokens_to_add = math.floor(time_passed * refill_rate)

tokens = math.min(max_tokens, tokens + tokens_to_add)

if tokens > 0 then
    tokens = tokens - 1
    last_refill = now
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
    redis.call('EXPIRE', key, window)
    return 1
else
    return 0
end
"""

class RateLimiter:
    def __init__(self, redis_client):
        self.redis = redis_client

    async def is_allowed(self, tenant_id: str, endpoint: str, max_tokens: int, refill_rate: float, window: int) -> bool:
        key = f"rate:{tenant_id}:{endpoint}"
        now = time.time()
        
        result = await self.redis.eval(
            TOKEN_BUCKET_SCRIPT,
            1,
            key,
            max_tokens,
            refill_rate,
            now,
            window
        )
        return result == 1

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.limiter = RateLimiter(redis_client)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if path.startswith("/webhook/"):
            max_tokens = 1000
            refill_rate = 1000 / 60
            window = 60
            tier_name = "webhook"
        elif path.startswith("/auth/"):
            max_tokens = 10
            refill_rate = 10 / 60
            window = 60
            tier_name = "auth"
        else:
            max_tokens = 100
            refill_rate = 100 / 60
            window = 60
            tier_name = "api"

        tenant_id = "anonymous"
        auth_header = request.headers.get("Authorization")
        
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                tenant_id = payload.get("sub", "anonymous")
            except JWTError:
                pass
        
        api_key = request.headers.get("x-api-key")
        if api_key:
            try:
                tenant_id, _ = api_key.split(":", 1)
            except ValueError:
                pass

        allowed = await self.limiter.is_allowed(tenant_id, tier_name, max_tokens, refill_rate, window)
        
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
                headers={"Retry-After": str(window)}
            )
            
        response = await call_next(request)
        return response
