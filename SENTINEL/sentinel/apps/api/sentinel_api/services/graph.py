from __future__ import annotations

from collections import defaultdict
from typing import Any

from sentinel_schemas import (
    Relationship,
    RelationType,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class SecurityGraphService:
    def __init__(self):
        self._nodes: dict[str, dict[str, Any]] = {}
        self._edges: dict[str, list[Relationship]] = defaultdict(list)
        self._reverse_edges: dict[str, list[Relationship]] = defaultdict(list)

    async def load_from_db(self, session: AsyncSession, user_id: str) -> None:
        from sentinel_api.database import (
            AssetModel,
            DeviceModel,
            EvidenceModel,
            FindingModel,
            IdentityModel,
            IncidentModel,
            IndicatorModel,
            RelationshipModel,
        )

        self._nodes.clear()
        self._edges.clear()
        self._reverse_edges.clear()

        assets_result = await session.execute(select(AssetModel).where(AssetModel.owner_id == user_id))
        for asset in assets_result.scalars().all():
            self._nodes[asset.id] = {"type": "asset", "data": asset}

        identities_result = await session.execute(select(IdentityModel).join(AssetModel).where(AssetModel.owner_id == user_id))
        for identity in identities_result.scalars().all():
            self._nodes[identity.id] = {"type": "identity", "data": identity}
            self._add_edge(identity.asset_id, RelationType.USES_IDENTITY, identity.id, 1.0)

        devices_result = await session.execute(select(DeviceModel).where(DeviceModel.owner_id == user_id))
        for device in devices_result.scalars().all():
            self._nodes[device.id] = {"type": "device", "data": device}

        indicators_result = await session.execute(select(IndicatorModel))
        for indicator in indicators_result.scalars().all():
            self._nodes[indicator.id] = {"type": "indicator", "data": indicator}

        evidence_result = await session.execute(select(EvidenceModel))
        for evidence in evidence_result.scalars().all():
            self._nodes[evidence.id] = {"type": "evidence", "data": evidence}

        findings_result = await session.execute(select(FindingModel).where(FindingModel.owner_id == user_id))
        for finding in findings_result.scalars().all():
            self._nodes[finding.id] = {"type": "finding", "data": finding}
            for asset_ref in finding.asset_refs:
                self._add_edge(finding.id, RelationType.AFFECTS, asset_ref, finding.confidence)
            for indicator_ref in finding.indicator_refs:
                self._add_edge(finding.id, RelationType.DERIVED_FROM, indicator_ref, finding.confidence)
            for evidence_ref in finding.evidence_refs:
                self._add_edge(finding.id, RelationType.DERIVED_FROM, evidence_ref, finding.confidence)

        relationships_result = await session.execute(select(RelationshipModel))
        for rel in relationships_result.scalars().all():
            self._add_edge(rel.source_entity, RelationType(rel.relation_type), rel.target_entity, rel.confidence)

        incidents_result = await session.execute(select(IncidentModel).where(IncidentModel.owner_id == user_id))
        for incident in incidents_result.scalars().all():
            self._nodes[incident.id] = {"type": "incident", "data": incident}
            for finding_ref in incident.finding_refs:
                self._add_edge(incident.id, RelationType.PART_OF_INCIDENT, finding_ref, 1.0)
            for asset_ref in incident.asset_refs:
                self._add_edge(incident.id, RelationType.AFFECTS, asset_ref, 1.0)

    def _add_edge(self, source: str, relation_type: RelationType, target: str, confidence: float) -> None:
        rel = Relationship(
            source_entity=source,
            relation_type=relation_type,
            target_entity=target,
            confidence=confidence,
        )
        self._edges[source].append(rel)
        self._reverse_edges[target].append(rel)

    def get_node(self, node_id: str) -> dict[str, Any] | None:
        return self._nodes.get(node_id)

    def get_neighbors(self, node_id: str, relation_types: list[RelationType] | None = None) -> list[Relationship]:
        edges = self._edges.get(node_id, [])
        if relation_types:
            return [e for e in edges if e.relation_type in relation_types]
        return edges

    def get_reverse_neighbors(self, node_id: str, relation_types: list[RelationType] | None = None) -> list[Relationship]:
        edges = self._reverse_edges.get(node_id, [])
        if relation_types:
            return [e for e in edges if e.relation_type in relation_types]
        return edges

    def find_paths(
        self,
        start: str,
        end: str,
        max_depth: int = 4,
        allowed_relations: set[RelationType] | None = None,
    ) -> list[list[Relationship]]:
        paths = []
        visited = set()

        def dfs(current: str, path: list[Relationship], depth: int):
            if depth > max_depth:
                return
            if current == end:
                paths.append(path.copy())
                return
            if current in visited:
                return
            visited.add(current)

            for edge in self._edges.get(current, []):
                if allowed_relations and edge.relation_type not in allowed_relations:
                    continue
                path.append(edge)
                dfs(edge.target_entity, path, depth + 1)
                path.pop()

            visited.remove(current)

        dfs(start, [], 0)
        return paths

    def get_connected_findings(self, asset_id: str) -> list[str]:
        finding_ids = []
        for edge in self._reverse_edges.get(asset_id, []):
            if edge.relation_type == RelationType.AFFECTS:
                node = self._nodes.get(edge.source_entity)
                if node and node["type"] == "finding":
                    finding_ids.append(edge.source_entity)
        return finding_ids

    def get_asset_risk_context(self, asset_id: str) -> dict[str, Any]:
        findings = self.get_connected_findings(asset_id)
        indicators = []
        evidence = []

        for finding_id in findings:
            finding_node = self._nodes.get(finding_id)
            if not finding_node:
                continue
            finding = finding_node["data"]
            for ind_ref in finding.indicator_refs:
                indicators.append(ind_ref)
            for ev_ref in finding.evidence_refs:
                evidence.append(ev_ref)

        return {
            "asset_id": asset_id,
            "connected_findings": findings,
            "connected_indicators": list(set(indicators)),
            "connected_evidence": list(set(evidence)),
        }

    def escalate_through_graph(self, finding_id: str) -> list[str]:
        escalated = []
        finding_node = self._nodes.get(finding_id)
        if not finding_node:
            return escalated

        finding = finding_node["data"]
        for asset_ref in finding.asset_refs:
            asset_findings = self.get_connected_findings(asset_ref)
            for af_id in asset_findings:
                if af_id != finding_id:
                    af_node = self._nodes.get(af_id)
                    if af_node and af_node["type"] == "finding":
                        af = af_node["data"]
                        if af.severity.value in ("high", "critical"):
                            escalated.append(af_id)

        return list(set(escalated))


graph_service = SecurityGraphService()