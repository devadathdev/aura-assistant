from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr
from sentinel_schemas import generate_ulid, utc_now
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sentinel_api.auth import (
    AuthUser,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)
from sentinel_api.database import UserModel, get_session

router = APIRouter(prefix="/v1/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    auth_subject: str
    settings: dict
    privacy_mode: str
    created_at: datetime


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(UserModel).where(UserModel.auth_subject == request.email)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    stored_hash = user.settings.get("password_hash")
    stored_salt = user.settings.get("password_salt")

    if not stored_hash or not stored_salt:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    from sentinel_security import verify_secret
    if not verify_secret(request.password, bytes.fromhex(stored_hash), bytes.fromhex(stored_salt)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    access_token = create_access_token(user.id, user.auth_subject)
    refresh_token = create_refresh_token(user.id, user.auth_subject)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    existing = await session.execute(
        select(UserModel).where(UserModel.auth_subject == request.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    from sentinel_security import hash_secret
    hashed, salt = hash_secret(request.password)

    user = UserModel(
        id=generate_ulid(),
        auth_subject=request.email,
        settings={
            "password_hash": hashed.hex(),
            "password_salt": salt.hex(),
        },
        privacy_mode="balanced",
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    session.add(user)
    await session.flush()

    access_token = create_access_token(user.id, user.auth_subject)
    refresh_token = create_refresh_token(user.id, user.auth_subject)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: RefreshRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    token_data = decode_token(request.refresh_token)
    if token_data is None or token_data.type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    result = await session.execute(
        select(UserModel).where(UserModel.id == token_data.user_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    access_token = create_access_token(user.id, user.auth_subject)
    new_refresh_token = create_refresh_token(user.id, user.auth_subject)

    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )

    return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="refresh_token")
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(UserModel).where(UserModel.id == user.id)
    )
    db_user = result.scalar_one_or_none()
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse(
        id=db_user.id,
        auth_subject=db_user.auth_subject,
        settings=db_user.settings,
        privacy_mode=db_user.privacy_mode,
        created_at=db_user.created_at,
    )