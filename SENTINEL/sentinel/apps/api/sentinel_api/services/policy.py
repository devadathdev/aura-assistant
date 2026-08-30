from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sentinel_schemas import (
    ActionClass,
    ActionProposal,
    Severity,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class PolicyResult:
    allowed: bool
    reason: str
    required_approvals: list[str]
    conditions: dict[str, Any]


@dataclass
class PolicyRule:
    name: str
    action_types: list[str]
    action_classes: list[ActionClass]
    max_severity: Severity | None = None
    required_roles: list[str] | None = None
    conditions: dict[str, Any] | None = None
    allow: bool = True


DEFAULT_POLICIES = [
    PolicyRule(
        name="read_only_auto_approve",
        action_types=["*"],
        action_classes=[ActionClass.READ_ONLY],
        allow=True,
    ),
    PolicyRule(
        name="reversible_low_impact_confirm",
        action_types=["*"],
        action_classes=[ActionClass.REVERSIBLE_LOW_IMPACT],
        allow=True,
    ),
    PolicyRule(
        name="account_system_change_approval",
        action_types=["*"],
        action_classes=[ActionClass.ACCOUNT_SYSTEM_CHANGE],
        allow=True,
    ),
    PolicyRule(
        name="destructive_strong_approval",
        action_types=["*"],
        action_classes=[ActionClass.DESTRUCTIVE_IRREVERSIBLE],
        allow=True,
    ),
    PolicyRule(
        name="block_unauthorized_destructive",
        action_types=["delete_*", "revoke_*", "factory_reset", "rotate_credential"],
        action_classes=[ActionClass.DESTRUCTIVE_IRREVERSIBLE],
        allow=False,
    ),
]


class PolicyEngine:
    def __init__(self, rules: list[PolicyRule] | None = None):
        self.rules = rules or DEFAULT_POLICIES
        self.user_policies: dict[str, list[PolicyRule]] = {}

    def set_user_policy(self, user_id: str, rules: list[PolicyRule]) -> None:
        self.user_policies[user_id] = rules

    async def evaluate(
        self,
        action: ActionProposal,
        user_roles: list[str],
        session: AsyncSession,
    ) -> PolicyResult:
        asset_criticality, finding_severity = await self._fetch_context(action, session)
        applicable_rules = self._get_applicable_rules(action, user_roles)

        for rule in applicable_rules:
            if not self._matches_rule(action, rule, finding_severity, asset_criticality, user_roles):
                continue

            if not rule.allow:
                return PolicyResult(
                    allowed=False,
                    reason=f"Blocked by policy: {rule.name}",
                    required_approvals=[],
                    conditions={},
                )

        required_approvals = self._determine_approvals(action, applicable_rules, asset_criticality)
        conditions = self._compile_conditions(applicable_rules)

        return PolicyResult(
            allowed=True,
            reason="Policy evaluation passed",
            required_approvals=required_approvals,
            conditions=conditions,
        )

    async def _fetch_context(
        self,
        action: ActionProposal,
        session: AsyncSession,
    ) -> tuple[int, Severity | None]:
        from sentinel_api.database import AssetModel, FindingModel

        asset_criticality = 50
        finding_severity: Severity | None = None

        if action.target:
            asset_result = await session.execute(
                select(AssetModel).where(AssetModel.id == action.target)
            )
            asset: AssetModel | None = asset_result.scalar_one_or_none()
            if asset:
                asset_criticality = asset.criticality

        if action.payload.get("finding_id"):
            finding_result = await session.execute(
                select(FindingModel).where(FindingModel.id == action.payload["finding_id"])
            )
            finding: FindingModel | None = finding_result.scalar_one_or_none()
            if finding:
                finding_severity = Severity(finding.severity)

        return asset_criticality, finding_severity

    def _get_applicable_rules(
        self,
        action: ActionProposal,
        user_roles: list[str],
    ) -> list[PolicyRule]:
        rules = list(self.rules)
        if action.owner_id and action.owner_id in self.user_policies:
            rules.extend(self.user_policies[action.owner_id])
        return sorted(rules, key=lambda r: (r.action_classes[0].value if r.action_classes else "Z"))

    def _matches_rule(
        self,
        action: ActionProposal,
        rule: PolicyRule,
        finding_severity: Severity | None,
        asset_criticality: int,
        user_roles: list[str],
    ) -> bool:
        if rule.action_types and "*" not in rule.action_types:
            if not any(action.action_type.startswith(t.rstrip("*")) for t in rule.action_types):
                return False

        if rule.action_classes and action.risk_class not in rule.action_classes:
            return False

        if rule.max_severity and finding_severity:
            severity_order = {"low": 0, "moderate": 1, "high": 2, "critical": 3}
            if severity_order.get(finding_severity.value, 0) > severity_order.get(rule.max_severity.value, 3):
                return False

        if rule.required_roles:
            if not any(role in user_roles for role in rule.required_roles):
                return False

        if rule.conditions:
            for key, expected in rule.conditions.items():
                if key == "asset_criticality_max":
                    if asset_criticality > expected:
                        return False

        return True

    def _determine_approvals(
        self,
        action: ActionProposal,
        rules: list[PolicyRule],
        asset_criticality: int,
    ) -> list[str]:
        approvals = []
        if action.required_approval:
            if action.risk_class == ActionClass.READ_ONLY:
                pass
            elif action.risk_class == ActionClass.REVERSIBLE_LOW_IMPACT:
                approvals.append("user_confirmation")
            elif action.risk_class == ActionClass.ACCOUNT_SYSTEM_CHANGE:
                approvals.append("explicit_approval")
                if asset_criticality > 80 or action.payload.get("high_value_asset"):
                    approvals.append("step_up_auth")
            elif action.risk_class == ActionClass.DESTRUCTIVE_IRREVERSIBLE:
                approvals.append("explicit_approval")
                approvals.append("step_up_auth")
                approvals.append("dual_authorization")
        return approvals

    def _compile_conditions(self, rules: list[PolicyRule]) -> dict[str, Any]:
        conditions = {}
        for rule in rules:
            if rule.conditions:
                conditions.update(rule.conditions)
        return conditions


policy_engine = PolicyEngine()


async def evaluate_action(action: Any, user: Any, session: AsyncSession) -> PolicyResult:
    from sentinel_schemas import ActionProposal
    if hasattr(action, 'model_dump'):
        # It's a pydantic model
        action_proposal = action
    else:
        # It's a SQLAlchemy model
        action_proposal = ActionProposal.model_validate(action.__dict__)
    return await policy_engine.evaluate(
        action_proposal,
        user_roles=["user"],
        session=session,
    )