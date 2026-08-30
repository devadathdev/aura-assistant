from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sentinel_schemas import (
    Asset,
    Evidence,
    Finding,
    Indicator,
    Severity,
)


@dataclass
class RiskComponent:
    name: str
    score: int
    weight: float
    evidence_refs: list[str]
    details: dict[str, Any]


@dataclass
class RiskScoreResult:
    total_score: int
    severity: Severity
    components: list[RiskComponent]
    confidence: float
    explanation: str


class RiskEngine:
    WEIGHTS = {
        "identity": 0.25,
        "device": 0.20,
        "network": 0.15,
        "exposure": 0.20,
        "threat": 0.15,
        "context": 0.05,
    }

    SEVERITY_THRESHOLDS = {
        Severity.LOW: (0, 24),
        Severity.MODERATE: (25, 49),
        Severity.HIGH: (50, 74),
        Severity.CRITICAL: (75, 100),
    }

    def __init__(self, weights: dict[str, float] | None = None, thresholds: dict[Severity, tuple[int, int]] | None = None):
        self.weights = weights or self.WEIGHTS
        self.thresholds = thresholds or self.SEVERITY_THRESHOLDS

    def calculate(
        self,
        findings: list[Finding],
        evidence_map: dict[str, Evidence],
        asset_map: dict[str, Asset],
        indicator_map: dict[str, Indicator],
    ) -> RiskScoreResult:
        components = []

        identity_score, identity_evidence = self._calculate_identity(findings, evidence_map, asset_map)
        components.append(RiskComponent("identity", identity_score, self.weights["identity"], identity_evidence, {}))

        device_score, device_evidence = self._calculate_device(findings, evidence_map, asset_map)
        components.append(RiskComponent("device", device_score, self.weights["device"], device_evidence, {}))

        network_score, network_evidence = self._calculate_network(findings, evidence_map, asset_map)
        components.append(RiskComponent("network", network_score, self.weights["network"], network_evidence, {}))

        exposure_score, exposure_evidence = self._calculate_exposure(findings, evidence_map, indicator_map)
        components.append(RiskComponent("exposure", exposure_score, self.weights["exposure"], exposure_evidence, {}))

        threat_score, threat_evidence = self._calculate_threat(findings, evidence_map, indicator_map)
        components.append(RiskComponent("threat", threat_score, self.weights["threat"], threat_evidence, {}))

        context_score, context_evidence = self._calculate_context(findings, evidence_map, asset_map)
        components.append(RiskComponent("context", context_score, self.weights["context"], context_evidence, {}))

        total = sum(c.score * c.weight for c in components)
        total_score = int(round(total))

        severity = self._score_to_severity(total_score)
        confidence = self._calculate_confidence(findings, evidence_map)

        explanation = self._generate_explanation(components, total_score, severity)

        return RiskScoreResult(
            total_score=total_score,
            severity=severity,
            components=components,
            confidence=confidence,
            explanation=explanation,
        )

    def _calculate_identity(
        self, findings: list[Finding], evidence_map: dict[str, Evidence], asset_map: dict[str, Asset]
    ) -> tuple[int, list[str]]:
        score = 0
        evidence_refs = []

        for finding in findings:
            if finding.detector in ("identity", "auth", "session", "mfa"):
                score = max(score, finding.risk_score or 50)
                evidence_refs.extend(finding.evidence_refs)

        for asset_id in asset_map:
            asset = asset_map[asset_id]
            if asset.type.value == "account":
                if asset.metadata.get("mfa_enabled") is False:
                    score = max(score, 60)
                if asset.metadata.get("exposed_credential"):
                    score = max(score, 80)
                if asset.metadata.get("suspicious_session"):
                    score = max(score, 70)

        return min(score, 100), evidence_refs

    def _calculate_device(
        self, findings: list[Finding], evidence_map: dict[str, Evidence], asset_map: dict[str, Asset]
    ) -> tuple[int, list[str]]:
        score = 0
        evidence_refs = []

        for finding in findings:
            if finding.detector in ("device", "posture", "patch", "encryption"):
                score = max(score, finding.risk_score or 50)
                evidence_refs.extend(finding.evidence_refs)

        for asset_id in asset_map:
            asset = asset_map[asset_id]
            if asset.type.value == "device":
                posture = asset.metadata.get("posture", {})
                if not posture.get("disk_encrypted"):
                    score = max(score, 50)
                if not posture.get("screen_lock"):
                    score = max(score, 40)
                if posture.get("patch_status") == "outdated":
                    score = max(score, 60)
                if posture.get("risky_config"):
                    score = max(score, 55)

        return min(score, 100), evidence_refs

    def _calculate_network(
        self, findings: list[Finding], evidence_map: dict[str, Evidence], asset_map: dict[str, Asset]
    ) -> tuple[int, list[str]]:
        score = 0
        evidence_refs = []

        for finding in findings:
            if finding.detector in ("network", "dns", "connection", "anomaly"):
                score = max(score, finding.risk_score or 50)
                evidence_refs.extend(finding.evidence_refs)

        return min(score, 100), evidence_refs

    def _calculate_exposure(
        self, findings: list[Finding], evidence_map: dict[str, Evidence], indicator_map: dict[str, Indicator]
    ) -> tuple[int, list[str]]:
        score = 0
        evidence_refs = []

        for finding in findings:
            if finding.detector in ("breach", "exposure", "leak"):
                score = max(score, finding.risk_score or 50)
                evidence_refs.extend(finding.evidence_refs)

        for indicator in indicator_map.values():
            if indicator.reputation and indicator.reputation.get("malicious"):
                score = max(score, 70)
                evidence_refs.append(indicator.id)

        return min(score, 100), evidence_refs

    def _calculate_threat(
        self, findings: list[Finding], evidence_map: dict[str, Evidence], indicator_map: dict[str, Indicator]
    ) -> tuple[int, list[str]]:
        score = 0
        evidence_refs = []

        for finding in findings:
            if finding.detector in ("phishing", "malware", "reputation", "ti"):
                score = max(score, finding.risk_score or 50)
                evidence_refs.extend(finding.evidence_refs)

        for indicator in indicator_map.values():
            if indicator.reputation:
                max_score = max((v.get("score", 0) for v in indicator.reputation.values()), default=0)
                if max_score > 50:
                    score = max(score, max_score)
                    evidence_refs.append(indicator.id)

        return min(score, 100), evidence_refs

    def _calculate_context(
        self, findings: list[Finding], evidence_map: dict[str, Evidence], asset_map: dict[str, Asset]
    ) -> tuple[int, list[str]]:
        score = 0
        evidence_refs = []

        for finding in findings:
            criticality = 50
            for asset_id in finding.asset_refs:
                if asset_id in asset_map:
                    criticality = max(criticality, asset_map[asset_id].criticality)
            if criticality > 80:
                score = max(score, 60)
            evidence_refs.extend(finding.evidence_refs)

        return min(score, 100), evidence_refs

    def _score_to_severity(self, score: int) -> Severity:
        for severity, (low, high) in self.thresholds.items():
            if low <= score <= high:
                return severity
        return Severity.CRITICAL

    def _calculate_confidence(self, findings: list[Finding], evidence_map: dict[str, Evidence]) -> float:
        if not findings:
            return 0.0
        total_confidence = sum(f.confidence for f in findings)
        return min(total_confidence / len(findings), 1.0)

    def _generate_explanation(
        self, components: list[RiskComponent], total_score: int, severity: Severity
    ) -> str:
        top_components = sorted(components, key=lambda c: c.score * c.weight, reverse=True)[:3]
        drivers = [f"{c.name} ({c.score})" for c in top_components if c.score > 30]
        driver_str = ", ".join(drivers) if drivers else "no significant risk drivers"
        return f"Risk score {total_score} ({severity.value}): Primary drivers: {driver_str}"


risk_engine = RiskEngine()