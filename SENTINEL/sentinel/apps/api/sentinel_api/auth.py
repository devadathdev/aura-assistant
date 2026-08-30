from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sentinel_api.config import get_settings
from sentinel_api.database import UserModel, get_session


def utc_now() -> datetime:
    return datetime.now(UTC)


class TokenData(BaseModel):
    sub: str
    user_id: str
    exp: int
    iat: int
    type: str = "access"


class AuthUser(BaseModel):
    id: str
    auth_subject: str
    settings: dict[str, Any]
    privacy_mode: str


security = HTTPBearer(auto_error=False)


def create_access_token(user_id: str, auth_subject: str) -> str:
    settings = get_settings()
    now = utc_now()
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": auth_subject,
        "user_id": user_id,
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
        "type": "access",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str, auth_subject: str) -> str:
    settings = get_settings()
    now = utc_now()
    expire = now + timedelta(days=settings.refresh_token_expire_days)
    payload = {
        "sub": auth_subject,
        "user_id": user_id,
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> TokenData | None:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        return TokenData(**payload)
    except JWTError:
        return None


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> AuthUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_data = decode_token(credentials.credentials)
    if token_data is None or token_data.type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await session.execute(select(UserModel).where(UserModel.id == token_data.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return AuthUser(
        id=user.id,
        auth_subject=user.auth_subject,
        settings=user.settings,
        privacy_mode=user.privacy_mode,
    )


async def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> AuthUser | None:
    if credentials is None:
        return None

    token_data = decode_token(credentials.credentials)
    if token_data is None or token_data.type != "access":
        return None

    result = await session.execute(select(UserModel).where(UserModel.id == token_data.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        return None

    return AuthUser(
        id=user.id,
        auth_subject=user.auth_subject,
        settings=user.settings,
        privacy_mode=user.privacy_mode,
    )


def require_auth(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    return user