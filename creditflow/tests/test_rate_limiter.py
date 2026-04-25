import pytest
from app.rate_limiter import RateLimiter
import fakeredis.aioredis as fakeredis

@pytest.mark.asyncio
async def test_within_rate_limit():
    fake_redis = fakeredis.FakeRedis(decode_responses=True)
    limiter = RateLimiter(fake_redis)
    
    # Simulate 10 requests within a second
    for _ in range(10):
        allowed = await limiter.is_allowed("tenant1", "api", 10, 10, 60)
        assert allowed is True

@pytest.mark.asyncio
async def test_rate_limit_exceeded():
    fake_redis = fakeredis.FakeRedis(decode_responses=True)
    limiter = RateLimiter(fake_redis)
    
    # 10 requests
    for _ in range(10):
        await limiter.is_allowed("tenant2", "auth", 10, 0, 60)
        
    # 11th request should fail
    allowed = await limiter.is_allowed("tenant2", "auth", 10, 0, 60)
    assert allowed is False

@pytest.mark.asyncio
async def test_different_tenants_independent_buckets():
    fake_redis = fakeredis.FakeRedis(decode_responses=True)
    limiter = RateLimiter(fake_redis)
    
    for _ in range(10):
        await limiter.is_allowed("tenant3", "auth", 10, 0, 60)
        
    allowed_t3 = await limiter.is_allowed("tenant3", "auth", 10, 0, 60)
    assert allowed_t3 is False
    
    allowed_t4 = await limiter.is_allowed("tenant4", "auth", 10, 0, 60)
    assert allowed_t4 is True
