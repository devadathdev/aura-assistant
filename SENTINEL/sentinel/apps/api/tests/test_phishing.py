import pytest
from sentinel_schemas import PhishingAnalysisRequest

from sentinel_api.workers.phishing import (
    analyze_content,
    analyze_phishing_content,
    analyze_url_structure,
    check_sender_headers,
    extract_domains,
    extract_urls,
)


class TestPhishingAnalysis:
    def test_extract_urls(self):
        text = "Check out https://example.com and http://test.org/path"
        urls = extract_urls(text)
        assert len(urls) == 2
        assert "https://example.com" in urls
        assert "http://test.org/path" in urls

    def test_extract_urls_with_www(self):
        text = "Visit www.example.com for more info"
        urls = extract_urls(text)
        assert len(urls) == 1
        assert urls[0] == "https://www.example.com"

    def test_extract_domains(self):
        text = "Go to https://sub.example.com/path and http://test.org"
        domains = extract_domains(text)
        assert len(domains) == 2
        assert "sub.example.com" in domains
        assert "test.org" in domains

    def test_analyze_url_structure_normal(self):
        result = analyze_url_structure("https://example.com/login")
        assert result["domain"] == "example.com"
        assert result["tld"] == "com"
        assert result["subdomain_count"] == 0
        assert result["is_shortener"] is False
        assert result["has_ip"] is False

    def test_analyze_url_structure_shortener(self):
        result = analyze_url_structure("https://bit.ly/abc123")
        assert result["is_shortener"] is True
        assert "URL shortener detected" in result["risk_factors"]

    def test_analyze_url_structure_suspicious_tld(self):
        result = analyze_url_structure("https://evil.tk/phish")
        assert result["suspicious_tld"] is True
        assert "Suspicious TLD: .tk" in result["risk_factors"]

    def test_analyze_url_structure_ip_address(self):
        result = analyze_url_structure("http://192.168.1.1/admin")
        assert result["has_ip"] is True
        assert "Direct IP address used" in result["risk_factors"]

    def test_analyze_url_structure_many_subdomains(self):
        result = analyze_url_structure("https://a.b.c.d.evil.com/path")
        assert result["subdomain_count"] >= 3
        assert "Excessive subdomains" in result["risk_factors"]

    def test_analyze_url_structure_suspicious_path(self):
        result = analyze_url_structure("https://example.com/verify-account-login")
        assert "Suspicious path keywords" in result["risk_factors"]

    def test_analyze_content_phishing_keywords(self):
        text = "Urgent: Your account will be suspended. Verify your password immediately!"
        result = analyze_content(text)
        assert "urgent" in result["social_engineering_indicators"]
        assert "suspend" in result["social_engineering_indicators"]
        assert "verify" in result["social_engineering_indicators"]
        assert "password" in result["social_engineering_indicators"]
        assert "immediate" in result["social_engineering_indicators"]
        assert result["urgency_score"] > 0
        assert result["credential_score"] > 0
        assert result["threat_score"] > 0

    def test_analyze_content_financial_keywords(self):
        text = "Payment required: Wire transfer $5000 to avoid legal action"
        result = analyze_content(text)
        assert "payment" in result["social_engineering_indicators"]
        assert "wire" in result["social_engineering_indicators"]
        assert "legal" in result["social_engineering_indicators"]
        assert result["financial_score"] > 0
        assert result["threat_score"] > 0

    def test_analyze_content_reward_keywords(self):
        text = "Congratulations! You are a winner of the lottery prize. Claim your inheritance now!"
        result = analyze_content(text)
        assert "congratulations" in result["social_engineering_indicators"]
        assert "winner" in result["social_engineering_indicators"]
        assert "prize" in result["social_engineering_indicators"]
        assert "inheritance" in result["social_engineering_indicators"]
        assert result["reward_score"] > 0

    def test_analyze_content_benign(self):
        text = "Hey, just wanted to share this article about cybersecurity best practices."
        result = analyze_content(text)
        assert len(result["social_engineering_indicators"]) == 0
        assert result["total_score"] == 0

    def test_check_sender_headers_spf_fail(self):
        headers = {
            "from": "sender@example.com",
            "authentication-results": "spf=fail dkim=pass dmarc=pass",
        }
        result = check_sender_headers(headers)
        assert "SPF check failed" in result["checks"]
        assert result["score"] >= 25

    def test_check_sender_headers_dkim_fail(self):
        headers = {
            "from": "sender@example.com",
            "authentication-results": "spf=pass dkim=fail dmarc=pass",
        }
        result = check_sender_headers(headers)
        assert "DKIM check failed" in result["checks"]
        assert result["score"] >= 25

    def test_check_sender_headers_dmarc_fail(self):
        headers = {
            "from": "sender@example.com",
            "authentication-results": "spf=pass dkim=pass dmarc=fail",
        }
        result = check_sender_headers(headers)
        assert "DMARC check failed" in result["checks"]
        assert result["score"] >= 30

    def test_check_sender_headers_reply_to_mismatch(self):
        headers = {
            "from": "sender@example.com",
            "reply-to": "different@evil.com",
        }
        result = check_sender_headers(headers)
        assert "Reply-To differs from From" in result["checks"]
        assert result["score"] >= 20

    def test_check_sender_headers_return_path_mismatch(self):
        headers = {
            "from": "sender@example.com",
            "return-path": "bounce@evil.com",
        }
        result = check_sender_headers(headers)
        assert "Return-Path differs from From" in result["checks"]
        assert result["score"] >= 15

    def test_check_sender_headers_clean(self):
        headers = {
            "from": "sender@example.com",
            "reply-to": "sender@example.com",
            "return-path": "sender@example.com",
            "authentication-results": "spf=pass dkim=pass dmarc=pass",
        }
        result = check_sender_headers(headers)
        assert len(result["checks"]) == 0
        assert result["score"] == 0

    @pytest.mark.asyncio
    async def test_analyze_phishing_content_malicious(self):
        request = PhishingAnalysisRequest(
            text="Urgent: Your account will be suspended! Verify your password immediately at https://bit.ly/phish123",
            urls=["https://bit.ly/phish123", "https://evil.tk/login"],
            sender="security@fake-bank.com",
            subject="Account Verification Required",
            headers={"authentication-results": "spf=fail dkim=fail dmarc=fail"},
        )
        result = await analyze_phishing_content(request, "user-123", None)
        assert result.verdict in ("malicious", "suspicious")
        assert result.confidence > 0.5
        assert len(result.evidence) > 0
        assert len(result.safe_next_steps) > 0

    @pytest.mark.asyncio
    async def test_analyze_phishing_content_benign(self):
        request = PhishingAnalysisRequest(
            text="Hey, here's the link to the documentation: https://docs.example.com",
            urls=["https://docs.example.com"],
        )
        result = await analyze_phishing_content(request, "user-123", None)
        assert result.verdict in ("benign", "caution")
        assert len(result.safe_next_steps) > 0

    @pytest.mark.asyncio
    async def test_analyze_phishing_content_empty(self):
        request = PhishingAnalysisRequest()
        result = await analyze_phishing_content(request, "user-123", None)
        assert "No URLs or text content provided for analysis" in result.uncertainty