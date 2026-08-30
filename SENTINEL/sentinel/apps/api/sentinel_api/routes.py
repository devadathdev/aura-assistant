from __future__ import annotations

from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sentinel_schemas import (
    ActionProposal,
    ActionStatus,
    Asset,
    AuditEvent,
    BreachMonitorRequest,
    BreachMonitorResult,
    DashboardResponse,
    Finding,
    Incident,
    IndicatorEnrichmentRequest,
    IndicatorEnrichmentResult,
    PhishingAnalysisRequest,
    PhishingAnalysisResult,
    generate_ulid,
    utc_now,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sentinel_api.auth import AuthUser, get_current_user
from sentinel_api.database import (
    ActionProposalModel,
    AssetModel,
    AuditEventModel,
    FindingModel,
    IncidentModel,
    get_session,
)
from sentinel_api.routes.auth import router as auth_router

router = APIRouter()

router.include_router(auth_router)


@router.get("/v1/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    findings_result = await session.execute(
        select(FindingModel).where(FindingModel.owner_id == user.id).where(FindingModel.status != "resolved")
    )
    findings = findings_result.scalars().all()

    assets_result = await session.execute(select(AssetModel).where(AssetModel.owner_id == user.id))
    assets = assets_result.scalars().all()

    critical_findings = [f for f in findings if f.severity in ("high", "critical")]
    critical_assets = sorted(assets, key=lambda a: a.criticality, reverse=True)[:5]

    posture_score = 0
    score_drivers = []
    if findings:
        avg_risk = sum(f.risk_score or 50 for f in findings) / len(findings)
        posture_score = max(0, 100 - int(avg_risk))
        score_drivers.append({"factor": "open_findings", "impact": -int(avg_risk), "count": len(findings)})
    else:
        posture_score = 100
        score_drivers.append({"factor": "open_findings", "impact": 0, "count": 0})

    return DashboardResponse(
        posture_score=posture_score,
        score_drivers=score_drivers,
        critical_assets=[{"id": a.id, "label": a.label, "type": a.type, "criticality": a.criticality} for a in critical_assets],
        unresolved_findings=[
            {"id": f.id, "title": f.title, "severity": f.severity, "confidence": f.confidence, "detector": f.detector}
            for f in critical_findings[:10]
        ],
        evidence_freshness={},
        connector_health={},
    )


@router.get("/v1/assets")
async def list_assets(
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(AssetModel).where(AssetModel.owner_id == user.id))
    assets = result.scalars().all()
    return [Asset.model_validate(a.__dict__) for a in assets]


@router.post("/v1/assets", status_code=status.HTTP_201_CREATED)
async def create_asset(
    asset: Asset,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    asset.owner = user.id
    db_asset = AssetModel(**asset.model_dump())
    session.add(db_asset)
    await session.flush()
    return Asset.model_validate(db_asset.__dict__)


@router.post("/v1/assets/bulk", status_code=status.HTTP_201_CREATED)
async def create_assets_bulk(
    assets: list[Asset],
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if len(assets) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 assets per request")
    
    db_assets = []
    for asset in assets:
        asset.owner = user.id
        db_asset = AssetModel(**asset.model_dump())
        session.add(db_asset)
        db_assets.append(db_asset)
    await session.flush()
    return [Asset.model_validate(a.__dict__) for a in db_assets]


@router.patch("/v1/assets/{asset_id}")
async def update_asset(
    asset_id: str,
    updates: dict[str, Any],
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(AssetModel).where(AssetModel.id == asset_id).where(AssetModel.owner_id == user.id)
    )
    asset = result.scalar_one_or_none()
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    allowed_fields = {"label", "criticality", "status", "metadata"}
    for key, value in updates.items():
        if key in allowed_fields:
            setattr(asset, key, value)
    
    asset.updated_at = utc_now()
    await session.flush()
    return Asset.model_validate(asset.__dict__)


@router.delete("/v1/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    asset_id: str,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(AssetModel).where(AssetModel.id == asset_id).where(AssetModel.owner_id == user.id)
    )
    asset = result.scalar_one_or_none()
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    await session.delete(asset)
    await session.flush()


@router.patch("/v1/findings/bulk")
async def update_findings_bulk(
    finding_ids: list[str],
    updates: dict[str, Any],
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if len(finding_ids) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 findings per request")
    
    result = await session.execute(
        select(FindingModel).where(FindingModel.id.in_(finding_ids)).where(FindingModel.owner_id == user.id)
    )
    findings = result.scalars().all()
    
    if len(findings) != len(finding_ids):
        raise HTTPException(status_code=404, detail="One or more findings not found")
    
    allowed_fields = {"status", "risk_score", "metadata"}
    for finding in findings:
        for key, value in updates.items():
            if key in allowed_fields:
                setattr(finding, key, value)
        finding.updated_at = utc_now()
    
    await session.flush()
    return [Finding.model_validate(f.__dict__) for f in findings]


@router.post("/v1/actions", status_code=status.HTTP_201_CREATED)
async def create_action_proposal(
    action: ActionProposal,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    from sentinel_api.services.policy import evaluate_action
    
    action.owner_id = user.id
    policy_result = await evaluate_action(action, user, session)
    
    action.status = ActionStatus.PENDING
    if not policy_result.allowed:
        action.status = ActionStatus.REJECTED
        action.metadata["rejection_reason"] = policy_result.reason
    
    db_action = ActionProposalModel(**action.model_dump())
    session.add(db_action)
    await session.flush()
    
    return {
        "action": ActionProposal.model_validate(db_action.__dict__),
        "policy_result": {
            "allowed": policy_result.allowed,
            "reason": policy_result.reason,
            "required_approvals": policy_result.required_approvals,
            "conditions": policy_result.conditions,
        },
    }


@router.get("/v1/actions")
async def list_action_proposals(
    status: str | None = None,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    query = select(ActionProposalModel).where(ActionProposalModel.owner_id == user.id)
    if status:
        query = query.where(ActionProposalModel.status == status)
    result = await session.execute(query)
    actions = result.scalars().all()
    return [ActionProposal.model_validate(a.__dict__) for a in actions]


@router.get("/v1/actions/{action_id}")
async def get_action_proposal(
    action_id: str,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(ActionProposalModel).where(ActionProposalModel.id == action_id).where(ActionProposalModel.owner_id == user.id)
    )
    action = result.scalar_one_or_none()
    if action is None:
        raise HTTPException(status_code=404, detail="Action not found")
    return ActionProposal.model_validate(action.__dict__)


@router.get("/v1/findings")
async def list_findings(
    severity: str | None = None,
    status: str | None = None,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    query = select(FindingModel).where(FindingModel.owner_id == user.id)
    if severity:
        query = query.where(FindingModel.severity == severity)
    if status:
        query = query.where(FindingModel.status == status)
    result = await session.execute(query)
    findings = result.scalars().all()
    return [Finding.model_validate(f.__dict__) for f in findings]


@router.post("/v1/findings", status_code=status.HTTP_201_CREATED)
async def create_finding(
    finding: Finding,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    finding.owner_id = user.id
    db_finding = FindingModel(**finding.model_dump())
    session.add(db_finding)
    await session.flush()
    return Finding.model_validate(db_finding.__dict__)


@router.get("/v1/findings/{finding_id}")
async def get_finding(
    finding_id: str,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(FindingModel).where(FindingModel.id == finding_id).where(FindingModel.owner_id == user.id)
    )
    finding = result.scalar_one_or_none()
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")
    return Finding.model_validate(finding.__dict__)


@router.post("/v1/analyze/phishing", response_model=PhishingAnalysisResult)
async def analyze_phishing(
    request: PhishingAnalysisRequest,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    from sentinel_api.workers.phishing import analyze_phishing_content
    result = await analyze_phishing_content(request, user.id, session)
    return result


@router.post("/v1/indicators/enrich", response_model=IndicatorEnrichmentResult)
async def enrich_indicators(
    request: IndicatorEnrichmentRequest,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    from sentinel_api.workers.enrichment import enrich_indicators_task
    result = await enrich_indicators_task(request, user.id, session)
    return result


@router.post("/v1/breach/monitor", response_model=BreachMonitorResult)
async def monitor_breach(
    request: BreachMonitorRequest,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    from sentinel_api.connectors.breach import check_breach_exposure
    result = await check_breach_exposure(request, user.id, session)
    return result


@router.get("/v1/incidents")
async def list_incidents(
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(IncidentModel).where(IncidentModel.owner_id == user.id))
    incidents = result.scalars().all()
    return [Incident.model_validate(i.__dict__) for i in incidents]


@router.get("/v1/incidents/{incident_id}")
async def get_incident(
    incident_id: str,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(IncidentModel).where(IncidentModel.id == incident_id).where(IncidentModel.owner_id == user.id)
    )
    incident = result.scalar_one_or_none()
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return Incident.model_validate(incident.__dict__)


@router.post("/v1/actions/{action_id}/approve")
async def approve_action(
    action_id: str,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(ActionProposalModel).where(ActionProposalModel.id == action_id).where(ActionProposalModel.owner_id == user.id)
    )
    action = result.scalar_one_or_none()
    if action is None:
        raise HTTPException(status_code=404, detail="Action not found")

    from sentinel_api.services.executor import execute_action
    from sentinel_api.services.policy import evaluate_action

    policy_result = await evaluate_action(action, user, session)
    if not policy_result.allowed:
        raise HTTPException(status_code=403, detail=policy_result.reason)

    action.status = ActionStatus.APPROVED
    action.approval_token = generate_ulid()
    await session.flush()

    execution_result = await execute_action(action, session)
    action.status = ActionStatus.EXECUTED if execution_result.success else ActionStatus.FAILED
    action.dry_run_result = execution_result.dry_run_result
    action.verifier_result = execution_result.verifier_result
    await session.flush()

    return {"status": action.status, "result": asdict(execution_result)}


@router.post("/v1/actions/{action_id}/reject")
async def reject_action(
    action_id: str,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(ActionProposalModel).where(ActionProposalModel.id == action_id).where(ActionProposalModel.owner_id == user.id)
    )
    action = result.scalar_one_or_none()
    if action is None:
        raise HTTPException(status_code=404, detail="Action not found")

    action.status = ActionStatus.REJECTED
    await session.flush()
    return {"status": "rejected"}


@router.get("/v1/audit")
async def get_audit_events(
    limit: int = 100,
    offset: int = 0,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(AuditEventModel)
        .where(AuditEventModel.actor_user_id == user.id)
        .order_by(AuditEventModel.timestamp.desc())
        .limit(limit)
        .offset(offset)
    )
    events = result.scalars().all()
    return [AuditEvent.model_validate(e.__dict__) for e in events]