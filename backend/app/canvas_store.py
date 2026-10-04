"""Durable SQLite storage for Hybrid Creative Canvas documents."""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .canvas_schema import normalize_canvas_data


def default_canvas_data() -> dict[str, Any]:
    """Generates a rich starter document showcasing hybrid features."""
    return {
        "viewport": {"zoom": 1.0, "panX": 80, "panY": 60},
        "settings": {
            "grid": True,
            "snapToGrid": True,
            "gridSize": 20,
            "theme": "light",
            "backgroundColor": "#f8fafc",
        },
        "artboards": [
            {
                "id": "artboard-desktop",
                "name": "Desktop Hero (1440x900)",
                "preset": "desktop",
                "x": 100,
                "y": 100,
                "width": 840,
                "height": 520,
                "fill": "#ffffff",
                "clipContent": True,
            },
            {
                "id": "artboard-mobile",
                "name": "Mobile Screen (375x812)",
                "preset": "mobile",
                "x": 1000,
                "y": 100,
                "width": 375,
                "height": 620,
                "fill": "#f1f5f9",
                "clipContent": True,
            },
        ],
        "elements": [
            # Desktop Artboard elements
            {
                "id": "elem-hero-banner",
                "type": "rect",
                "name": "Hero Banner Card",
                "x": 140,
                "y": 150,
                "width": 760,
                "height": 220,
                "rotation": 0,
                "artboardId": "artboard-desktop",
                "fill": "#3b82f6",
                "stroke": "#2563eb",
                "strokeWidth": 2,
                "strokeDash": "solid",
                "opacity": 1.0,
                "cornerRadius": 16,
                "shadow": {"x": 0, "y": 8, "blur": 24, "color": "rgba(59, 130, 246, 0.25)"},
                "zIndex": 1,
            },
            {
                "id": "elem-hero-title",
                "type": "text",
                "name": "Hero Title",
                "x": 180,
                "y": 190,
                "width": 680,
                "height": 50,
                "rotation": 0,
                "artboardId": "artboard-desktop",
                "fill": "transparent",
                "stroke": "transparent",
                "strokeWidth": 0,
                "opacity": 1.0,
                "text": "OmniCanvas: Hybrid Design Studio",
                "fontSize": 32,
                "fontFamily": "Inter, sans-serif",
                "fontWeight": 700,
                "textAlign": "left",
                "textColor": "#ffffff",
                "zIndex": 2,
            },
            {
                "id": "elem-hero-sub",
                "type": "text",
                "name": "Hero Subtitle",
                "x": 180,
                "y": 250,
                "width": 640,
                "height": 40,
                "rotation": 0,
                "artboardId": "artboard-desktop",
                "fill": "transparent",
                "stroke": "transparent",
                "strokeWidth": 0,
                "opacity": 0.9,
                "text": "Vector shapes, whiteboard sticky notes, and layout artboards in one canvas.",
                "fontSize": 18,
                "fontFamily": "Inter, sans-serif",
                "fontWeight": 400,
                "textAlign": "left",
                "textColor": "#e0f2fe",
                "zIndex": 3,
            },
            {
                "id": "elem-circle-badge",
                "type": "circle",
                "name": "Featured Pill",
                "x": 150,
                "y": 410,
                "width": 90,
                "height": 90,
                "rotation": 0,
                "artboardId": "artboard-desktop",
                "fill": "#10b981",
                "stroke": "#059669",
                "strokeWidth": 3,
                "opacity": 0.95,
                "shadow": {"x": 0, "y": 4, "blur": 12, "color": "rgba(16, 185, 129, 0.3)"},
                "zIndex": 4,
            },
            {
                "id": "elem-star-icon",
                "type": "star",
                "name": "Highlight Star",
                "x": 270,
                "y": 410,
                "width": 90,
                "height": 90,
                "rotation": 0,
                "artboardId": "artboard-desktop",
                "fill": "#f59e0b",
                "stroke": "#d97706",
                "strokeWidth": 2,
                "opacity": 1.0,
                "zIndex": 5,
            },
            # Whiteboard Sticky Notes
            {
                "id": "sticky-1",
                "type": "sticky",
                "name": "Design Idea Note",
                "x": 420,
                "y": 400,
                "width": 210,
                "height": 180,
                "rotation": -2,
                "fill": "#fef08a",
                "stroke": "#facc15",
                "strokeWidth": 1,
                "opacity": 1.0,
                "cornerRadius": 6,
                "shadow": {"x": 2, "y": 6, "blur": 14, "color": "rgba(0,0,0,0.12)"},
                "text": "Idea: Add real-time drag snapping and device presets for Framer & Webflow fidelity!",
                "fontSize": 15,
                "fontFamily": "Comic Sans MS, sans-serif",
                "textColor": "#713f12",
                "author": "Designer Alex",
                "colorPreset": "yellow",
                "zIndex": 6,
            },
            {
                "id": "sticky-2",
                "type": "sticky",
                "name": "Backend Plan Note",
                "x": 670,
                "y": 410,
                "width": 210,
                "height": 180,
                "rotation": 3,
                "fill": "#bae6fd",
                "stroke": "#38bdf8",
                "strokeWidth": 1,
                "opacity": 1.0,
                "cornerRadius": 6,
                "shadow": {"x": 2, "y": 6, "blur": 14, "color": "rgba(0,0,0,0.12)"},
                "text": "FastAPI + SQLite WAL persistence for high-speed auto-saving and full offline readiness.",
                "fontSize": 15,
                "fontFamily": "Inter, sans-serif",
                "textColor": "#0369a1",
                "author": "Tech Lead",
                "colorPreset": "blue",
                "zIndex": 7,
            },
            # Mobile Screen elements
            {
                "id": "elem-mobile-nav",
                "type": "rect",
                "name": "Mobile Header Bar",
                "x": 1020,
                "y": 140,
                "width": 335,
                "height": 60,
                "rotation": 0,
                "artboardId": "artboard-mobile",
                "fill": "#0f172a",
                "stroke": "transparent",
                "strokeWidth": 0,
                "opacity": 1.0,
                "cornerRadius": 12,
                "zIndex": 8,
            },
            {
                "id": "elem-mobile-nav-text",
                "type": "text",
                "name": "Mobile Title",
                "x": 1040,
                "y": 158,
                "width": 290,
                "height": 28,
                "rotation": 0,
                "artboardId": "artboard-mobile",
                "fill": "transparent",
                "stroke": "transparent",
                "strokeWidth": 0,
                "opacity": 1.0,
                "text": "Design Studio Mobile",
                "fontSize": 16,
                "fontFamily": "Inter, sans-serif",
                "fontWeight": 600,
                "textAlign": "center",
                "textColor": "#ffffff",
                "zIndex": 9,
            },
            {
                "id": "sticky-mobile",
                "type": "sticky",
                "name": "Mobile Feedback Note",
                "x": 1045,
                "y": 240,
                "width": 285,
                "height": 190,
                "rotation": 1,
                "artboardId": "artboard-mobile",
                "fill": "#fbcfe8",
                "stroke": "#f472b6",
                "strokeWidth": 1,
                "opacity": 1.0,
                "cornerRadius": 8,
                "shadow": {"x": 2, "y": 4, "blur": 10, "color": "rgba(0,0,0,0.1)"},
                "text": "Mobile UX: Clean touch controls, pinch-to-zoom, and responsive layout preview.",
                "fontSize": 15,
                "fontFamily": "Inter, sans-serif",
                "textColor": "#831843",
                "author": "Product Manager",
                "colorPreset": "pink",
                "zIndex": 10,
            },
        ],
        "connectors": [
            {
                "id": "conn-1",
                "fromElementId": "sticky-1",
                "toElementId": "sticky-2",
                "stroke": "#0284c7",
                "strokeWidth": 2,
                "strokeDash": "dashed",
                "arrowEnd": True,
                "label": "informs",
            }
        ],
    }


@dataclass
class CanvasSummary:
    id: str
    name: str
    description: str
    element_count: int
    artboard_count: int
    created_at: str
    updated_at: str


class CanvasConflictError(Exception):
    def __init__(self, revision: int):
        super().__init__("The document changed on the server. Reload it before saving again.")
        self.revision = revision


class CanvasStore:
    """Manages persistent SQLite storage for creative canvas documents."""

    def __init__(self, database_path: Path):
        self.database_path = Path(database_path)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _document(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"], "name": row["name"], "description": row["description"],
            "data": normalize_canvas_data(json.loads(row["data"])), "revision": row["revision"],
            "created_at": row["created_at"], "updated_at": row["updated_at"],
        }

    @staticmethod
    def _check_revision(row: sqlite3.Row, expected_revision: int | None) -> None:
        if expected_revision is not None and row["revision"] != expected_revision:
            raise CanvasConflictError(row["revision"])

    def initialize(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as connection, connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS canvases (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    data TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    revision INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            columns = {row["name"] for row in connection.execute("PRAGMA table_info(canvases)")}
            if "revision" not in columns:
                connection.execute("ALTER TABLE canvases ADD COLUMN revision INTEGER NOT NULL DEFAULT 0")
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_canvases_updated_at ON canvases(updated_at DESC)"
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS canvas_versions (
                    id TEXT PRIMARY KEY,
                    canvas_id TEXT NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
                    label TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    data TEXT NOT NULL,
                    revision INTEGER NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_canvas_versions ON canvas_versions(canvas_id, created_at DESC)"
            )

            # Check if any canvas exists; if not, create the starter project
            row = connection.execute("SELECT COUNT(*) AS total FROM canvases").fetchone()
            if row and row["total"] == 0:
                starter_id = "default-starter-canvas"
                now = self._now()
                connection.execute(
                    """
                    INSERT INTO canvases (id, name, description, data, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (starter_id, "Starter Project: Hybrid Creative Canvas",
                     "Demonstrates vector design shapes, whiteboard sticky notes, and layout artboards.",
                     json.dumps(default_canvas_data()), now, now),
                )

    def list_canvases(self) -> list[dict[str, Any]]:
        with closing(self._connect()) as connection:
            rows = connection.execute("SELECT * FROM canvases ORDER BY updated_at DESC").fetchall()
        summaries = []
        for row in rows:
            parsed = json.loads(row["data"])
            summaries.append({
                "id": row["id"], "name": row["name"], "description": row["description"],
                "element_count": len(parsed.get("elements", [])), "artboard_count": len(parsed.get("artboards", [])),
                "revision": row["revision"], "created_at": row["created_at"], "updated_at": row["updated_at"],
            })
        return summaries

    def get_canvas(self, canvas_id: str) -> dict[str, Any] | None:
        with closing(self._connect()) as connection:
            row = connection.execute("SELECT * FROM canvases WHERE id = ?", (canvas_id,)).fetchone()
        return self._document(row) if row else None

    def create_canvas(
        self, name: str, description: str = "", data: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        canvas_id = f"canvas-{uuid.uuid4().hex[:12]}"
        now = self._now()
        payload = normalize_canvas_data(data if data is not None else default_canvas_data())
        with closing(self._connect()) as connection, connection:
            connection.execute(
                "INSERT INTO canvases (id, name, description, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (canvas_id, name, description, json.dumps(payload, allow_nan=False), now, now),
            )
        return {"id": canvas_id, "name": name, "description": description, "data": payload,
                "revision": 0, "created_at": now, "updated_at": now}

    def update_canvas(
        self, canvas_id: str, name: str | None = None, description: str | None = None,
        data: dict[str, Any] | None = None, expected_revision: int | None = None,
    ) -> dict[str, Any] | None:
        with closing(self._connect()) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute("SELECT * FROM canvases WHERE id = ?", (canvas_id,)).fetchone()
            if not row:
                return None
            self._check_revision(row, expected_revision)
            payload = normalize_canvas_data(data) if data is not None else json.loads(row["data"])
            connection.execute(
                "UPDATE canvases SET name = ?, description = ?, data = ?, updated_at = ?, revision = revision + 1 WHERE id = ?",
                (name if name is not None else row["name"], description if description is not None else row["description"],
                 json.dumps(payload, allow_nan=False), self._now(), canvas_id),
            )
            updated = connection.execute("SELECT * FROM canvases WHERE id = ?", (canvas_id,)).fetchone()
            return self._document(updated)

    def delete_canvas(self, canvas_id: str) -> bool:
        with closing(self._connect()) as connection, connection:
            cursor = connection.execute("DELETE FROM canvases WHERE id = ?", (canvas_id,))
            return cursor.rowcount > 0

    def duplicate_canvas(self, canvas_id: str) -> dict[str, Any] | None:
        source = self.get_canvas(canvas_id)
        if not source:
            return None
        return self.create_canvas(
            name=f"{source['name'][:113]} (Copy)", description=source["description"], data=source["data"],
        )

    def _snapshot(self, connection: sqlite3.Connection, row: sqlite3.Row, label: str) -> dict[str, Any]:
        identifier = f"version-{uuid.uuid4().hex[:12]}"
        created_at = self._now()
        connection.execute(
            "INSERT INTO canvas_versions (id, canvas_id, label, name, description, data, revision, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (identifier, row["id"], label, row["name"], row["description"], row["data"], row["revision"], created_at),
        )
        return {"id": identifier, "canvas_id": row["id"], "label": label, "name": row["name"],
                "revision": row["revision"], "created_at": created_at}

    def create_version(self, canvas_id: str, label: str, expected_revision: int | None = None) -> dict[str, Any] | None:
        with closing(self._connect()) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute("SELECT * FROM canvases WHERE id = ?", (canvas_id,)).fetchone()
            if not row:
                return None
            self._check_revision(row, expected_revision)
            return self._snapshot(connection, row, label)

    def list_versions(self, canvas_id: str) -> list[dict[str, Any]] | None:
        with closing(self._connect()) as connection:
            if not connection.execute("SELECT 1 FROM canvases WHERE id = ?", (canvas_id,)).fetchone():
                return None
            rows = connection.execute(
                "SELECT id, canvas_id, label, name, revision, created_at FROM canvas_versions WHERE canvas_id = ? ORDER BY created_at DESC",
                (canvas_id,),
            ).fetchall()
            return [dict(row) for row in rows]

    def get_version(self, canvas_id: str, version_id: str) -> dict[str, Any] | None:
        with closing(self._connect()) as connection:
            row = connection.execute(
                "SELECT * FROM canvas_versions WHERE id = ? AND canvas_id = ?", (version_id, canvas_id),
            ).fetchone()
        if not row:
            return None
        return {**dict(row), "data": normalize_canvas_data(json.loads(row["data"]))}

    def restore_version(
        self, canvas_id: str, version_id: str, expected_revision: int | None = None,
    ) -> dict[str, Any] | None:
        with closing(self._connect()) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            version = connection.execute(
                "SELECT * FROM canvas_versions WHERE id = ? AND canvas_id = ?", (version_id, canvas_id),
            ).fetchone()
            row = connection.execute("SELECT * FROM canvases WHERE id = ?", (canvas_id,)).fetchone()
            if not version or not row:
                return None
            self._check_revision(row, expected_revision)
            self._snapshot(connection, row, f"Before restoring: {version['label']}"[:100])
            connection.execute(
                "UPDATE canvases SET name = ?, description = ?, data = ?, updated_at = ?, revision = revision + 1 WHERE id = ?",
                (version["name"], version["description"], version["data"], self._now(), canvas_id),
            )
            updated = connection.execute("SELECT * FROM canvases WHERE id = ?", (canvas_id,)).fetchone()
            return self._document(updated)
