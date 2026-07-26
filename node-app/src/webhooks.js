const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const { WebhookEvent } = require('./models');
const { getCurrentTenant } = require('./auth');

const router = express.Router();

const NEFTPayload = z.object({
  transaction_id: z.string(),
  sender_account: z.string(),
  receiver_account: z.string(),
  amount: z.number(),
  bank_ref: z.string(),
  timestamp: z.string().datetime(),
});

const RTGSPayload = z.object({
  transaction_id: z.string(),
  sender_ifsc: z.string(),
  receiver_ifsc: z.string(),
  amount: z.number(),
  purpose_code: z.string(),
  utr_number: z.string(),
  timestamp: z.string().datetime(),
});

const UPIPayload = z.object({
  transaction_id: z.string(),
  vpa_sender: z.string(),
  vpa_receiver: z.string(),
  amount: z.number(),
  upi_ref_id: z.string(),
  status: z.string(),
  timestamp: z.string().datetime(),
});

const verifySignature = (req, res, next) => {
  const signature = req.headers['x-webhook-signature'];
  if (!signature) {
    return res.status(401).json({ detail: 'Missing signature' });
  }

  const rawBody = req.rawBody; // Assumes we set this in index.js
  const tenant = req.tenant;

  const expectedSignature = crypto
    .createHmac('sha256', tenant.webhook_secret)
    .update(rawBody)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))) {
    return res.status(401).json({ detail: 'Invalid signature' });
  }

  next();
};

const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(422).json({ detail: error.errors });
  }
};

router.post('/neft', getCurrentTenant(['TENANT']), verifySignature, validateBody(NEFTPayload), async (req, res) => {
  const tenant = req.tenant;
  const payload = req.body;

  const event = await WebhookEvent.create({
    tenant_id: tenant.id,
    event_type: 'NEFT',
    payload: payload,
    status: 'received'
  });

  res.json({ event_id: event.id, status: 'received' });
});

router.post('/rtgs', getCurrentTenant(['TENANT']), verifySignature, validateBody(RTGSPayload), async (req, res) => {
  const tenant = req.tenant;
  const payload = req.body;

  const event = await WebhookEvent.create({
    tenant_id: tenant.id,
    event_type: 'RTGS',
    payload: payload,
    status: 'received'
  });

  res.json({ event_id: event.id, status: 'received' });
});

router.post('/upi', getCurrentTenant(['TENANT']), verifySignature, validateBody(UPIPayload), async (req, res) => {
  const tenant = req.tenant;
  const payload = req.body;

  const existingEvent = await WebhookEvent.findOne({
    where: {
      tenant_id: tenant.id,
      event_type: 'UPI'
    }
  });

  // Since we only query by tenant and event_type, this checks if any upi_ref_id matches
  // A better approach (matching the python one) is to check if upi_ref_id matches
  const events = await WebhookEvent.findAll({
    where: {
      tenant_id: tenant.id,
      event_type: 'UPI'
    }
  });

  for (const e of events) {
    if (e.payload && e.payload.upi_ref_id === payload.upi_ref_id) {
      return res.json({ event_id: e.id, status: 'received', message: 'Idempotent response' });
    }
  }

  const event = await WebhookEvent.create({
    tenant_id: tenant.id,
    event_type: 'UPI',
    payload: payload,
    status: 'received'
  });

  res.json({ event_id: event.id, status: 'received' });
});

router.get('/events', getCurrentTenant(['TENANT']), async (req, res) => {
  const tenant = req.tenant;
  const { event_type, status, limit = 10, offset = 0 } = req.query;

  const where = { tenant_id: tenant.id };
  if (event_type) where.event_type = event_type;
  if (status) where.status = status;

  const events = await WebhookEvent.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10)
  });

  res.json({ data: events, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
});

router.get('/events/:event_id', getCurrentTenant(['TENANT']), async (req, res) => {
  const tenant = req.tenant;
  const event = await WebhookEvent.findOne({
    where: {
      id: req.params.event_id,
      tenant_id: tenant.id
    }
  });

  if (!event) {
    return res.status(404).json({ detail: 'Event not found' });
  }

  res.json(event);
});

module.exports = {
  router
};
