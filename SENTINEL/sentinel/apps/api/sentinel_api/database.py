from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from sentinel_api.config import get_settings


def utc_now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    auth_subject: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    settings: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    privacy_mode: Mapped[str] = mapped_column(String(50), default="balanced")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    assets: Mapped[list[AssetModel]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    identities: Mapped[list[IdentityModel]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    devices: Mapped[list[DeviceModel]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    findings: Mapped[list[FindingModel]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    incidents: Mapped[list[IncidentModel]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    action_proposals: Mapped[list[ActionProposalModel]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    audit_events: Mapped[list[AuditEventModel]] = relationship(back_populates="actor_user", cascade="all, delete-orphan")


class AssetModel(Base):
    __tablename__ = "assets"

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    type: Mapped[str] = mapped_column(String(50), index=True)
    label: Mapped[str] = mapped_column(String(255))
    criticality: Mapped[int] = mapped_column(Integer, default=50)
    owner_id: Mapped[str] = mapped_column(String(26), ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(50), default="active")
    model_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    owner: Mapped[UserModel] = relationship(back_populates="assets")
    identities: Mapped[list[IdentityModel]] = relationship(back_populates="asset", cascade="all, delete-orphan")


class IdentityModel(Base):
    __tablename__ = "identities"

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    asset_id: Mapped[str] = mapped_column(String(26), ForeignKey("assets.id"), index=True)
    provider: Mapped[str] = mapped_column(String(100))
    protected_identifier_hash: Mapped[str] = mapped_column(String(64), index=True)
    mfa_state: Mapped[bool | None] = mapped_column(default=None)
    model_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    asset: Mapped[AssetModel] = relationship(back_populates="identities")
    owner: Mapped[UserModel] = relationship(back_populates="identities")


class DeviceModel(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    platform: Mapped[str] = mapped_column(String(100))
    agent_id: Mapped[str | None] = mapped_column(String(26), nullable=True, index=True)
    posture_summary: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    model_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    owner: Mapped[UserModel] = relationship(back_populates="devices")


class IndicatorModel(Base):
    __tablename__ = "indicators"

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    type: Mapped[str] = mapped_column(String(50), index=True)
    normalized_value_hash: Mapped[str] = mapped_column(String(64), index=True)
    reputation: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    model_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)

    __table_args__ = (Index("ix_indicators_type_hash", "type", "normalized_value_hash"),)


class EvidenceModel(Base):
    __tablename__ = "evidence"

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    source: Mapped[str] = mapped_column(String(255))
    source_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    confidence: Mapped[float] = mapped_column(default=0.5)
    normalized_payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    classification: Mapped[str] = mapped_column(String(50), default="sensitive")


class FindingModel(Base):
    __tablename__ = "findings"

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    detector: Mapped[str] = mapped_column(String(100), index=True)
    severity: Mapped[str] = mapped_column(String(20), index=True)
    confidence: Mapped[float] = mapped_column(default=0.5)
    status: Mapped[str] = mapped_column(String(20), default="new", index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_refs: Mapped[list[str]] = mapped_column(JSON, default=list)
    asset_refs: Mapped[list[str]] = mapped_column(JSON, default=list)
    indicator_refs: Mapped[list[str]] = mapped_column(JSON, default=list)
    risk_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    model_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    owner_id: Mapped[str] = mapped_column(String(26), ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    owner: Mapped[UserModel] = relationship(back_populates="findings")


class RelationshipModel(Base):
    __tablename__ = "relationships"

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    source_entity: Mapped[str] = mapped_column(String(26), index=True)
    relation_type: Mapped[str] = mapped_column(String(50), index=True)
    target_entity: Mapped[str] = mapped_column(String(26), index=True)
    confidence: Mapped[float] = mapped_column(default=0.5)
    model_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (Index("ix_relationships_source_type_target", "source_entity", "relation_type", "target_entity"),)


class IncidentModel(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    severity: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    finding_refs: Mapped[list[str]] = mapped_column(JSON, default=list)
    asset_refs: Mapped[list[str]] = mapped_column(JSON, default=list)
    timeline: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    owner_id: Mapped[str] = mapped_column(String(26), ForeignKey("users.id"), index=True)
    model_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    owner: Mapped[UserModel] = relationship(back_populates="incidents")


class ActionProposalModel(Base):
    __tablename__ = "action_proposals"

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    action_type: Mapped[str] = mapped_column(String(100))
    target: Mapped[str] = mapped_column(String(255))
    risk_class: Mapped[str] = mapped_column(String(1))
    required_approval: Mapped[bool] = mapped_column(default=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    impact_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    dry_run_result: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    approval_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verifier_result: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    model_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    owner_id: Mapped[str] = mapped_column(String(26), ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    owner: Mapped[UserModel] = relationship(back_populates="action_proposals")


class AuditEventModel(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    actor: Mapped[str] = mapped_column(String(255), index=True)
    event_type: Mapped[str] = mapped_column(String(100), index=True)
    object_ref: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    previous_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    event_hash: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    actor_user_id: Mapped[str | None] = mapped_column(String(26), ForeignKey("users.id"), nullable=True, index=True)

    actor_user: Mapped[UserModel | None] = relationship(back_populates="audit_events")

    __table_args__ = (Index("ix_audit_events_actor_timestamp", "actor", "timestamp"),)


engine: Any = None
async_session_maker: Any = None


def create_engine_and_session() -> None:
    global engine, async_session_maker
    settings = get_settings()
    engine = create_async_engine(
        settings.database_url,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        echo=settings.debug,
    )
    async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    if async_session_maker is None:
        create_engine_and_session()
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    if engine is None:
        create_engine_and_session()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    global engine
    if engine:
        await engine.dispose()
        engine = None