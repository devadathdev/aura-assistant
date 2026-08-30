from __future__ import annotations

from datetime import datetime
from typing import Any

from sentinel_schemas import (
    AuditEvent,
    DataClassification,
    EventEnvelope,
    generate_ulid,
    utc_now,
)
from sentinel_security import AuditChain
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class AuditService:
    def __init__(self, chain_key: bytes | None = None):
        self.chain = AuditChain(chain_key or b"sentinel-audit-chain-key")
        self._chain_key = chain_key or b"sentinel-audit-chain-key"

    async def log_event(
        self,
        session: AsyncSession,
        actor: str,
        event_type: str,
        object_ref: str | None = None,
        payload: dict[str, Any] | None = None,
        actor_user_id: str | None = None,
        classification: DataClassification = DataClassification.INTERNAL,
    ) -> AuditEvent:
        from sentinel_api.database import AuditEventModel

        previous_hash = await self._get_last_hash(session, actor_user_id)

        event = AuditEvent(
            id=generate_ulid(),
            actor=actor,
            event_type=event_type,
            object_ref=object_ref,
            timestamp=utc_now(),
            previous_hash=previous_hash,
            payload=payload or {},
        )
        event.event_hash = event.compute_hash()

        db_event = AuditEventModel(
            id=event.id,
            actor=event.actor,
            event_type=event.event_type,
            object_ref=event.object_ref,
            timestamp=event.timestamp,
            previous_hash=event.previous_hash,
            event_hash=event.event_hash,
            payload=event.payload,
            actor_user_id=actor_user_id,
        )
        session.add(db_event)
        await session.flush()

        return event

    async def log_envelope(self, session: AsyncSession, envelope: EventEnvelope) -> AuditEvent:
        return await self.log_event(
            session=session,
            actor=envelope.source,
            event_type=envelope.event_type.value,
            object_ref=envelope.subject_refs[0] if envelope.subject_refs else None,
            payload=envelope.payload,
            classification=envelope.classification,
        )

    async def _get_last_hash(self, session: AsyncSession, actor_user_id: str | None) -> str | None:
        from sentinel_api.database import AuditEventModel
        query = select(AuditEventModel.event_hash).order_by(AuditEventModel.timestamp.desc())
        if actor_user_id:
            query = query.where(AuditEventModel.actor_user_id == actor_user_id)
        query = query.limit(1)
        result = await session.execute(query)
        return result.scalar_one_or_none()

    async def query_events(
        self,
        session: AsyncSession,
        actor: str | None = None,
        event_type: str | None = None,
        object_ref: str | None = None,
        actor_user_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditEvent]:
        from sentinel_api.database import AuditEventModel

        query = select(AuditEventModel).order_by(AuditEventModel.timestamp.desc())

        if actor:
            query = query.where(AuditEventModel.actor == actor)
        if event_type:
            query = query.where(AuditEventModel.event_type == event_type)
        if object_ref:
            query = query.where(AuditEventModel.object_ref == object_ref)
        if actor_user_id:
            query = query.where(AuditEventModel.actor_user_id == actor_user_id)
        if start_time:
            query = query.where(AuditEventModel.timestamp >= start_time)
        if end_time:
            query = query.where(AuditEventModel.timestamp <= end_time)

        query = query.limit(limit).offset(offset)
        result = await session.execute(query)
        events = result.scalars().all()

        return [AuditEvent.model_validate(e.__dict__) for e in events]

    async def verify_chain(self, session: AsyncSession, actor_user_id: str | None = None) -> bool:
        from sentinel_api.database import AuditEventModel

        query = select(AuditEventModel).order_by(AuditEventModel.timestamp.asc())
        if actor_user_id:
            query = query.where(AuditEventModel.actor_user_id == actor_user_id)

        result = await session.execute(query)
        events = result.scalars().all()

        event_dicts = [
            {
                "event_id": e.id,
                "actor": e.actor,
                "event_type": e.event_type,
                "object_ref": e.object_ref,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                "previous_hash": e.previous_hash,
                "event_hash": e.event_hash,
                "payload": e.payload,
            }
            for e in events
        ]

        return self.chain.verify_chain(event_dicts)

    async def export_events(
        self,
        session: AsyncSession,
        format: str = "json",
        **query_params,
    ) -> str:
        events = await self.query_events(session, **query_params)

        if format == "json":
            import json
            return json.dumps([e.model_dump() for e in events], indent=2, default=str)
        elif format == "csv":
            import csv
            import io
            output = io.StringIO()
            if events:
                writer = csv.DictWriter(output, fieldnames=events[0].model_dump().keys())
                writer.writeheader()
                for event in events:
                    writer.writerow(event.model_dump())
            return output.getvalue()
        else:
            raise ValueError(f"Unsupported export format: {format}")


audit_service = AuditService()