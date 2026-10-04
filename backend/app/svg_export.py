from __future__ import annotations

import math
import re
import textwrap
from typing import Any
from xml.etree import ElementTree as ET

from .canvas_schema import normalize_canvas_data


def node(parent: ET.Element, tag: str, **attributes: Any) -> ET.Element:
    return ET.SubElement(parent, tag, {key.replace("_", "-"): str(value) for key, value in attributes.items() if value is not None})


def render_svg(raw_data: dict[str, Any]) -> str:
    data = normalize_canvas_data(raw_data)
    elements = sorted((element for element in data["elements"] if not element["hidden"]), key=lambda item: item["zIndex"])
    artboards = data["artboards"]

    # Compute bounding box
    bounds = []
    for item in [*artboards, *elements]:
        x, y, width, height = item["x"], item["y"], item["width"], item["height"]
        angle = math.radians(item.get("rotation", 0))
        cx, cy = x + width / 2, y + height / 2
        for dx, dy in ((-width / 2, -height / 2), (width / 2, -height / 2), (width / 2, height / 2), (-width / 2, height / 2)):
            bounds.append((cx + dx * math.cos(angle) - dy * math.sin(angle), cy + dx * math.sin(angle) + dy * math.cos(angle)))
    min_x = min((point[0] for point in bounds), default=0) - 60
    min_y = min((point[1] for point in bounds), default=0) - 60
    max_x = max((point[0] for point in bounds), default=680) + 60
    max_y = max((point[1] for point in bounds), default=480) + 60
    width, height = max(1, math.ceil(max_x - min_x)), max(1, math.ceil(max_y - min_y))
    root = ET.Element("svg", {"xmlns": "http://www.w3.org/2000/svg", "viewBox": f"{min_x} {min_y} {width} {height}", "width": str(width), "height": str(height)})
    defs = node(root, "defs")
    for marker_id, reverse in (("export-arrow-end", False), ("export-arrow-start", True)):
        marker = node(defs, "marker", id=marker_id, markerWidth=10, markerHeight=8, refX=1 if reverse else 9, refY=4, orient="auto")
        node(marker, "polygon", points="10,0 0,4 10,8" if reverse else "0,0 10,4 0,8", fill="context-stroke")
    node(root, "rect", x=min_x, y=min_y, width=width, height=height, fill=data["settings"]["backgroundColor"])

    # Render artboards
    for artboard in artboards:
        x, y, w, h = artboard["x"], artboard["y"], artboard["width"], artboard["height"]
        group = node(root, "g", id=artboard["id"])
        node(group, "text", x=x, y=y - 10, font_family="system-ui, sans-serif", font_size=12, fill="#64748b").text = artboard["name"]
        node(group, "rect", x=x, y=y, width=w, height=h, fill=artboard["fill"], stroke="#cbd5e1", stroke_width=1)
        if artboard["clipContent"]:
            clip = node(defs, "clipPath", id=f"clip-{artboard['id']}")
            node(clip, "rect", x=x, y=y, width=w, height=h)

    by_id = {element["id"]: element for element in elements}
    for connection in data["connectors"]:
        start, end = by_id.get(connection["fromElementId"]), by_id.get(connection["toElementId"])
        if start is None or end is None:
            continue
        x1, y1 = start["x"] + start["width"] / 2, start["y"] + start["height"] / 2
        x2, y2 = end["x"] + end["width"] / 2, end["y"] + end["height"] / 2
        group = node(root, "g", id=connection["id"])
        node(group, "path", d=f"M {x1} {y1} Q {(x1 + x2) / 2} {y1}, {x2} {y2}", fill="none", stroke=connection["stroke"],
             stroke_width=connection["strokeWidth"], stroke_dasharray="5,5" if connection["strokeDash"] == "dashed" else None,
             marker_end="url(#export-arrow-end)" if connection["arrowEnd"] else None)
        if connection["label"]:
            node(group, "text", x=(x1 + x2) / 2, y=(y1 + y2) / 2 - 8, text_anchor="middle", fill=connection["stroke"], font_size=12).text = connection["label"]

    # Render elements
    clipping = {artboard["id"] for artboard in artboards if artboard["clipContent"]}
    for element in elements:
        x, y, w, h = element["x"], element["y"], element["width"], element["height"]
        parent = node(root, "g", clip_path=f"url(#clip-{element['artboardId']})") if element.get("artboardId") in clipping else root
        group = node(parent, "g", id=element["id"], opacity=element["opacity"],
                     transform=f"rotate({element['rotation']} {x + w / 2} {y + h / 2})" if element["rotation"] else None)
        style = {"fill": element["fill"], "stroke": element["stroke"], "stroke_width": element["strokeWidth"],
                 "stroke_dasharray": "6,4" if element["strokeDash"] == "dashed" else "2,4" if element["strokeDash"] == "dotted" else None}
        if element.get("shadow"):
            shadow = element["shadow"]
            effect = node(defs, "filter", id=f"shadow-{element['id']}", x="-100%", y="-100%", width="300%", height="300%")
            node(effect, "feDropShadow", dx=shadow["x"], dy=shadow["y"], stdDeviation=shadow["blur"] / 2, flood_color=shadow["color"])
            group.set("filter", f"url(#shadow-{element['id']})")
        kind = element["type"]
        if kind in {"rect", "sticky"}:
            node(group, "rect", x=x, y=y, width=w, height=h, rx=element["cornerRadius"], **style)
        elif kind == "circle":
            node(group, "ellipse", cx=x + w / 2, cy=y + h / 2, rx=w / 2, ry=h / 2, **style)
        elif kind == "triangle":
            node(group, "polygon", points=f"{x+w/2},{y} {x+w},{y+h} {x},{y+h}", **style)
        elif kind == "star":
            # 5-pointed star
            points = [(0.5, 0), (0.62, 0.38), (1, 0.38), (0.69, 0.62), (0.81, 1), (0.5, 0.77), (0.19, 1), (0.31, 0.62), (0, 0.38), (0.38, 0.38)]
            node(group, "polygon", points=" ".join(f"{x+w*px},{y+h*py}" for px, py in points), **style)
        elif kind in {"line", "arrow"}:
            node(group, "line", x1=x, y1=y + h / 2, x2=x + w, y2=y + h / 2,
                 marker_start="url(#export-arrow-start)" if element["arrowStart"] else None,
                 marker_end="url(#export-arrow-end)" if kind == "arrow" or element["arrowEnd"] else None, **style)
        elif kind == "freehand":
            node(group, "polyline", points=" ".join(f"{point['x']},{point['y']}" for point in element["points"]),
                 fill="none", stroke=element["stroke"], stroke_width=element["strokeWidth"], stroke_linecap="round", stroke_linejoin="round")
        if kind in {"text", "sticky"}:
            font_size = element["fontSize"]
            inset = 12 if kind == "sticky" else 0
            anchor = {"left": "start", "center": "middle", "right": "end"}[element["textAlign"]]
            text_x = x + inset if anchor == "start" else x + w / 2 if anchor == "middle" else x + w - inset
            text = node(group, "text", x=text_x, y=y + inset + font_size, fill=element["textColor"], font_size=font_size,
                        font_family=element["fontFamily"], font_weight=element["fontWeight"], text_anchor=anchor)
            wrap_width = max(1, int((w - inset * 2) / (font_size * 0.55)))
            lines = [line for paragraph in element["text"].split("\n") for line in (textwrap.wrap(paragraph, width=wrap_width, break_long_words=True, replace_whitespace=False) or [""])]
            for index, line in enumerate(lines):
                node(text, "tspan", x=text_x, dy=0 if index == 0 else font_size * 1.3).text = line
            if kind == "sticky" and element["author"]:
                node(group, "text", x=x + 12, y=y + h - 12, fill=element["textColor"], font_size=11, opacity=0.75).text = element["author"]
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "\ufffd", ET.tostring(root, encoding="unicode"))
