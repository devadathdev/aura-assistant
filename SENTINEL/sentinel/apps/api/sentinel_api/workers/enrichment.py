from __future__ import annotations

import asyncio
from typing import Any

from sentinel_schemas import (
    Evidence,
    Indicator,
    IndicatorEnrichmentRequest,
    IndicatorEnrichmentResult,
    IndicatorType,
    generate_ulid,
    hash_value,
    utc_now,
)
from sqlalchemy.ext.asyncio import AsyncSession


class ThreatIntelConnector:
    name: str = "base"

    async def lookup(self, indicator: Indicator) -> dict[str, Any] | None:
        raise NotImplementedError

    async def health(self) -> dict[str, Any]:
        return {"status": "unknown", "connector": self.name}

    async def rate_limit_state(self) -> dict[str, Any]:
        return {"remaining": "unknown", "reset_at": None}


class MockThreatIntelConnector(ThreatIntelConnector):
    name = "mock"

    async def lookup(self, indicator: Indicator) -> dict[str, Any] | None:
        await asyncio.sleep(0.01)
        value = indicator.normalized_value_hash[:16]
        is_malicious = hash(value) % 10 < 2
        return {
            "source": self.name,
            "indicator_type": indicator.type.value,
            "indicator_hash": indicator.normalized_value_hash,
            "malicious": is_malicious,
            "score": 85 if is_malicious else 10,
            "categories": ["phishing", "malware"] if is_malicious else ["clean"],
            "first_seen": "2024-01-01T00:00:00Z",
            "last_seen": utc_now().isoformat(),
            "confidence": 0.8 if is_malicious else 0.9,
        }

    async def health(self) -> dict[str, Any]:
        return {"status": "healthy", "connector": self.name}


class VirusTotalConnector(ThreatIntelConnector):
    name = "virustotal"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://www.virustotal.com/api/v3"

    async def lookup(self, indicator: Indicator) -> dict[str, Any] | None:
        import httpx
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"x-apikey": self.api_key}
            if indicator.type == IndicatorType.URL:
                url_id = hash_value(indicator.normalized_value_hash)
                resp = await client.get(f"{self.base_url}/urls/{url_id}", headers=headers)
            elif indicator.type == IndicatorType.DOMAIN:
                resp = await client.get(f"{self.base_url}/domains/{indicator.normalized_value_hash}", headers=headers)
            elif indicator.type == IndicatorType.IP:
                resp = await client.get(f"{self.base_url}/ip_addresses/{indicator.normalized_value_hash}", headers=headers)
            elif indicator.type == IndicatorType.HASH:
                resp = await client.get(f"{self.base_url}/files/{indicator.normalized_value_hash}", headers=headers)
            else:
                return None

            if resp.status_code == 404:
                return {"source": self.name, "indicator_hash": indicator.normalized_value_hash, "malicious": False, "score": 0, "not_found": True}
            if resp.status_code != 200:
                return None

            data = resp.json()
            stats = data.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
            malicious = stats.get("malicious", 0)
            suspicious = stats.get("suspicious", 0)
            total = sum(stats.values()) or 1
            score = int(((malicious + suspicious) / total) * 100)

            return {
                "source": self.name,
                "indicator_type": indicator.type.value,
                "indicator_hash": indicator.normalized_value_hash,
                "malicious": malicious > 0,
                "score": score,
                "categories": list(data.get("data", {}).get("attributes", {}).get("categories", {}).keys()),
                "first_seen": data.get("data", {}).get("attributes", {}).get("creation_date"),
                "last_seen": utc_now().isoformat(),
                "confidence": 0.9,
            }

    async def health(self) -> dict[str, Any]:
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{self.base_url}/users/me", headers={"x-apikey": self.api_key})
            return {"status": "healthy" if resp.status_code == 200 else "unhealthy", "connector": self.name}


class AbuseIPDBConnector(ThreatIntelConnector):
    name = "abuseipdb"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.abuseipdb.com/api/v2"

    async def lookup(self, indicator: Indicator) -> dict[str, Any] | None:
        if indicator.type != IndicatorType.IP:
            return None

        import httpx
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"Key": self.api_key, "Accept": "application/json"}
            params: dict[str, str | int] = {"ipAddress": indicator.normalized_value_hash, "maxAgeInDays": 90}
            resp = await client.get(f"{self.base_url}/check", headers=headers, params=params)

            if resp.status_code != 200:
                return None

            data = resp.json().get("data", {})
            abuse_score = data.get("abuseConfidenceScore", 0)
            return {
                "source": self.name,
                "indicator_type": "ip",
                "indicator_hash": indicator.normalized_value_hash,
                "malicious": abuse_score > 50,
                "score": abuse_score,
                "categories": ["abuse"] if abuse_score > 50 else [],
                "first_seen": data.get("firstReportedAt"),
                "last_seen": data.get("lastReportedAt"),
                "confidence": 0.85,
            }


class ThreatIntelRegistry:
    def __init__(self) -> None:
        self._connectors: dict[str, ThreatIntelConnector] = {}

    def register(self, connector: ThreatIntelConnector) -> None:
        self._connectors[connector.name] = connector

    def get(self, name: str) -> ThreatIntelConnector | None:
        return self._connectors.get(name)

    def all(self) -> list[ThreatIntelConnector]:
        return list(self._connectors.values())


registry = ThreatIntelRegistry()


async def enrich_indicators_task(
    request: IndicatorEnrichmentRequest,
    user_id: str,
    session: AsyncSession,
) -> IndicatorEnrichmentResult:
    from sentinel_schemas import Indicator, IndicatorType
    from sqlalchemy import select

    from sentinel_api.database import IndicatorModel

    results = []

    for ind_data in request.indicators:
        ind_type = IndicatorType(ind_data.get("type", "url"))
        value = ind_data.get("value", "")
        if not value:
            continue

        indicator = Indicator.create(ind_type, value)

        db_indicator_result = await session.execute(
            select(IndicatorModel).where(IndicatorModel.normalized_value_hash == indicator.normalized_value_hash)
        )
        db_indicator = db_indicator_result.scalar_one_or_none()

        if db_indicator is None:
            db_indicator = IndicatorModel(
                id=indicator.id,
                type=indicator.type.value,
                normalized_value_hash=indicator.normalized_value_hash,
            )
            session.add(db_indicator)
            await session.flush()

        combined_reputation = {}
        all_malicious = False
        max_score = 0

        for connector in registry.all():
            try:
                result = await connector.lookup(indicator)
                if result:
                    combined_reputation[connector.name] = result
                    if result.get("malicious"):
                        all_malicious = True
                    max_score = max(max_score, result.get("score", 0))
            except Exception:
                pass

        db_indicator.reputation = combined_reputation
        db_indicator.last_seen = utc_now()
        await session.flush()

        evidence = Evidence(
            id=generate_ulid(),
            source="threat_intel_enrichment",
            source_ref=",".join(combined_reputation.keys()),
            observed_at=utc_now(),
            confidence=0.7 if combined_reputation else 0.1,
            normalized_payload={
                "indicator_hash": indicator.normalized_value_hash,
                "indicator_type": indicator.type.value,
                "reputation": combined_reputation,
                "malicious": all_malicious,
                "max_score": max_score,
            },
        )

        results.append({
            "indicator_hash": indicator.normalized_value_hash,
            "indicator_type": indicator.type.value,
            "reputation": combined_reputation,
            "malicious": all_malicious,
            "max_score": max_score,
            "evidence_id": evidence.id,
        })

    return IndicatorEnrichmentResult(results=results)