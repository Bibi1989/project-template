"""FastAPI application entrypoint.

Ingress strips the `/api` prefix via NGINX rewrite before traffic reaches this
service, so handlers are registered at the root of the FastAPI app.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = Field(default="turnkey-api", alias="APP_NAME")
    environment: str = Field(default="development", alias="ENVIRONMENT")
    cors_origins: str = Field(default="*", alias="CORS_ORIGINS")
    database_url: str = Field(default="", alias="DATABASE_URL")
    api_secret_key: str = Field(default="", alias="API_SECRET_KEY")


settings = Settings()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    status: str
    environment: str
    service: str


class EchoRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1024)


class EchoResponse(BaseModel):
    echo: str
    tenant_hint: str | None = None


@app.get("/health", response_model=HealthResponse, tags=["ops"])
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        environment=settings.environment,
        service=settings.app_name,
    )


@app.get("/", tags=["root"])
async def root() -> dict[str, Any]:
    return {
        "service": settings.app_name,
        "environment": settings.environment,
        "message": "FastAPI backend is live behind NGINX Ingress (/api/*).",
        "has_database_url": bool(settings.database_url),
        "has_api_secret": bool(settings.api_secret_key or os.getenv("API_SECRET_KEY")),
    }


@app.post("/echo", response_model=EchoResponse, tags=["demo"])
async def echo(payload: EchoRequest) -> EchoResponse:
    return EchoResponse(echo=payload.message, tenant_hint=os.getenv("TENANT_ID"))
