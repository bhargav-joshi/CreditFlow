const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Tenant } = require('./models');

const SECRET_KEY = process.env.JWT_SECRET_KEY || 'your-super-secret-jwt-key';
const ACCESS_TOKEN_EXPIRE_MINUTES = 30;
const REFRESH_TOKEN_EXPIRE_DAYS = 7;

const router = express.Router();

function createAccessToken(data, expiresIn = ACCESS_TOKEN_EXPIRE_MINUTES * 60) {
  return jwt.sign(data, SECRET_KEY, { expiresIn });
}

function createRefreshToken(data) {
  const payload = { ...data, type: 'refresh' };
  return jwt.sign(payload, SECRET_KEY, { expiresIn: `${REFRESH_TOKEN_EXPIRE_DAYS}d` });
}

async function verifyApiKey(apiKey) {
  if (!apiKey) return null;
  const parts = apiKey.split(':', 2);
  if (parts.length !== 2) return null;
  const [tenantId, secret] = parts;

  const tenant = await Tenant.findOne({ where: { id: tenantId } });
  if (!tenant || !tenant.is_active) return null;

  const match = await bcrypt.compare(secret, tenant.api_key);
  if (!match) return null;

  return tenant;
}

const getCurrentTenant = (scopes = []) => async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Not authenticated' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, SECRET_KEY);
    const tenantId = payload.sub;
    const role = payload.role;
    const tokenType = payload.type || 'access';

    if (!tenantId || tokenType !== 'access') {
      return res.status(401).json({ detail: 'Invalid token' });
    }

    const tenant = await Tenant.findOne({ where: { id: tenantId } });
    if (!tenant || !tenant.is_active) {
      return res.status(401).json({ detail: 'Tenant not found or inactive' });
    }

    if (scopes.length > 0 && !scopes.includes(role) && role !== 'ADMIN') {
      return res.status(403).json({ detail: 'Not enough permissions' });
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    return res.status(401).json({ detail: 'Could not validate credentials' });
  }
};

router.post('/token', async (req, res) => {
  const { api_key } = req.body;
  if (!api_key) {
    return res.status(400).json({ detail: 'API Key missing' });
  }

  const tenant = await verifyApiKey(api_key);
  if (!tenant) {
    return res.status(401).json({ detail: 'Incorrect API Key' });
  }

  const payload = { sub: tenant.id, role: 'TENANT' };
  const access_token = createAccessToken(payload);
  const refresh_token = createRefreshToken(payload);

  res.json({
    access_token,
    refresh_token,
    token_type: 'bearer'
  });
});

router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ detail: 'Refresh token missing' });
  }

  try {
    const payload = jwt.verify(refresh_token, SECRET_KEY);
    const tenantId = payload.sub;
    const role = payload.role;
    const tokenType = payload.type;

    if (!tenantId || tokenType !== 'refresh') {
      return res.status(401).json({ detail: 'Invalid token type' });
    }

    const tenant = await Tenant.findOne({ where: { id: tenantId } });
    if (!tenant || !tenant.is_active) {
      return res.status(401).json({ detail: 'Tenant not found or inactive' });
    }

    const newPayload = { sub: tenant.id, role: role };
    const access_token = createAccessToken(newPayload);
    const new_refresh_token = createRefreshToken(newPayload);

    res.json({
      access_token,
      refresh_token: new_refresh_token,
      token_type: 'bearer'
    });
  } catch (error) {
    return res.status(401).json({ detail: 'Could not validate credentials' });
  }
});

module.exports = {
  router,
  getCurrentTenant
};
