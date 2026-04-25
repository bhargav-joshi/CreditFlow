<div align="center">
  <img src="https://img.icons8.com/color/96/000000/api-settings.png" alt="CreditFlow Logo" />
  <h1>CreditFlow</h1>
  <p><strong>A Banking API Gateway for High-Volume Financial Transactions</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Python-3.11-blue?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
    <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
    <img src="https://img.shields.io/badge/PostgreSQL-15-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="Postgres" />
    <img src="https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
    <img src="https://img.shields.io/badge/coverage-95%25-brightgreen?style=for-the-badge" alt="Coverage" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
  </p>
</div>

---

## 📖 Overview

**CreditFlow** is a multi-tenant BFSI (Banking, Financial Services, and Insurance) API gateway built with FastAPI. It handles secure OAuth2/JWT authentication, dynamic Redis-backed rate limiting, and reliable webhook processing for NEFT, RTGS, and UPI transactions.

This project is built to handle concurrent webhook traffic securely, acting as the perfect backend showcase for processing financial data.

---


<img width="1470" height="641" alt="image" src="https://github.com/user-attachments/assets/c3906377-aca2-42d1-93e9-db0cb49cf97e" />


## 🏗 Architecture

CreditFlow relies on an asynchronous, highly-scalable architecture:
- **FastAPI** drives the API layer asynchronously for maximum throughput.
- **PostgreSQL** handles structured storage for tenants and webhook event logs using SQLAlchemy and asyncpg.
- **Redis** manages state for an atomic Token Bucket rate-limiting algorithm implemented via Lua scripts.
- **Security** is strictly enforced via JWT-based RBAC (Role-Based Access Control) and SHA-256 HMAC signature verification for all incoming webhooks.

### 🛠 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend Framework** | Python 3.11, FastAPI, Pydantic |
| **Database & ORM** | PostgreSQL 15, SQLAlchemy, asyncpg |
| **Cache & Rate Limiting**| Redis, Custom Lua Scripts |
| **Authentication** | JWT (python-jose), Passlib (bcrypt), OAuth2 |
| **DevOps & Testing** | Docker, Docker Compose, Pytest, Pytest-Asyncio |

---

## 🚀 Quick Start

Get the application running locally in under 2 minutes using Docker Compose.

### 1. Clone & Configure
```bash
# Clone the repository
git clone https://github.com/bhargav-joshi/creditflow.git
cd creditflow

# Configure environment variables
cp .env.example .env
```

### 2. Run with Docker
```bash
docker-compose up --build
```

### 3. Test the Application
Once the containers are running, you can retrieve a JWT token and test a webhook endpoint:

```bash
# Get an Access Token using an API Key
curl -X POST http://localhost:8000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"api_key": "tenant_id:secret"}'
```

📚 **Interactive Documentation:** Access the auto-generated Swagger UI at [http://localhost:8000/docs](http://localhost:8000/docs) to visually test all endpoints.

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

*(Note: Webhook endpoints strictly enforce payload validation via Pydantic and HMAC SHA-256 signature verification via the `X-Webhook-Signature` header).*

---

## 🧠 Key Design Decisions

1. **Token Bucket Rate Limiting (over Sliding Window):**
   Webhook traffic often comes in unpredictable bursts. The token bucket algorithm gracefully handles these sudden traffic spikes while strictly enforcing limits over time. We implemented this using a single, atomic Lua script evaluated in Redis to eliminate race conditions.
2. **HMAC Webhook Verification:**
   To guarantee that incoming financial data is not spoofed, every webhook requires an `X-Webhook-Signature` header. The backend independently calculates the SHA-256 HMAC of the raw payload using the tenant's secret and compares it securely (`hmac.compare_digest`) against the provided signature.
3. **Idempotency for UPI:**
   Network failures can result in duplicate webhook deliveries. For the UPI endpoint, we enforce strict idempotency by verifying the `upi_ref_id` before processing, ensuring duplicate events return a `200 OK` without duplicating database entries.

---

## 🧪 Testing

The codebase includes an extensive suite of integration and unit tests using `pytest` and `fakeredis`.

```bash
# To run the test suite locally with coverage report
pytest --cov=app --cov-report=term-missing
```

---

