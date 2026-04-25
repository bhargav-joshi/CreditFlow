# CreditFlow — Banking API Gateway

![Python 3.11](https://img.shields.io/badge/Python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)

A multi-tenant BFSI API gateway handling OAuth2/JWT auth, Redis rate limiting, and NEFT/RTGS/UPI webhook processing. Perfect backend showcase for handling high-volume concurrent webhook traffic securely.

## Architecture
CreditFlow uses an asynchronous architecture with **FastAPI** as the framework, **PostgreSQL** for persistence, and **Redis** for in-memory token bucket rate-limiting. Webhook requests are validated using HMAC SHA-256 signatures and rate-limited dynamically per tier.

### Tech Stack
| Component | Technology |
| --- | --- |
| Backend | Python 3.11, FastAPI, Pydantic |
| Database | PostgreSQL 15, asyncpg, SQLAlchemy |
| Cache & Rate Limiting | Redis, Lua Scripts |
| DevOps & Testing | Docker, Docker Compose, Pytest, pytest-asyncio |

## Quick Start

1. Clone the repository and configure `.env`:
```bash
cp .env.example .env
```

2. Start the services using Docker Compose:
```bash
docker-compose up --build
```

3. Test endpoints with cURL:
```bash
curl -X POST http://localhost:8000/auth/token -H "Content-Type: application/json" -d '{"api_key": "tenant_id:secret"}'
```

Access the auto-generated Swagger documentation at `http://localhost:8000/docs`.

## API Reference
| Method | Path | Auth Required | Description |
| --- | --- | --- | --- |
| POST | `/auth/token` | API Key | Get JWT Access and Refresh tokens |
| POST | `/auth/refresh` | None | Refresh an access token |
| POST | `/webhook/neft` | JWT (Tenant) | Process NEFT webhook |
| POST | `/webhook/rtgs` | JWT (Tenant) | Process RTGS webhook |
| POST | `/webhook/upi` | JWT (Tenant) | Process UPI webhook with idempotency |
| GET | `/webhook/events` | JWT (Tenant) | List paginated webhook events |

## Key Design Decisions
- **Token Bucket over Sliding Window:** We chose the token bucket algorithm for rate limiting (using atomic Lua scripts in Redis) because it handles bursts well, which is common in webhook processing.
- **HMAC Signature Verification:** Prevents unauthorized parties from spoofing webhook payloads by verifying the payload against a shared secret via SHA-256 HMAC.
