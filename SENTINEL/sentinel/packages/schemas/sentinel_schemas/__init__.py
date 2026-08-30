from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from ulid import ULID
from pydantic import BaseModel, Field, field_validator, model_validator


class EventType(str, Enum):
    FINDING_CREATED = "finding.created"
    FINDING_UPDATED = "finding.updated"
    FINDING_RESOLVED = "finding.resolved"
    ASSET_CREATED = "asset.created"
    ASSET_UPDATED = "asset.updated"
    IDENTITY_CREATED = "identity.created"
    IDENTITY_UPDATED = "identity.updated"
    DEVICE_CREATED = "device.created"
    DEVICE_UPDATED = "device.updated"
    INDICATOR_ENRICHED = "indicator.enriched"
    INCIDENT_CREATED = "incident.created"
    INCIDENT_UPDATED = "incident.updated"
    ACTION_PROPOSED = "action.proposed"
    ACTION_APPROVED = "action.approved"
    ACTION_REJECTED = "action.rejected"
    ACTION_EXECUTED = "action.executed"
    ACTION_VERIFIED = "action.verified"
    AUDIT_EVENT = "audit.event"
    PHISHING_ANALYZED = "phishing.analyzed"
    BREACH_DETECTED = "breach.detected"


class Severity(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class ActionClass(str, Enum):
    READ_ONLY = "A"
    REVERSIBLE_LOW_IMPACT = "B"
    ACCOUNT_SYSTEM_CHANGE = "C"
    DESTRUCTIVE_IRREVERSIBLE = "D"


class FindingStatus(str, Enum):
    NEW = "new"
    TRIAGED = "triaged"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"
    DISMISSED = "dismissed"


class IncidentStatus(str, Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    CONTAINED = "contained"
    RECOVERING = "recovering"
    CLOSED = "closed"


class ActionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTING = "executing"
    EXECUTED = "executed"
    FAILED = "failed"
    VERIFIED = "verified"


class DataClassification(str, Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    SENSITIVE = "sensitive"
    RESTRICTED = "restricted"


class RelationType(str, Enum):
    USES_IDENTITY = "uses_identity"
    LOGGED_IN_FROM = "logged_in_from"
    EXPOSED_IN = "exposed_in"
    RESOLVES_TO = "resolves_to"
    COMMUNICATED_WITH = "communicated_with"
    AFFECTS = "affects"
    DERIVED_FROM = "derived_from"
    PART_OF_INCIDENT = "part_of_incident"


class IndicatorType(str, Enum):
    URL = "url"
    DOMAIN = "domain"
    IP = "ip"
    HASH = "hash"
    EMAIL = "email"
    PHONE = "phone"
    FILE_PATH = "file_path"
    REGISTRY_KEY = "registry_key"


class AssetType(str, Enum):
    ACCOUNT = "account"
    DEVICE = "device"
    NETWORK = "network"
    APPLICATION = "application"
    IDENTIFIER = "identifier"


def generate_ulid() -> str:
    return str(ULID())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def hash_value(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:32]


class BaseSchema(BaseModel):
    model_config = {"extra": "forbid", "validate_assignment": True}

    @model_validator(mode="after")
    def validate_no_null_bytes(self) -> "BaseSchema":
        for field_name, value in self.__dict__.items():
            if isinstance(value, str) and "\x00" in value:
                raise ValueError(f"Field {field_name} contains null bytes")
        return self


class EventEnvelope(BaseSchema):
    event_id: str = Field(default_factory=generate_ulid)
    event_type: EventType
    schema_version: int = 1
    occurred_at: datetime = Field(default_factory=utc_now)
    ingested_at: datetime = Field(default_factory=utc_now)
    source: str
    subject_refs: List[str] = Field(default_factory=list)
    classification: DataClassification = DataClassification.INTERNAL
    payload: Dict[str, Any]
    previous_hash: Optional[str] = None
    event_hash: Optional[str] = None

    def compute_hash(self) -> str:
        data = {
            "event_id": self.event_id,
            "event_type": self.event_type.value,
            "schema_version": self.schema_version,
            "occurred_at": self.occurred_at.isoformat(),
            "ingested_at": self.ingested_at.isoformat(),
            "source": self.source,
            "subject_refs": self.subject_refs,
            "classification": self.classification.value,
            "payload": self.payload,
            "previous_hash": self.previous_hash,
        }
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


class User(BaseSchema):
    id: str = Field(default_factory=generate_ulid)
    auth_subject: str
    settings: Dict[str, Any] = Field(default_factory=dict)
    privacy_mode: str = "balanced"
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class Asset(BaseSchema):
    id: str = Field(default_factory=generate_ulid)
    type: AssetType
    label: str
    criticality: int = Field(default=50, ge=0, le=100)
    owner: str
    status: str = "active"
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class Identity(BaseSchema):
    id: str = Field(default_factory=generate_ulid)
    asset_id: str
    provider: str
    protected_identifier_hash: str
    mfa_state: Optional[bool] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @classmethod
    def create(cls, asset_id: str, provider: str, identifier: str, mfa_state: Optional[bool] = None, **kwargs: Any) -> "Identity":
        return cls(
            asset_id=asset_id,
            provider=provider,
            protected_identifier_hash=hash_value(identifier),
            mfa_state=mfa_state,
            **kwargs,
        )


class Device(BaseSchema):
    id: str = Field(default_factory=generate_ulid)
    platform: str
    agent_id: Optional[str] = None
    posture_summary: Dict[str, Any] = Field(default_factory=dict)
    last_seen: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class Indicator(BaseSchema):
    id: str = Field(default_factory=generate_ulid)
    type: IndicatorType
    normalized_value_hash: str
    reputation: Optional[Dict[str, Any]] = None
    first_seen: datetime = Field(default_factory=utc_now)
    last_seen: datetime = Field(default_factory=utc_now)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def create(cls, type: IndicatorType, value: str, **kwargs: Any) -> "Indicator":
        normalized = value.lower().strip()
        return cls(
            type=type,
            normalized_value_hash=hash_value(normalized),
            **kwargs,
        )


class Evidence(BaseSchema):
    id: str = Field(default_factory=generate_ulid)
    source: str
    source_ref: Optional[str] = None
    observed_at: datetime = Field(default_factory=utc_now)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    normalized_payload: Dict[str, Any]
    classification: DataClassification = DataClassification.SENSITIVE


class Finding(BaseSchema):
    id: str = Field(default_factory=generate_ulid)
    detector: str
    severity: Severity
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    status: FindingStatus = FindingStatus.NEW
    title: str
    description: Optional[str] = None
    evidence_refs: List[str] = Field(default_factory=list)
    asset_refs: List[str] = Field(default_factory=list)
    indicator_refs: List[str] = Field(default_factory=list)
    risk_score: Optional[int] = Field(default=None, ge=0, le=100)
    owner_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @field_validator("risk_score", mode="before")
    @classmethod
    def validate_risk_score(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("risk_score must be between 0 and 100")
        return v


class Relationship(BaseSchema):
    id: str = Field(default_factory=generate_ulid)
    source_entity: str
    relation_type: RelationType
    target_entity: str
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utc_now)


class Incident(BaseSchema):
    id: str = Field(default_factory=generate_ulid)
    status: IncidentStatus = IncidentStatus.OPEN
    severity: Severity
    title: str
    description: Optional[str] = None
    finding_refs: List[str] = Field(default_factory=list)
    asset_refs: List[str] = Field(default_factory=list)
    timeline: List[Dict[str, Any]] = Field(default_factory=list)
    owner: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ActionProposal(BaseSchema):
    id: str = Field(default_factory=generate_ulid)
    action_type: str
    target: str
    risk_class: ActionClass
    required_approval: bool = True
    status: ActionStatus = ActionStatus.PENDING
    payload: dict[str, Any] = Field(default_factory=dict)
    impact_preview: str | None = None
    dry_run_result: dict[str, Any] | None = None
    approval_token: str | None = None
    expires_at: datetime | None = None
    verifier_result: dict[str, Any] | None = None
    owner_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class AuditEvent(BaseSchema):
    id: str = Field(default_factory=generate_ulid)
    actor: str
    event_type: str
    object_ref: Optional[str] = None
    timestamp: datetime = Field(default_factory=utc_now)
    previous_hash: Optional[str] = None
    event_hash: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)

    def compute_hash(self) -> str:
        data = {
            "id": self.id,
            "actor": self.actor,
            "event_type": self.event_type,
            "object_ref": self.object_ref,
            "timestamp": self.timestamp.isoformat(),
            "previous_hash": self.previous_hash,
            "payload": self.payload,
        }
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


class PhishingAnalysisRequest(BaseSchema):
    text: Optional[str] = None
    urls: List[str] = Field(default_factory=list)
    headers: Optional[Dict[str, str]] = None
    sender: Optional[str] = None
    subject: Optional[str] = None
    attachments: List[Dict[str, Any]] = Field(default_factory=list)


class PhishingAnalysisResult(BaseSchema):
    verdict: str
    confidence: float = Field(ge=0.0, le=1.0)
    category: str
    evidence: List[Dict[str, Any]] = Field(default_factory=list)
    indicators: List[Dict[str, Any]] = Field(default_factory=list)
    uncertainty: List[str] = Field(default_factory=list)
    safe_next_steps: List[str] = Field(default_factory=list)
    ai_explanation: Optional[str] = None


class IndicatorEnrichmentRequest(BaseSchema):
    indicators: List[Dict[str, str]]


class IndicatorEnrichmentResult(BaseSchema):
    results: List[Dict[str, Any]]


class DashboardResponse(BaseSchema):
    posture_score: int = Field(ge=0, le=100)
    score_drivers: List[Dict[str, Any]] = Field(default_factory=list)
    critical_assets: List[Dict[str, Any]] = Field(default_factory=list)
    unresolved_findings: List[Dict[str, Any]] = Field(default_factory=list)
    evidence_freshness: Dict[str, Any] = Field(default_factory=dict)
    connector_health: Dict[str, Any] = Field(default_factory=dict)


class BreachMonitorRequest(BaseSchema):
    identifiers: List[Dict[str, str]]


class BreachMonitorResult(BaseSchema):
    exposures: List[Dict[str, Any]] = Field(default_factory=list)


__all__ = [
    "EventType",
    "Severity",
    "ActionClass",
    "FindingStatus",
    "IncidentStatus",
    "ActionStatus",
    "DataClassification",
    "RelationType",
    "IndicatorType",
    "AssetType",
    "generate_ulid",
    "utc_now",
    "hash_value",
    "BaseSchema",
    "EventEnvelope",
    "User",
    "Asset",
    "Identity",
    "Device",
    "Indicator",
    "Evidence",
    "Finding",
    "Relationship",
    "Incident",
    "ActionProposal",
    "AuditEvent",
    "PhishingAnalysisRequest",
    "PhishingAnalysisResult",
    "IndicatorEnrichmentRequest",
    "IndicatorEnrichmentResult",
    "DashboardResponse",
    "BreachMonitorRequest",
    "BreachMonitorResult",
]