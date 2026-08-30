from __future__ import annotations

from typing import Any

from sentinel_schemas import (
    BreachMonitorRequest,
    BreachMonitorResult,
    Evidence,
    generate_ulid,
    hash_value,
    utc_now,
)
from sqlalchemy.ext.asyncio import AsyncSession


class BreachConnector:
    name: str = "base"

    async def check_exposures(self, identifiers: list[dict[str, str]]) -> list[dict[str, Any]]:
        raise NotImplementedError

    async def health(self) -> dict[str, Any]:
        return {"status": "unknown", "connector": self.name}


class MockBreachConnector(BreachConnector):
    name = "mock"

    async def check_exposures(self, identifiers: list[dict[str, str]]) -> list[dict[str, Any]]:
        import asyncio
        await asyncio.sleep(0.01)
        exposures = []
        for ident in identifiers:
            ident_type = ident.get("type", "email")
            ident_value = ident.get("value", "")
            if not ident_value:
                continue
            is_exposed = hash(ident_value) % 10 < 3
            if is_exposed:
                exposures.append({
                    "identifier_type": ident_type,
                    "identifier_hash": hash_value(ident_value),
                    "breach_name": f"Mock Breach {hash(ident_value) % 100}",
                    "breach_date": "2023-06-15",
                    "data_classes": ["email", "password", "name"],
                    "description": "Mock breach for testing",
                    "source": self.name,
                    "confidence": 0.9,
                })
        return exposures


class HaveIBeenPwnedConnector(BreachConnector):
    name = "haveibeenpwned"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://haveibeenpwned.com/api/v3"

    async def check_exposures(self, identifiers: list[dict[str, str]]) -> list[dict[str, Any]]:
        import httpx
        exposures = []
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"hibp-api-key": self.api_key, "User-Agent": "SENTINEL"}
            for ident in identifiers:
                ident_type = ident.get("type", "email")
                ident_value = ident.get("value", "")
                if ident_type != "email" or not ident_value:
                    continue

                try:
                    resp = await client.get(f"{self.base_url}/breachedaccount/{ident_value}", headers=headers)
                    if resp.status_code == 404:
                        continue
                    if resp.status_code != 200:
                        continue

                    breaches = resp.json()
                    for breach in breaches:
                        exposures.append({
                            "identifier_type": "email",
                            "identifier_hash": hash_value(ident_value),
                            "breach_name": breach.get("Name", "Unknown"),
                            "breach_date": breach.get("BreachDate", ""),
                            "data_classes": breach.get("DataClasses", []),
                            "description": breach.get("Description", ""),
                            "source": self.name,
                            "confidence": 0.95,
                        })
                except Exception:
                    pass

        return exposures


class BreachRegistry:
    def __init__(self) -> None:
        self._connectors: dict[str, BreachConnector] = {}

    def register(self, connector: BreachConnector) -> None:
        self._connectors[connector.name] = connector

    def get(self, name: str) -> BreachConnector | None:
        return self._connectors.get(name)

    def all(self) -> list[BreachConnector]:
        return list(self._connectors.values())


breach_registry = BreachRegistry()


async def check_breach_exposure(
    request: BreachMonitorRequest,
    user_id: str,
    session: AsyncSession,
) -> BreachMonitorResult:

    all_exposures = []

    for connector in breach_registry.all():
        try:
            exposures = await connector.check_exposures(request.identifiers)
            for exp in exposures:
                exp["connector"] = connector.name
                all_exposures.append(exp)
        except Exception:
            pass

    for exposure in all_exposures:
        evidence = Evidence(
            id=generate_ulid(),
            source="breach_monitoring",
            source_ref=exposure.get("connector"),
            observed_at=utc_now(),
            confidence=exposure.get("confidence", 0.8),
            normalized_payload=exposure,
        )

    return BreachMonitorResult(exposures=all_exposures)