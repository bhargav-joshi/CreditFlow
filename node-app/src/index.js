require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./database');
const { rateLimitMiddleware } = require('./rate_limiter');
const { router: authRouter } = require('./auth');
const { router: webhooksRouter } = require('./webhooks');

const app = express();

app.use(cors());

// We need raw body for HMAC signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.use(rateLimitMiddleware);

app.use('/auth', authRouter);
app.use('/webhook', webhooksRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 8001;

async function start() {
  try {
    await sequelize.authenticate();
    await sequelize.sync(); // Create tables if they don't exist
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

start();
