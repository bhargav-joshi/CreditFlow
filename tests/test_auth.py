import pytest
from app.models import Tenant
from app.auth import get_password_hash

@pytest.mark.asyncio
async def test_get_token_valid_api_key(client, db):
    # Create tenant
    tenant = Tenant(name="Test", api_key=get_password_hash("secret"), webhook_secret="secret")
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)

    response = await client.post("/auth/token", json={"api_key": f"{tenant.id}:secret"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data

@pytest.mark.asyncio
async def test_get_token_invalid_api_key(client, db):
    response = await client.post("/auth/token", json={"api_key": "invalid:secret"})
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_protected_endpoint_no_token(client):
    response = await client.get("/webhook/events")
    assert response.status_code == 401
