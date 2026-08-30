from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from pydantic import HttpUrl, ValidationError
from sentinel_schemas import (
    PhishingAnalysisRequest,
    PhishingAnalysisResult,
)
from sqlalchemy.ext.asyncio import AsyncSession

MAX_TEXT_LENGTH = 50000
MAX_URLS = 100
MAX_HEADERS = 50

URL_SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
    "adf.ly", "bc.vc", "tiny.cc", "lnkd.in", "db.tt", "qr.ae", "cur.lv",
    "cutt.ly", "short.io", "rebrand.ly", "shorte.st", "clck.ru",
}

SUSPICIOUS_TLDS = {
    "tk", "ml", "ga", "cf", "gq", "top", "xyz", "click", "download", "link",
    "work", "party", "science", "racing", "review", "faith", "accountant",
}

SOCIAL_ENGINEERING_KEYWORDS = [
    "urgent", "immediate", "action required", "verify", "suspend", "locked",
    "unauthorized", "compromised", "security alert", "update your", "confirm",
    "password", "credential", "login", "signin", "authentication", "billing",
    "invoice", "payment", "refund", "tax", "government", "official", "legal",
    "lawsuit", "arrest", "warrant", "frozen", "limited", "expire", "deadline",
    "congratulations", "winner", "prize", "lottery", "inheritance", "beneficiary",
    "transfer", "wire", "bitcoin", "cryptocurrency", "wallet", "investment",
]


def validate_request(request: PhishingAnalysisRequest) -> list[str]:
    errors = []
    
    if request.text and len(request.text) > MAX_TEXT_LENGTH:
        errors.append(f"Text content exceeds maximum length of {MAX_TEXT_LENGTH} characters")
    
    if len(request.urls) > MAX_URLS:
        errors.append(f"Too many URLs provided (max {MAX_URLS})")
    
    if request.headers and len(request.headers) > MAX_HEADERS:
        errors.append(f"Too many headers provided (max {MAX_HEADERS})")
    
    for url in request.urls:
        try:
            HttpUrl(url)
        except ValidationError:
            errors.append(f"Invalid URL format: {url}")
    
    return errors


def extract_urls(text: str) -> list[str]:
    url_pattern = r'https?://[^\s<>"\']+|www\.[^\s<>"\']+'
    urls = re.findall(url_pattern, text, re.IGNORECASE)
    normalized = []
    for url in urls:
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        normalized.append(url)
    return normalized


def extract_domains(text: str) -> list[str]:
    urls = extract_urls(text)
    domains = []
    for url in urls:
        try:
            parsed = urlparse(url)
            if parsed.netloc:
                domains.append(parsed.netloc.lower())
        except Exception:
            pass
    return domains


def analyze_url_structure(url: str) -> dict[str, Any]:
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        path = parsed.path

        parts = domain.split(".")
        tld = parts[-1] if parts else ""
        subdomain_count = len(parts) - 2 if len(parts) > 2 else 0

        is_shortener = domain in URL_SHORTENERS
        suspicious_tld = tld in SUSPICIOUS_TLDS
        has_ip = bool(re.match(r"^\d+\.\d+\.\d+\.\d+$", domain))
        long_subdomain = subdomain_count > 3
        suspicious_path = any(kw in path.lower() for kw in ["login", "signin", "verify", "secure", "account", "update", "confirm"])

        risk_factors = []
        if is_shortener:
            risk_factors.append("URL shortener detected")
        if suspicious_tld:
            risk_factors.append(f"Suspicious TLD: .{tld}")
        if has_ip:
            risk_factors.append("Direct IP address used")
        if long_subdomain:
            risk_factors.append("Excessive subdomains")
        if suspicious_path:
            risk_factors.append("Suspicious path keywords")

        return {
            "domain": domain,
            "tld": tld,
            "subdomain_count": subdomain_count,
            "is_shortener": is_shortener,
            "suspicious_tld": suspicious_tld,
            "has_ip": has_ip,
            "risk_factors": risk_factors,
            "risk_score": len(risk_factors) * 15,
        }
    except Exception as e:
        return {"error": str(e), "risk_score": 50, "risk_factors": ["Parse error"]}


def analyze_content(text: str) -> dict[str, Any]:
    text_lower = text.lower()
    found_keywords = [kw for kw in SOCIAL_ENGINEERING_KEYWORDS if kw in text_lower]

    urgency_score = sum(2 for kw in ["urgent", "immediate", "action required", "deadline", "expire"] if kw in text_lower)
    credential_score = sum(3 for kw in ["password", "credential", "login", "verify", "authentication"] if kw in text_lower)
    financial_score = sum(3 for kw in ["payment", "billing", "invoice", "refund", "transfer", "wire", "bitcoin"] if kw in text_lower)
    threat_score = sum(3 for kw in ["suspend", "locked", "unauthorized", "compromised", "legal", "lawsuit", "arrest"] if kw in text_lower)
    reward_score = sum(2 for kw in ["congratulations", "winner", "prize", "lottery", "inheritance"] if kw in text_lower)

    total_score = urgency_score + credential_score + financial_score + threat_score + reward_score

    return {
        "social_engineering_indicators": found_keywords,
        "urgency_score": urgency_score,
        "credential_score": credential_score,
        "financial_score": financial_score,
        "threat_score": threat_score,
        "reward_score": reward_score,
        "total_score": total_score,
    }


def check_sender_headers(headers: dict[str, str] | None) -> dict[str, Any]:
    if not headers:
        return {"checks": [], "score": 0}

    results = []
    score = 0

    from_header = headers.get("from", "")
    reply_to = headers.get("reply-to", "")
    return_path = headers.get("return-path", "")

    if reply_to and from_header and reply_to.lower() != from_header.lower():
        results.append("Reply-To differs from From")
        score += 20

    if return_path and from_header and return_path.lower() != from_header.lower():
        results.append("Return-Path differs from From")
        score += 15

    auth_results = headers.get("authentication-results", "")
    if "spf=fail" in auth_results.lower():
        results.append("SPF check failed")
        score += 25
    if "dkim=fail" in auth_results.lower():
        results.append("DKIM check failed")
        score += 25
    if "dmarc=fail" in auth_results.lower():
        results.append("DMARC check failed")
        score += 30

    return {"checks": results, "score": score}


async def analyze_phishing_content(
    request: PhishingAnalysisRequest,
    user_id: str,
    session: AsyncSession,
) -> PhishingAnalysisResult:
    validation_errors = validate_request(request)
    if validation_errors:
        return PhishingAnalysisResult(
            verdict="error",
            confidence=0.0,
            category="validation_error",
            evidence=[],
            indicators=[],
            uncertainty=validation_errors,
            safe_next_steps=["Please fix the validation errors and try again"],
            ai_explanation=None,
        )

    all_text = " ".join(filter(None, [
        request.text or "",
        request.subject or "",
        " ".join(request.urls),
    ]))

    urls = list(request.urls)
    if request.text:
        urls.extend(extract_urls(request.text))

    url_analyses = [analyze_url_structure(url) for url in urls]
    content_analysis = analyze_content(all_text)
    header_analysis = check_sender_headers(request.headers)

    total_risk = sum(a.get("risk_score", 0) for a in url_analyses)
    total_risk += content_analysis["total_score"]
    total_risk += header_analysis["score"]

    max_risk = 100
    normalized_risk = min(total_risk, max_risk)

    if normalized_risk >= 75:
        verdict = "malicious"
        category = "phishing"
        confidence = 0.85
    elif normalized_risk >= 50:
        verdict = "suspicious"
        category = "likely_phishing"
        confidence = 0.7
    elif normalized_risk >= 25:
        verdict = "caution"
        category = "potential_phishing"
        confidence = 0.55
    else:
        verdict = "benign"
        category = "clean"
        confidence = 0.8

    evidence = []
    indicators = []
    uncertainty = []

    for url, analysis in zip(urls, url_analyses):
        if analysis.get("risk_factors"):
            evidence.append({
                "source": "url_structure",
                "indicator": url,
                "factors": analysis["risk_factors"],
                "confidence": 0.7,
            })
            indicators.append({
                "type": "url",
                "value": url,
                "risk_factors": analysis["risk_factors"],
            })

    if content_analysis["social_engineering_indicators"]:
        evidence.append({
            "source": "content_analysis",
            "indicators": content_analysis["social_engineering_indicators"],
            "scores": {
                "urgency": content_analysis["urgency_score"],
                "credential": content_analysis["credential_score"],
                "financial": content_analysis["financial_score"],
                "threat": content_analysis["threat_score"],
                "reward": content_analysis["reward_score"],
            },
            "confidence": 0.6,
        })

    if header_analysis["checks"]:
        evidence.append({
            "source": "header_analysis",
            "checks": header_analysis["checks"],
            "confidence": 0.8,
        })

    if not urls and not request.text:
        uncertainty.append("No URLs or text content provided for analysis")
    if not request.headers:
        uncertainty.append("No email headers provided for authentication verification")

    safe_next_steps = [
        "Do not click any links in the message",
        "Do not provide any credentials or personal information",
        "Verify the sender through a known, trusted channel",
        "Report the message to your IT/security team if applicable",
    ]

    if verdict in ("malicious", "suspicious"):
        safe_next_steps.insert(0, "Delete the message immediately")

    return PhishingAnalysisResult(
        verdict=verdict,
        confidence=confidence,
        category=category,
        evidence=evidence,
        indicators=indicators,
        uncertainty=uncertainty,
        safe_next_steps=safe_next_steps,
        ai_explanation=None,
    )