from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from sentinel_api.config import get_settings
from sentinel_api.database import close_db, init_db
from sentinel_api.routes import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="SENTINEL API",
        description="Personal Digital Security AI - API Service",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=settings.cors_allow_methods,
        allow_headers=settings.cors_allow_headers,
    )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail, "error_code": f"HTTP_{exc.status_code}"},
        )

    @app.exception_handler(ValidationError)
    async def validation_exception_handler(request: Request, exc: ValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "detail": "Validation error",
                "error_code": "VALIDATION_ERROR",
                "errors": exc.errors(),
            },
        )

    @app.exception_handler(IntegrityError)
    async def integrity_exception_handler(request: Request, exc: IntegrityError):
        return JSONResponse(
            status_code=409,
            content={"detail": "Resource conflict", "error_code": "INTEGRITY_ERROR"},
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        if settings.debug:
            import traceback
            traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "error_code": "INTERNAL_ERROR"},
        )

    app.include_router(api_router, prefix="/api")

    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "service": "sentinel-api"}

    @app.get("/ready")
    async def readiness_check():
        return {"status": "ready", "service": "sentinel-api"}

    return app


app = create_app()