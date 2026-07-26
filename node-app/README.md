<div align="center">
  <img src="https://img.icons8.com/color/96/000000/api-settings.png" alt="CreditFlow Logo" />
  <h1>CreditFlow - Node.js Implementation</h1>
  <p><strong>A Banking API Gateway for High-Volume Financial Transactions (Node.js & Express)</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Express-4.18+-lightgrey?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
    <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
    <img src="https://img.shields.io/badge/PostgreSQL-15-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="Postgres" />
    <img src="https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
  </p>
</div>

---

## 📖 Overview

**CreditFlow Node.js** is the Node.js/Express implementation of the multi-tenant BFSI API gateway. It exactly mirrors the functionality of the primary Python (FastAPI) implementation, handling secure OAuth2/JWT authentication, dynamic Redis-backed rate limiting, and reliable webhook processing for NEFT, RTGS, and UPI transactions.

---

## 🏗 Architecture & Tech Stack

This implementation replicates the asynchronous, highly-scalable architecture of the Python app using the Node.js ecosystem:

| Layer | Technologies |
| :--- | :--- |
| **Backend Framework** | Node.js 18, Express, Zod |
| **Database & ORM** | PostgreSQL 15, Sequelize, pg |
| **Cache & Rate Limiting**| Redis, Custom Lua Scripts |
| **Authentication** | JWT (jsonwebtoken), bcrypt |

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd node-app
npm install
```

### 2. Environment Variables
Ensure you have the environment variables set. The `docker-compose.yml` in the root folder sets these automatically for the container, but for local execution:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/creditflow
REDIS_URL=redis://localhost:6379/0
JWT_SECRET_KEY=your-super-secret-jwt-key
PORT=8001
```

### 3. Run the Application
```bash
# Start with node
npm start

# Or start with nodemon for development
npm run dev
```
The server will run on `http://localhost:8001`.

---

## 📡 API Reference

Below is a quick overview of the available endpoints. All `/webhook/*` endpoints require a valid JWT token with `TENANT` scopes.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/token` | API Key | Authenticate using an API Key to receive Access & Refresh JWTs. |
| `POST` | `/auth/refresh` | JWT (Refresh) | Refresh an expired access token. |
| `POST` | `/webhook/neft` | JWT (Tenant) | Process and log an incoming NEFT transaction webhook. |
| `POST` | `/webhook/rtgs` | JWT (Tenant) | Process and log an incoming RTGS transaction webhook. |
| `POST` | `/webhook/upi` | JWT (Tenant) | Process a UPI webhook (includes strict idempotency checks on `upi_ref_id`). |
| `GET` | `/webhook/events` | JWT (Tenant) | Fetch a paginated list of all received webhook events for the current tenant. |
| `GET` | `/webhook/events/:id`| JWT (Tenant) | Fetch a specific webhook event by its ID. |

*(Note: Webhook endpoints strictly enforce payload validation via `zod` and HMAC SHA-256 signature verification via the `X-Webhook-Signature` header).*

---

## 🧠 Key Design Decisions

1. **Token Bucket Rate Limiting:**
   Implemented using the exact same atomic Lua script evaluated in Redis as the Python version, guaranteeing identical rate limit enforcement.
2. **HMAC Webhook Verification:**
   Incoming webhook payloads are captured as raw buffers in Express to calculate an accurate SHA-256 HMAC digest, which is securely compared against the `X-Webhook-Signature` using `crypto.timingSafeEqual`.
3. **Idempotency for UPI:**
   The UPI endpoint performs strict idempotency checks on `upi_ref_id` before saving to Postgres, ensuring duplicate events return successfully without duplicating entries.
