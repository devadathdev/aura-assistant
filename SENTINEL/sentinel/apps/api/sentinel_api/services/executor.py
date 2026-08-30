from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from sentinel_schemas import (
    ActionClass,
    ActionProposal,
    generate_ulid,
    utc_now,
)


@dataclass
class ExecutionResult:
    success: bool
    output: dict[str, Any]
    dry_run_result: dict[str, Any] | None
    verifier_result: dict[str, Any] | None
    error: str | None = None


class ActionExecutor(ABC):
    action_type: str
    risk_class: ActionClass

    @abstractmethod
    async def dry_run(self, action: ActionProposal) -> dict[str, Any]:
        pass

    @abstractmethod
    async def execute(self, action: ActionProposal) -> dict[str, Any]:
        pass

    @abstractmethod
    async def verify(self, action: ActionProposal, execution_result: dict[str, Any]) -> dict[str, Any]:
        pass


class ExecutorRegistry:
    def __init__(self) -> None:
        self._executors: dict[str, ActionExecutor] = {}

    def register(self, executor: ActionExecutor) -> None:
        self._executors[executor.action_type] = executor

    def get(self, action_type: str) -> ActionExecutor | None:
        return self._executors.get(action_type)

    def get_for_action(self, action: ActionProposal) -> ActionExecutor | None:
        return self._executors.get(action.action_type)


executor_registry = ExecutorRegistry()


class QuarantineExecutor(ActionExecutor):
    action_type = "quarantine_item"
    risk_class = ActionClass.REVERSIBLE_LOW_IMPACT

    async def dry_run(self, action: ActionProposal) -> dict[str, Any]:
        return {
            "action": "quarantine",
            "target": action.target,
            "would_quarantine": True,
            "reversible": True,
        }

    async def execute(self, action: ActionProposal) -> dict[str, Any]:
        return {
            "action": "quarantine",
            "target": action.target,
            "quarantined": True,
            "timestamp": utc_now().isoformat(),
        }

    async def verify(self, action: ActionProposal, execution_result: dict[str, Any]) -> dict[str, Any]:
        return {"verified": execution_result.get("quarantined", False)}


class DisableRuleExecutor(ActionExecutor):
    action_type = "disable_rule"
    risk_class = ActionClass.REVERSIBLE_LOW_IMPACT

    async def dry_run(self, action: ActionProposal) -> dict[str, Any]:
        return {
            "action": "disable_rule",
            "target": action.target,
            "would_disable": True,
            "reversible": True,
        }

    async def execute(self, action: ActionProposal) -> dict[str, Any]:
        return {
            "action": "disable_rule",
            "target": action.target,
            "disabled": True,
            "timestamp": utc_now().isoformat(),
        }

    async def verify(self, action: ActionProposal, execution_result: dict[str, Any]) -> dict[str, Any]:
        return {"verified": execution_result.get("disabled", False)}


class RevokeSessionExecutor(ActionExecutor):
    action_type = "revoke_session"
    risk_class = ActionClass.ACCOUNT_SYSTEM_CHANGE

    async def dry_run(self, action: ActionProposal) -> dict[str, Any]:
        return {
            "action": "revoke_session",
            "target": action.target,
            "would_revoke": True,
            "reversible": False,
            "impact": "User will be logged out and need to re-authenticate",
        }

    async def execute(self, action: ActionProposal) -> dict[str, Any]:
        return {
            "action": "revoke_session",
            "target": action.target,
            "revoked": True,
            "timestamp": utc_now().isoformat(),
        }

    async def verify(self, action: ActionProposal, execution_result: dict[str, Any]) -> dict[str, Any]:
        return {"verified": execution_result.get("revoked", False)}


class ModifyFirewallRuleExecutor(ActionExecutor):
    action_type = "modify_firewall_rule"
    risk_class = ActionClass.ACCOUNT_SYSTEM_CHANGE

    async def dry_run(self, action: ActionProposal) -> dict[str, Any]:
        return {
            "action": "modify_firewall_rule",
            "target": action.target,
            "rule_changes": action.payload.get("changes", {}),
            "would_apply": True,
            "reversible": True,
        }

    async def execute(self, action: ActionProposal) -> dict[str, Any]:
        return {
            "action": "modify_firewall_rule",
            "target": action.target,
            "applied": True,
            "timestamp": utc_now().isoformat(),
        }

    async def verify(self, action: ActionProposal, execution_result: dict[str, Any]) -> dict[str, Any]:
        return {"verified": execution_result.get("applied", False)}


class StopProcessExecutor(ActionExecutor):
    action_type = "stop_process"
    risk_class = ActionClass.ACCOUNT_SYSTEM_CHANGE

    async def dry_run(self, action: ActionProposal) -> dict[str, Any]:
        return {
            "action": "stop_process",
            "target": action.target,
            "pid": action.payload.get("pid"),
            "would_stop": True,
            "reversible": False,
            "impact": "Process will be terminated",
        }

    async def execute(self, action: ActionProposal) -> dict[str, Any]:
        return {
            "action": "stop_process",
            "target": action.target,
            "stopped": True,
            "timestamp": utc_now().isoformat(),
        }

    async def verify(self, action: ActionProposal, execution_result: dict[str, Any]) -> dict[str, Any]:
        return {"verified": execution_result.get("stopped", False)}


class DeleteDataExecutor(ActionExecutor):
    action_type = "delete_data"
    risk_class = ActionClass.DESTRUCTIVE_IRREVERSIBLE

    async def dry_run(self, action: ActionProposal) -> dict[str, Any]:
        return {
            "action": "delete_data",
            "target": action.target,
            "paths": action.payload.get("paths", []),
            "would_delete": True,
            "reversible": False,
            "impact": "Data will be permanently deleted",
            "warning": "This action is IRREVERSIBLE",
        }

    async def execute(self, action: ActionProposal) -> dict[str, Any]:
        return {
            "action": "delete_data",
            "target": action.target,
            "deleted": True,
            "timestamp": utc_now().isoformat(),
        }

    async def verify(self, action: ActionProposal, execution_result: dict[str, Any]) -> dict[str, Any]:
        return {"verified": execution_result.get("deleted", False)}


class RotateCredentialExecutor(ActionExecutor):
    action_type = "rotate_credential"
    risk_class = ActionClass.DESTRUCTIVE_IRREVERSIBLE

    async def dry_run(self, action: ActionProposal) -> dict[str, Any]:
        return {
            "action": "rotate_credential",
            "target": action.target,
            "credential_type": action.payload.get("credential_type"),
            "would_rotate": True,
            "reversible": False,
            "impact": "Credential will be invalidated and replaced",
            "warning": "This action is IRREVERSIBLE - old credential cannot be recovered",
        }

    async def execute(self, action: ActionProposal) -> dict[str, Any]:
        return {
            "action": "rotate_credential",
            "target": action.target,
            "rotated": True,
            "new_credential_id": generate_ulid(),
            "timestamp": utc_now().isoformat(),
        }

    async def verify(self, action: ActionProposal, execution_result: dict[str, Any]) -> dict[str, Any]:
        return {"verified": execution_result.get("rotated", False)}


executor_registry.register(QuarantineExecutor())
executor_registry.register(DisableRuleExecutor())
executor_registry.register(RevokeSessionExecutor())
executor_registry.register(ModifyFirewallRuleExecutor())
executor_registry.register(StopProcessExecutor())
executor_registry.register(DeleteDataExecutor())
executor_registry.register(RotateCredentialExecutor())


async def execute_action(action: Any, session: Any) -> ExecutionResult:
    from sentinel_schemas import ActionProposal
    if hasattr(action, 'model_dump'):
        # It's a pydantic model
        action_proposal = action
    else:
        # It's a SQLAlchemy model
        action_proposal = ActionProposal.model_validate(action.__dict__)
    
    executor = executor_registry.get_for_action(action_proposal)
    if not executor:
        return ExecutionResult(
            success=False,
            output={},
            dry_run_result=None,
            verifier_result=None,
            error=f"No executor found for action type: {action_proposal.action_type}",
        )

    try:
        dry_run_result = await executor.dry_run(action)
        execution_result = await executor.execute(action)
        verifier_result = await executor.verify(action, execution_result)

        return ExecutionResult(
            success=True,
            output=execution_result,
            dry_run_result=dry_run_result,
            verifier_result=verifier_result,
        )
    except Exception as e:
        return ExecutionResult(
            success=False,
            output={},
            dry_run_result=None,
            verifier_result=None,
            error=str(e),
        )