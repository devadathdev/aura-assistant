import pytest
from sentinel_schemas import (
    Asset,
    AssetType,
    DataClassification,
    Evidence,
    Finding,
    FindingStatus,
    Indicator,
    IndicatorType,
    PhishingAnalysisRequest,
    PhishingAnalysisResult,
    Severity,
    generate_ulid,
    hash_value,
    utc_now,
)


class TestSchemas:
    def test_generate_ulid(self):
        ulid = generate_ulid()
        assert len(ulid) == 26
        assert ulid.isalnum()

    def test_utc_now(self):
        now = utc_now()
        assert now.tzinfo is not None

    def test_hash_value(self):
        hash1 = hash_value("test")
        hash2 = hash_value("test")
        hash3 = hash_value("different")
        assert hash1 == hash2
        assert hash1 != hash3
        assert len(hash1) == 32

    def test_asset_creation(self):
        asset = Asset(
            type=AssetType.ACCOUNT,
            label="Test Account",
            criticality=75,
            owner="user-123",
        )
        assert asset.type == AssetType.ACCOUNT
        assert asset.label == "Test Account"
        assert asset.criticality == 75
        assert asset.owner == "user-123"
        assert asset.id is not None

    def test_asset_criticality_validation(self):
        with pytest.raises(ValueError):
            Asset(type=AssetType.ACCOUNT, label="Test", criticality=150, owner="u")
        with pytest.raises(ValueError):
            Asset(type=AssetType.ACCOUNT, label="Test", criticality=-1, owner="u")

    def test_finding_creation(self):
        finding = Finding(
            detector="phishing",
            severity=Severity.HIGH,
            confidence=0.85,
            title="Suspicious phishing email",
            risk_score=80,
        )
        assert finding.detector == "phishing"
        assert finding.severity == Severity.HIGH
        assert finding.confidence == 0.85
        assert finding.risk_score == 80
        assert finding.status == FindingStatus.NEW

    def test_finding_risk_score_validation(self):
        with pytest.raises(ValueError):
            Finding(detector="test", severity=Severity.LOW, confidence=0.5, title="Test", risk_score=150)
        with pytest.raises(ValueError):
            Finding(detector="test", severity=Severity.LOW, confidence=0.5, title="Test", risk_score=-10)

    def test_indicator_creation(self):
        indicator = Indicator.create(IndicatorType.URL, "https://example.com/phish")
        assert indicator.type == IndicatorType.URL
        assert indicator.normalized_value_hash == hash_value("https://example.com/phish")

    def test_evidence_creation(self):
        evidence = Evidence(
            source="phishing_analyzer",
            observed_at=utc_now(),
            confidence=0.9,
            normalized_payload={"verdict": "malicious"},
        )
        assert evidence.source == "phishing_analyzer"
        assert evidence.confidence == 0.9
        assert evidence.classification == DataClassification.SENSITIVE

    def test_phishing_request(self):
        request = PhishingAnalysisRequest(
            text="Urgent: Verify your account now!",
            urls=["https://phish.example.com/login"],
            sender="attacker@evil.com",
            subject="Account Verification",
        )
        assert request.text == "Urgent: Verify your account now!"
        assert len(request.urls) == 1
        assert request.sender == "attacker@evil.com"

    def test_phishing_result(self):
        result = PhishingAnalysisResult(
            verdict="malicious",
            confidence=0.92,
            category="phishing",
            evidence=[{"source": "url_structure", "confidence": 0.8}],
            indicators=[{"type": "url", "value": "https://phish.example.com"}],
            uncertainty=["No headers provided"],
            safe_next_steps=["Delete the message", "Report to IT"],
        )
        assert result.verdict == "malicious"
        assert result.confidence == 0.92
        assert len(result.evidence) == 1
        assert len(result.safe_next_steps) == 2


class TestEventEnvelope:
    def test_event_envelope_creation(self):
        from sentinel_schemas import EventEnvelope, EventType
        envelope = EventEnvelope(
            event_type=EventType.FINDING_CREATED,
            source="test_detector",
            subject_refs=["finding-123"],
            payload={"severity": "high"},
        )
        assert envelope.event_type == EventType.FINDING_CREATED
        assert envelope.source == "test_detector"
        assert envelope.schema_version == 1

    def test_event_hash_chain(self):
        from sentinel_schemas import EventEnvelope, EventType
        env1 = EventEnvelope(
            event_type=EventType.FINDING_CREATED,
            source="detector",
            subject_refs=[],
            payload={"data": "1"},
        )
        env1.previous_hash = None
        env1.event_hash = env1.compute_hash()

        env2 = EventEnvelope(
            event_type=EventType.FINDING_UPDATED,
            source="detector",
            subject_refs=[],
            payload={"data": "2"},
        )
        env2.previous_hash = env1.event_hash
        env2.event_hash = env2.compute_hash()

        assert env2.previous_hash == env1.event_hash
        assert env2.event_hash != env1.event_hash