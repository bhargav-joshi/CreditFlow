const { createClient } = require('redis');
const jwt = require('jsonwebtoken');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/0';
const SECRET_KEY = process.env.JWT_SECRET_KEY || 'your-super-secret-jwt-key';

const redisClient = createClient({ url: REDIS_URL });
redisClient.connect().catch(console.error);

const TOKEN_BUCKET_SCRIPT = `
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
`;

async function isAllowed(tenant_id, endpoint, max_tokens, refill_rate, window) {
  const key = `rate:${tenant_id}:${endpoint}`;
  const now = Date.now() / 1000.0;

  const result = await redisClient.eval(
    TOKEN_BUCKET_SCRIPT,
    {
      keys: [key],
      arguments: [max_tokens.toString(), refill_rate.toString(), now.toString(), window.toString()]
    }
  );
  return result === 1;
}

const rateLimitMiddleware = async (req, res, next) => {
  const path = req.path;
  let max_tokens, refill_rate, window, tier_name;

  if (path.startsWith('/webhook/')) {
    max_tokens = 1000;
    refill_rate = 1000 / 60;
    window = 60;
    tier_name = 'webhook';
  } else if (path.startsWith('/auth/')) {
    max_tokens = 10;
    refill_rate = 10 / 60;
    window = 60;
    tier_name = 'auth';
  } else {
    max_tokens = 100;
    refill_rate = 100 / 60;
    window = 60;
    tier_name = 'api';
  }

  let tenant_id = 'anonymous';
  const authHeader = req.headers['authorization'];
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, SECRET_KEY);
      tenant_id = payload.sub || 'anonymous';
    } catch (e) {
      // Ignored
    }
  }

  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    const parts = apiKey.split(':', 2);
    if (parts.length > 0 && parts[0]) {
      tenant_id = parts[0];
    }
  }

  const allowed = await isAllowed(tenant_id, tier_name, max_tokens, refill_rate, window);

  if (!allowed) {
    return res.status(429).json({ detail: 'Rate limit exceeded' });
  }

  next();
};

module.exports = {
  rateLimitMiddleware,
  redisClient
};
