"""FastAPI entry point for the Hybrid Creative Canvas platform."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .canvas_schema import CanvasPayload
from .canvas_store import CanvasConflictError, CanvasStore
from .requirements_catalog import RequirementsCatalog
from .store import CounterState, CounterStore
from .svg_export import render_svg

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class CounterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    count: int
    updated_at: str


class CreateCanvasRequest(BaseModel):
    name: str = Field(default="Untitled Canvas", min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    data: CanvasPayload | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("A project name is required")
        return value.strip()


class UpdateCanvasRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    data: CanvasPayload | None = None
    expected_revision: int | None = Field(default=None, ge=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("A project name is required")
        return value.strip() if value is not None else None


class VersionRequest(BaseModel):
    label: str = Field(default="Checkpoint", min_length=1, max_length=100)
    expected_revision: int | None = Field(default=None, ge=0)

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("A version label is required")
        return value.strip()


class RestoreRequest(BaseModel):
    expected_revision: int | None = Field(default=None, ge=0)


def configured_database_path() -> Path:
    configured = Path(os.environ.get("COUNTER_DB_PATH", "data/canvas.db")).expanduser()
    return configured if configured.is_absolute() else PROJECT_ROOT / configured


def configured_cors_origins() -> list[str]:
    value = os.environ.get(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    )
    return [origin.strip() for origin in value.split(",") if origin.strip()]


def get_canvas_store(request: Request) -> CanvasStore:
    return request.app.state.canvas_store


def get_counter_store(request: Request) -> CounterStore:
    return request.app.state.counter_store


def create_app(database_path: Path | None = None, requirements_root: Path | None = None) -> FastAPI:
    db_path = database_path or configured_database_path()
    counter_store = CounterStore(db_path)
    canvas_store = CanvasStore(db_path)
    catalog = RequirementsCatalog(requirements_root or PROJECT_ROOT / "requirement" / "downloaded_docs")

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        counter_store.initialize()
        canvas_store.initialize()
        application.state.counter_store = counter_store
        application.state.canvas_store = canvas_store
        yield

    application = FastAPI(
        title="OmniCanvas: Hybrid Creative Canvas API",
        description="A phased design platform with a source-linked requirements backlog and durable local canvas foundation.",
        version="1.1.0",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=configured_cors_origins(),
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @application.exception_handler(CanvasConflictError)
    async def revision_conflict(request: Request, error: CanvasConflictError) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": str(error), "revision": error.revision})

    @application.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, error: RequestValidationError) -> JSONResponse:
        details = [{"loc": item["loc"], "msg": item["msg"], "type": item["type"]} for item in error.errors()]
        return JSONResponse(status_code=422, content={"detail": details})

    # Health check
    @application.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @application.get("/api/requirements")
    def requirements_summary() -> dict[str, Any]:
        return catalog.summary()

    @application.get("/api/requirements/topics")
    def requirements_topics(
        q: str = Query(default="", max_length=200),
        source: str | None = Query(default=None, max_length=30),
        phase: int | None = Query(default=None, ge=1, le=6),
        offset: int = Query(default=0, ge=0),
        limit: int = Query(default=30, ge=1, le=100),
    ) -> dict[str, Any]:
        return catalog.topics(q, source, phase, offset, limit)

    # Counter endpoints for backward compatibility & template tests
    @application.get("/api/counter", response_model=CounterResponse)
    def read_counter(store: CounterStore = Depends(get_counter_store)) -> CounterState:
        return store.get()

    @application.post("/api/counter/click", response_model=CounterResponse)
    def record_click(store: CounterStore = Depends(get_counter_store)) -> CounterState:
        return store.increment()

    @application.delete("/api/counter", response_model=CounterResponse)
    def clear_counter(store: CounterStore = Depends(get_counter_store)) -> CounterState:
        return store.reset()

    # Canvas Endpoints
    @application.get("/api/canvases")
    def list_canvases(store: CanvasStore = Depends(get_canvas_store)) -> list[dict[str, Any]]:
        return store.list_canvases()

    @application.post("/api/canvases", status_code=201)
    def create_canvas(request: CreateCanvasRequest, store: CanvasStore = Depends(get_canvas_store)) -> dict[str, Any]:
        return store.create_canvas(
            name=request.name, description=request.description,
            data=request.data.model_dump() if request.data is not None else None,
        )

    @application.get("/api/canvases/{canvas_id}")
    def get_canvas(canvas_id: str, store: CanvasStore = Depends(get_canvas_store)) -> dict[str, Any]:
        canvas = store.get_canvas(canvas_id)
        if not canvas:
            raise HTTPException(status_code=404, detail="Canvas not found")
        return canvas

    @application.put("/api/canvases/{canvas_id}")
    def update_canvas(canvas_id: str, request: UpdateCanvasRequest, store: CanvasStore = Depends(get_canvas_store)) -> dict[str, Any]:
        updated = store.update_canvas(
            canvas_id=canvas_id, name=request.name, description=request.description,
            data=request.data.model_dump() if request.data is not None else None,
            expected_revision=request.expected_revision,
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Canvas not found")
        return updated

    @application.delete("/api/canvases/{canvas_id}")
    def delete_canvas(canvas_id: str, store: CanvasStore = Depends(get_canvas_store)) -> dict[str, bool]:
        success = store.delete_canvas(canvas_id)
        if not success:
            raise HTTPException(status_code=404, detail="Canvas not found")
        return {"deleted": True}

    @application.post("/api/canvases/{canvas_id}/duplicate", status_code=201)
    def duplicate_canvas(canvas_id: str, store: CanvasStore = Depends(get_canvas_store)) -> dict[str, Any]:
        cloned = store.duplicate_canvas(canvas_id)
        if not cloned:
            raise HTTPException(status_code=404, detail="Canvas not found")
        return cloned

    @application.get("/api/canvases/{canvas_id}/versions")
    def list_versions(canvas_id: str, store: CanvasStore = Depends(get_canvas_store)) -> list[dict[str, Any]]:
        versions = store.list_versions(canvas_id)
        if versions is None:
            raise HTTPException(status_code=404, detail="Canvas not found")
        return versions

    @application.post("/api/canvases/{canvas_id}/versions", status_code=201)
    def create_version(canvas_id: str, request: VersionRequest, store: CanvasStore = Depends(get_canvas_store)) -> dict[str, Any]:
        version = store.create_version(canvas_id, request.label, request.expected_revision)
        if version is None:
            raise HTTPException(status_code=404, detail="Canvas not found")
        return version

    @application.get("/api/canvases/{canvas_id}/versions/{version_id}")
    def get_version(canvas_id: str, version_id: str, store: CanvasStore = Depends(get_canvas_store)) -> dict[str, Any]:
        version = store.get_version(canvas_id, version_id)
        if version is None:
            raise HTTPException(status_code=404, detail="Version not found")
        return version

    @application.post("/api/canvases/{canvas_id}/versions/{version_id}/restore")
    def restore_version(canvas_id: str, version_id: str, request: RestoreRequest, store: CanvasStore = Depends(get_canvas_store)) -> dict[str, Any]:
        restored = store.restore_version(canvas_id, version_id, request.expected_revision)
        if restored is None:
            raise HTTPException(status_code=404, detail="Version not found")
        return restored

    @application.post("/api/export/svg")
    def render_document_svg(data: CanvasPayload) -> Response:
        return Response(content=render_svg(data.model_dump()), media_type="image/svg+xml")

    @application.get("/api/canvases/{canvas_id}/export/svg")
    def export_canvas_svg(canvas_id: str, store: CanvasStore = Depends(get_canvas_store)) -> Response:
        canvas = store.get_canvas(canvas_id)
        if not canvas:
            raise HTTPException(status_code=404, detail="Canvas not found")
        return Response(content=render_svg(canvas["data"]), media_type="image/svg+xml")

    return application


app = create_app()
