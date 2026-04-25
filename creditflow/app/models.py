import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, JSON
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    api_key = Column(String, unique=True, nullable=False) # Hashed
    webhook_secret = Column(String, nullable=False) # Raw string for HMAC
    is_active = Column(Boolean, default=True)

    def __repr__(self):
        return f"<Tenant(id={self.id}, name={self.name}, is_active={self.is_active})>"

class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    status = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<WebhookEvent(id={self.id}, event_type={self.event_type}, status={self.status})>"
