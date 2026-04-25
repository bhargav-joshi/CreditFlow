import hmac
import hashlib
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models import Tenant, WebhookEvent
from app.auth import get_current_tenant

router = APIRouter(prefix="/webhook", tags=["webhooks"])

class NEFTPayload(BaseModel):
    transaction_id: str
    sender_account: str
    receiver_account: str
    amount: float
    bank_ref: str
    timestamp: datetime

class RTGSPayload(BaseModel):
    transaction_id: str
    sender_ifsc: str
    receiver_ifsc: str
    amount: float
    purpose_code: str
    utr_number: str
    timestamp: datetime

class UPIPayload(BaseModel):
    transaction_id: str
    vpa_sender: str
    vpa_receiver: str
    amount: float
    upi_ref_id: str
    status: str
    timestamp: datetime

async def verify_signature(request: Request, tenant: Tenant):
    signature = request.headers.get("X-Webhook-Signature")
    if not signature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing signature")
        
    body = await request.body()
    expected_signature = hmac.new(
        tenant.webhook_secret.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature"
        )

@router.post("/neft")
async def handle_neft(
    request: Request,
    payload: NEFTPayload,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    await verify_signature(request, tenant)
    
    event = WebhookEvent(
        tenant_id=tenant.id,
        event_type="NEFT",
        payload=json.loads(payload.json()),
        status="received"
    )
    
    db.add(event)
    await db.commit()
    await db.refresh(event)
    
    return {"event_id": event.id, "status": "received"}

@router.post("/rtgs")
async def handle_rtgs(
    request: Request,
    payload: RTGSPayload,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    await verify_signature(request, tenant)
    
    event = WebhookEvent(
        tenant_id=tenant.id,
        event_type="RTGS",
        payload=json.loads(payload.json()),
        status="received"
    )
    
    db.add(event)
    await db.commit()
    await db.refresh(event)
    
    return {"event_id": event.id, "status": "received"}

@router.post("/upi")
async def handle_upi(
    request: Request,
    payload: UPIPayload,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    await verify_signature(request, tenant)
    
    # Check idempotency
    stmt = select(WebhookEvent).where(
        WebhookEvent.tenant_id == tenant.id,
        WebhookEvent.event_type == "UPI"
    )
    result = await db.execute(stmt)
    events = result.scalars().all()
    
    for e in events:
        if e.payload.get("upi_ref_id") == payload.upi_ref_id:
            return {"event_id": e.id, "status": "received", "message": "Idempotent response"}

    event = WebhookEvent(
        tenant_id=tenant.id,
        event_type="UPI",
        payload=json.loads(payload.json()),
        status="received"
    )
    
    db.add(event)
    await db.commit()
    await db.refresh(event)
    
    return {"event_id": event.id, "status": "received"}

@router.get("/events")
async def list_events(
    event_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 10,
    offset: int = 0,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(WebhookEvent).where(WebhookEvent.tenant_id == tenant.id)
    if event_type:
        stmt = stmt.where(WebhookEvent.event_type == event_type)
    if status:
        stmt = stmt.where(WebhookEvent.status == status)
        
    stmt = stmt.order_by(desc(WebhookEvent.created_at)).limit(limit).offset(offset)
    
    result = await db.execute(stmt)
    events = result.scalars().all()
    
    return {"data": events, "limit": limit, "offset": offset}

@router.get("/events/{event_id}")
async def get_event(
    event_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(WebhookEvent).where(
            WebhookEvent.id == event_id,
            WebhookEvent.tenant_id == tenant.id
        )
    )
    event = result.scalars().first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    return event
