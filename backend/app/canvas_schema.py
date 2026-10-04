from __future__ import annotations

import json
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Identifier = Annotated[str, Field(min_length=1, max_length=120, pattern=r"^[A-Za-z0-9_.:-]+$")]
Coordinate = Annotated[float, Field(ge=-10_000_000, le=10_000_000, allow_inf_nan=False)]
Dimension = Annotated[float, Field(ge=0, le=100_000, allow_inf_nan=False)]
Color = Annotated[str, Field(max_length=120, pattern=r"^[A-Za-z0-9#(),.%\s+-]+$")]


class ExtensibleModel(BaseModel):
    model_config = ConfigDict(extra="allow")


class ViewportPayload(ExtensibleModel):
    zoom: float = Field(default=1, ge=0.15, le=4, allow_inf_nan=False)
    panX: Coordinate = 0
    panY: Coordinate = 0


class SettingsPayload(ExtensibleModel):
    grid: bool = True
    snapToGrid: bool = True
    gridSize: int = Field(default=20, ge=1, le=1000)
    theme: Literal["light", "dark"] = "light"
    backgroundColor: Color = "#f8fafc"


class AutoLayoutPayload(ExtensibleModel):
    enabled: bool = True
    direction: Literal["row", "column"] = "row"
    gap: float = Field(default=16, ge=0, le=10_000, allow_inf_nan=False)
    padding: float = Field(default=20, ge=0, le=10_000, allow_inf_nan=False)
    align: Literal["start", "center", "end"] = "start"
    justify: Literal["start", "center", "end", "space-between", "space-around", "space-evenly"] = "start"
    wrap: bool = False


class ArtboardPayload(ExtensibleModel):
    id: Identifier
    name: str = Field(default="Artboard", max_length=500)
    preset: Literal["desktop", "tablet", "mobile", "presentation", "custom"] = "custom"
    x: Coordinate = 0
    y: Coordinate = 0
    width: Dimension = 600
    height: Dimension = 400
    fill: Color = "#ffffff"
    clipContent: bool = True
    autoLayout: AutoLayoutPayload | None = None


class PointPayload(BaseModel):
    x: Coordinate
    y: Coordinate


class ShadowPayload(ExtensibleModel):
    x: Coordinate = 0
    y: Coordinate = 4
    blur: Dimension = 10
    color: Color = "rgba(0,0,0,0.15)"


class ElementPayload(ExtensibleModel):
    id: Identifier
    type: Literal["rect", "circle", "triangle", "star", "text", "sticky", "line", "arrow", "freehand"]
    name: str = Field(default="Element", max_length=500)
    x: Coordinate = 0
    y: Coordinate = 0
    width: Dimension = 140
    height: Dimension = 120
    rotation: Coordinate = 0
    artboardId: Identifier | None = None
    fill: Color = "#3b82f6"
    stroke: Color = "#2563eb"
    strokeWidth: float = Field(default=2, ge=0, le=1000, allow_inf_nan=False)
    strokeDash: Literal["solid", "dashed", "dotted"] = "solid"
    opacity: float = Field(default=1, ge=0, le=1, allow_inf_nan=False)
    cornerRadius: Dimension = 0
    shadow: ShadowPayload | None = None
    text: str = Field(default="", max_length=100_000)
    fontSize: float = Field(default=16, ge=1, le=1000, allow_inf_nan=False)
    fontFamily: str = Field(default="system-ui, sans-serif", max_length=200)
    fontWeight: str | int = "normal"
    textAlign: Literal["left", "center", "right"] = "left"
    textColor: Color = "#0f172a"
    author: str = Field(default="", max_length=500)
    colorPreset: Literal["yellow", "pink", "blue", "green", "orange", "purple"] | None = None
    points: list[PointPayload] = Field(default_factory=list, max_length=50_000)
    arrowStart: bool = False
    arrowEnd: bool = False
    zIndex: int = Field(default=0, ge=-1_000_000, le=1_000_000)
    locked: bool = False
    hidden: bool = False
    layoutPosition: Literal["auto", "absolute"] = "auto"


class ConnectorPayload(ExtensibleModel):
    id: Identifier
    fromElementId: Identifier
    toElementId: Identifier
    stroke: Color = "#0284c7"
    strokeWidth: float = Field(default=2, ge=0, le=1000, allow_inf_nan=False)
    strokeDash: Literal["solid", "dashed"] = "solid"
    arrowEnd: bool = True
    label: str = Field(default="", max_length=500)


class CanvasPayload(ExtensibleModel):
    schemaVersion: int = Field(default=1, ge=1, le=1)
    viewport: ViewportPayload = Field(default_factory=ViewportPayload)
    settings: SettingsPayload = Field(default_factory=SettingsPayload)
    artboards: list[ArtboardPayload] = Field(default_factory=list, max_length=10_000)
    elements: list[ElementPayload] = Field(default_factory=list, max_length=10_000)
    connectors: list[ConnectorPayload] = Field(default_factory=list, max_length=10_000)

    @model_validator(mode="before")
    @classmethod
    def validate_json_values(cls, value: Any) -> Any:
        if isinstance(value, dict):
            try:
                json.dumps(value, allow_nan=False, ensure_ascii=False).encode("utf-8")
            except (TypeError, ValueError) as error:
                raise ValueError("Canvas data must contain finite, valid JSON values") from error
        return value

    @model_validator(mode="after")
    def validate_references(self) -> CanvasPayload:
        identifiers = [item.id for collection in (self.artboards, self.elements, self.connectors) for item in collection]
        if len(identifiers) != len(set(identifiers)):
            raise ValueError("Canvas object IDs must be unique")
        artboards = {item.id for item in self.artboards}
        elements = {item.id for item in self.elements}
        if any(item.artboardId is not None and item.artboardId not in artboards for item in self.elements):
            raise ValueError("An element references an unknown artboard")
        if any(item.fromElementId not in elements or item.toElementId not in elements for item in self.connectors):
            raise ValueError("A connector references an unknown element")
        return self


def normalize_canvas_data(data: dict[str, Any]) -> dict[str, Any]:
    return CanvasPayload.model_validate(data).model_dump()
