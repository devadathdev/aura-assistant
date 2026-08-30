from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def generate_key() -> bytes:
    return secrets.token_bytes(32)


def generate_nonce() -> bytes:
    return secrets.token_bytes(12)


@dataclass
class EncryptedData:
    ciphertext: bytes
    nonce: bytes
    tag: bytes = b""

    def to_dict(self) -> Dict[str, str]:
        return {
            "ciphertext": base64.b64encode(self.ciphertext).decode(),
            "nonce": base64.b64encode(self.nonce).decode(),
            "tag": base64.b64encode(self.tag).decode() if self.tag else "",
        }

    @classmethod
    def from_dict(cls, data: Dict[str, str]) -> "EncryptedData":
        return cls(
            ciphertext=base64.b64decode(data["ciphertext"]),
            nonce=base64.b64decode(data["nonce"]),
            tag=base64.b64decode(data["tag"]) if data.get("tag") else b"",
        )


class SymmetricEncryption:
    def __init__(self, key: bytes):
        if len(key) != 32:
            raise ValueError("Key must be 32 bytes")
        self._key = key
        self._aesgcm = AESGCM(key)

    def encrypt(self, plaintext: bytes, associated_data: Optional[bytes] = None) -> EncryptedData:
        nonce = generate_nonce()
        ciphertext = self._aesgcm.encrypt(nonce, plaintext, associated_data)
        return EncryptedData(ciphertext=ciphertext, nonce=nonce)

    def decrypt(self, encrypted: EncryptedData, associated_data: Optional[bytes] = None) -> bytes:
        return self._aesgcm.decrypt(encrypted.nonce, encrypted.ciphertext, associated_data)

    @classmethod
    def from_password(cls, password: str, salt: Optional[bytes] = None) -> "SymmetricEncryption":
        if salt is None:
            salt = secrets.token_bytes(16)
        kdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            info=b"sentinel-key-derivation",
        )
        key = kdf.derive(password.encode())
        return cls(key)


class AsymmetricKeyPair:
    def __init__(self, private_key: ed25519.Ed25519PrivateKey):
        self._private_key = private_key
        self._public_key = private_key.public_key()

    @classmethod
    def generate(cls) -> "AsymmetricKeyPair":
        return cls(ed25519.Ed25519PrivateKey.generate())

    @classmethod
    def from_private_bytes(cls, private_bytes: bytes) -> "AsymmetricKeyPair":
        return cls(ed25519.Ed25519PrivateKey.from_private_bytes(private_bytes))

    @classmethod
    def from_public_bytes(cls, public_bytes: bytes) -> "AsymmetricKeyPair":
        return cls.__new__(cls)

    @property
    def private_key(self) -> ed25519.Ed25519PrivateKey:
        return self._private_key

    @property
    def public_key(self) -> ed25519.Ed25519PublicKey:
        return self._public_key

    def private_bytes(self) -> bytes:
        return self._private_key.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption(),
        )

    def public_bytes(self) -> bytes:
        return self._public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )

    def sign(self, message: bytes) -> bytes:
        return self._private_key.sign(message)

    def verify(self, message: bytes, signature: bytes) -> bool:
        try:
            self._public_key.verify(signature, message)
            return True
        except Exception:
            return False


class KeyManager:
    def __init__(self, master_key: Optional[bytes] = None):
        self._master_key = master_key or generate_key()
        self._keys: Dict[str, bytes] = {}

    def derive_key(self, context: str, length: int = 32) -> bytes:
        kdf = HKDF(
            algorithm=hashes.SHA256(),
            length=length,
            salt=self._master_key,
            info=context.encode(),
        )
        return kdf.derive(b"sentinel-key-derivation")

    def get_or_create(self, key_id: str, context: str) -> bytes:
        if key_id not in self._keys:
            self._keys[key_id] = self.derive_key(context)
        return self._keys[key_id]

    def rotate_master_key(self, new_master_key: bytes) -> None:
        self._master_key = new_master_key
        self._keys.clear()


class AuditChain:
    def __init__(self, key: bytes):
        self._key = key
        self._previous_hash: Optional[str] = None

    def compute_event_hash(
        self,
        event_id: str,
        actor: str,
        event_type: str,
        object_ref: Optional[str],
        timestamp: datetime,
        payload: Dict[str, Any],
    ) -> str:
        data = {
            "event_id": event_id,
            "actor": actor,
            "event_type": event_type,
            "object_ref": object_ref,
            "timestamp": timestamp.isoformat(),
            "previous_hash": self._previous_hash,
            "payload": payload,
        }
        import json
        content = json.dumps(data, sort_keys=True).encode()
        hash_value = hmac.new(self._key, content, hashlib.sha256).hexdigest()
        self._previous_hash = hash_value
        return hash_value

    def verify_chain(self, events: List[Dict[str, Any]]) -> bool:
        previous_hash = None
        for event in events:
            data = {
                "event_id": event["event_id"],
                "actor": event["actor"],
                "event_type": event["event_type"],
                "object_ref": event.get("object_ref"),
                "timestamp": event["timestamp"],
                "previous_hash": previous_hash,
                "payload": event.get("payload", {}),
            }
            import json
            content = json.dumps(data, sort_keys=True).encode()
            expected_hash = hmac.new(self._key, content, hashlib.sha256).hexdigest()
            if event.get("event_hash") != expected_hash:
                return False
            previous_hash = expected_hash
        return True


def constant_time_compare(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)


def hash_secret(secret: str, salt: Optional[bytes] = None) -> tuple[bytes, bytes]:
    if salt is None:
        salt = secrets.token_bytes(16)
    kdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        info=b"sentinel-secret-hash",
    )
    return kdf.derive(secret.encode()), salt


def verify_secret(secret: str, hashed: bytes, salt: bytes) -> bool:
    derived, _ = hash_secret(secret, salt)
    return constant_time_compare(derived.hex(), hashed.hex())


class SecureToken:
    def __init__(self, key: bytes):
        self._key = key

    def create_token(self, payload: Dict[str, Any], ttl_seconds: int = 3600) -> str:
        import json
        import time
        header = {"alg": "HS256", "typ": "JWT"}
        now = int(time.time())
        claims = {
            **payload,
            "iat": now,
            "exp": now + ttl_seconds,
        }
        header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
        claims_b64 = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
        signing_input = f"{header_b64}.{claims_b64}"
        signature = hmac.new(self._key, signing_input.encode(), hashlib.sha256).digest()
        signature_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")
        return f"{signing_input}.{signature_b64}"

    def verify_token(self, token: str) -> dict[str, Any] | None:
        import json
        import time
        try:
            parts = token.split(".")
            if len(parts) != 3:
                return None
            signing_input = f"{parts[0]}.{parts[1]}"
            signature = base64.urlsafe_b64decode(parts[2] + "==")
            expected_signature = hmac.new(self._key, signing_input.encode(), hashlib.sha256).digest()
            if not constant_time_compare(signature.hex(), expected_signature.hex()):
                return None
            claims: dict[str, Any] = json.loads(base64.urlsafe_b64decode(parts[1] + "==").decode())
            if claims.get("exp", 0) < int(time.time()):
                return None
            return claims
        except Exception:
            return None


__all__ = [
    "utc_now",
    "generate_key",
    "generate_nonce",
    "EncryptedData",
    "SymmetricEncryption",
    "AsymmetricKeyPair",
    "KeyManager",
    "AuditChain",
    "constant_time_compare",
    "hash_secret",
    "verify_secret",
    "SecureToken",
]