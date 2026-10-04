from __future__ import annotations

import json
import sqlite3
import tempfile
import time
import unittest
from unittest import mock
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from xml.etree import ElementTree

from fastapi.testclient import TestClient

from backend.app.canvas_store import CanvasStore
from backend.app.main import create_app
from backend.app.requirements_catalog import RequirementsCatalog, TopicParser, extract_outline


class PlatformApiTests(unittest.TestCase):
    def setUp(self) -> None:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.database = Path(directory.name) / "platform.db"
        self.client = TestClient(create_app(self.database))
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)

    def create_canvas(self, data: dict | None = None) -> dict:
        response = self.client.post(
            "/api/canvases", json={"name": "Test project", "data": data or {}}
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_partial_documents_are_normalized_without_losing_extension_fields(self) -> None:
        canvas = self.create_canvas({
            "elements": [{"id": "rectangle", "type": "rect"}],
            "futureFeature": {"enabled": True},
            "futureNullFeature": None,
        })
        self.assertEqual(canvas["revision"], 0)
        self.assertEqual(canvas["data"]["schemaVersion"], 1)
        self.assertEqual(canvas["data"]["viewport"]["zoom"], 1)
        self.assertEqual(canvas["data"]["connectors"], [])
        self.assertEqual(canvas["data"]["elements"][0]["width"], 140)
        self.assertTrue(canvas["data"]["futureFeature"]["enabled"])
        self.assertIn("futureNullFeature", canvas["data"])
        self.assertIsNone(canvas["data"]["futureNullFeature"])

    def test_stale_updates_do_not_overwrite_a_newer_revision(self) -> None:
        canvas = self.create_canvas()
        url = f"/api/canvases/{canvas['id']}"
        saved = self.client.put(url, json={"name": "Latest", "expected_revision": 0})
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.json()["revision"], 1)
        stale = self.client.put(url, json={"name": "Stale", "expected_revision": 0})
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(self.client.get(url).json()["name"], "Latest")

    def test_simultaneous_writers_cannot_both_save_the_same_revision(self) -> None:
        canvas = self.create_canvas()
        url = f"/api/canvases/{canvas['id']}"
        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(executor.map(
                lambda name: self.client.put(url, json={"name": name, "expected_revision": 0}),
                ["Writer one", "Writer two"],
            ))
        self.assertEqual(sorted(response.status_code for response in responses), [200, 409])
        self.assertEqual(self.client.get(url).json()["revision"], 1)

    def test_named_versions_restore_and_keep_a_recovery_snapshot(self) -> None:
        canvas = self.create_canvas()
        url = f"/api/canvases/{canvas['id']}"
        checkpoint = self.client.post(
            f"{url}/versions", json={"label": "First draft", "expected_revision": 0}
        )
        self.assertEqual(checkpoint.status_code, 201)
        version = checkpoint.json()
        self.client.put(url, json={"name": "Newer draft", "expected_revision": 0})
        restored = self.client.post(
            f"{url}/versions/{version['id']}/restore", json={"expected_revision": 1}
        )
        self.assertEqual(restored.status_code, 200, restored.text)
        self.assertEqual(restored.json()["name"], "Test project")
        self.assertEqual(restored.json()["revision"], 2)
        versions = self.client.get(f"{url}/versions").json()
        self.assertEqual(len(versions), 2)
        self.assertTrue(any(v["label"].startswith("Before restoring") for v in versions))
        snapshot = self.client.get(f"{url}/versions/{version['id']}").json()
        self.assertEqual(snapshot["data"], canvas["data"])
        with TestClient(create_app(self.database)) as restarted:
            self.assertEqual(restarted.get(f"{url}/versions").json(), versions)

    def test_versions_are_scoped_to_their_document_and_revision(self) -> None:
        first = self.create_canvas()
        second = self.create_canvas()
        url = f"/api/canvases/{first['id']}"
        version = self.client.post(f"{url}/versions", json={"label": "Checkpoint"}).json()
        wrong = f"/api/canvases/{second['id']}/versions/{version['id']}"
        self.assertEqual(self.client.get(wrong).status_code, 404)
        self.assertEqual(self.client.post(f"{wrong}/restore", json={}).status_code, 404)
        self.client.put(url, json={"name": "Edited", "expected_revision": 0})
        stale = self.client.post(f"{url}/versions", json={"label": "Stale", "expected_revision": 0})
        self.assertEqual(stale.status_code, 409)
        stale_restore = self.client.post(
            f"{url}/versions/{version['id']}/restore", json={"expected_revision": 0}
        )
        self.assertEqual(stale_restore.status_code, 409)

    def test_invalid_imports_are_rejected(self) -> None:
        invalid = [
            {"elements": [{"id": "same", "type": "rect"}, {"id": "same", "type": "circle"}]},
            {"elements": [{"id": "shape", "type": "rect", "width": -1}]},
            {"elements": [{"id": "shape", "type": "rect", "artboardId": "missing"}]},
            {"connectors": [{"id": "connection", "fromElementId": "missing", "toElementId": "other"}]},
            {"viewport": {"zoom": 0}},
            {"settings": {"gridSize": 0}},
            {"elements": "not an array"},
        ]
        for data in invalid:
            with self.subTest(data=data):
                response = self.client.post("/api/canvases", json={"name": "Invalid", "data": data})
                self.assertEqual(response.status_code, 422, response.text)

    def test_non_finite_extension_values_return_validation_errors(self) -> None:
        response = self.client.post(
            "/api/canvases", content=json.dumps({"name": "Invalid numeric data", "data": {"futureFeature": float("nan")}}),
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(response.status_code, 422)

    def test_svg_replaces_characters_that_are_invalid_in_xml(self) -> None:
        canvas = self.create_canvas({"elements": [{"id": "text", "type": "text", "text": "a\u0001b"}]})
        response = self.client.get(f"/api/canvases/{canvas['id']}/export/svg")
        root = ElementTree.fromstring(response.text)
        self.assertIn("a\ufffdb", "".join(root.itertext()))

    def test_svg_exports_every_supported_shape_safely(self) -> None:
        attack = '<script>alert("unsafe")</script> & text'
        elements = [
            {"id": kind, "type": kind, "x": 10, "y": 20, "text": attack, "rotation": 15}
            for kind in ("rect", "circle", "triangle", "star", "line", "arrow", "text", "sticky")
        ]
        elements += [
            {"id": "sketch", "type": "freehand", "points": [{"x": 1, "y": 1}, {"x": 50, "y": 20}]},
            {"id": "hidden", "type": "text", "text": "HIDDEN CONTENT", "hidden": True},
        ]
        canvas = self.create_canvas({
            "elements": elements,
            "artboards": [{"id": "frame", "name": attack, "width": 500, "height": 500}],
            "connectors": [{"id": "link", "fromElementId": "rect", "toElementId": "circle", "label": attack}],
        })
        response = self.client.get(f"/api/canvases/{canvas['id']}/export/svg")
        self.assertEqual(response.status_code, 200)
        root = ElementTree.fromstring(response.text)
        ns = {"s": "http://www.w3.org/2000/svg"}
        self.assertGreaterEqual(len(root.findall(".//s:polygon", ns)), 2)
        self.assertGreaterEqual(len(root.findall(".//s:line", ns)), 2)
        self.assertTrue(root.findall(".//s:polyline", ns))
        self.assertTrue(root.findall(".//s:path", ns))
        self.assertFalse(root.findall(".//s:script", ns))
        self.assertNotIn("HIDDEN CONTENT", response.text)
        self.assertIn(attack, "".join(root.itertext()))
        self.assertIn("rotate(15", response.text)


class MigrationTests(unittest.TestCase):
    def test_existing_databases_are_migrated_without_reseeding_or_losing_data(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "legacy.db"
            with closing(sqlite3.connect(path)) as connection, connection:
                connection.execute(
                    "CREATE TABLE canvases (id TEXT PRIMARY KEY, name TEXT NOT NULL, "
                    "description TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"
                )
                connection.execute(
                    "INSERT INTO canvases VALUES (?, ?, ?, ?, ?, ?)",
                    ("legacy", "Keep this", "", json.dumps({"elements": []}), "before", "before"),
                )
            store = CanvasStore(path)
            store.initialize()
            store.initialize()
            self.assertEqual(len(store.list_canvases()), 1)
            canvas = store.get_canvas("legacy")
            self.assertEqual(canvas["name"], "Keep this")
            self.assertEqual(canvas["revision"], 0)
            self.assertEqual(store.update_canvas("legacy", name="Edited", expected_revision=0)["revision"], 1)


class RequirementsCatalogTests(unittest.TestCase):
    def test_parser_keeps_document_outline_but_not_navigation_or_scripts(self) -> None:
        parser = TopicParser()
        parser.feed(
            "<title>Flexible layouts</title><nav><h2>Navigation</h2></nav>"
            "<main><h1>Flex &amp; grid</h1><h2>Direction <em>and alignment</em></h2>"
            "<script>secret</script></main>"
        )
        self.assertEqual(parser.title, "Flexible layouts")
        self.assertEqual([h["text"] for h in parser.headings], ["Flex & grid", "Direction and alignment"])

    def test_fast_extraction_ignores_scripts_styles_navigation_and_comments(self) -> None:
        content = '<title>Document title</title><script>' + '<h2>Not a requirement</h2>' * 20_000 + '</script>'
        content += '<style>h2 { color: red; }</style><nav><h2>Navigation</h2></nav><!-- <h2>Comment</h2> -->'
        content += '<main><h1>Actual feature</h1><h2>Labels &amp; <em>styles</em></h2></main>'
        parser = extract_outline(content)
        self.assertEqual(parser.title, 'Document title')
        self.assertEqual([heading['text'] for heading in parser.headings], ['Actual feature', 'Labels & styles'])

    def test_inventory_reports_missing_sources_and_deduplicates_aliases(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "penpot"
            page = source / "user-guide" / "designing" / "flexible-layouts" / "index.html"
            page.parent.mkdir(parents=True)
            page.write_text("<title>Flexible Layouts</title><h1>Flex layout</h1><h2>Gap and padding</h2>", encoding="utf-8")
            item = {
                "url": "https://help.penpot.app/user-guide/designing/flexible-layouts/",
                "final_url": "https://help.penpot.app/user-guide/designing/flexible-layouts/",
                "relative_path": "user-guide/designing/flexible-layouts/index.html",
                "content_type": "text/html",
            }
            (source / "manifest.json").write_text(json.dumps({
                "root_url": "https://help.penpot.app/", "files": [item, item], "errors": []
            }), encoding="utf-8")
            miro = root / "miro"
            miro.mkdir()
            (miro / "manifest.json").write_text(json.dumps({
                "root_url": "https://help.miro.com/", "files": [],
                "errors": [{"url": "https://help.miro.com/", "error": "HTTP Error 403: Forbidden"}],
            }), encoding="utf-8")
            catalog = RequirementsCatalog(root)
            summary = catalog.summary()
            self.assertEqual(summary["topic_count"], 1)
            self.assertEqual(len(summary["phases"]), 6)
            self.assertTrue(any(s["id"] == "miro" and s["status"] == "missing" for s in summary["sources"]))
            topics = catalog.topics(query="padding", source="penpot", offset=0, limit=10)
            self.assertEqual(topics["total"], 1)
            self.assertEqual(topics["items"][0]["status"], "needs_review")
            self.assertEqual(topics["items"][0]["outline"][1]["text"], "Gap and padding")
            self.assertEqual(catalog.topics(query="absent")["total"], 0)
            with mock.patch("backend.app.requirements_catalog.extract_outline", side_effect=AssertionError("unexpected rescan")):
                self.assertEqual(RequirementsCatalog(root).summary()["topic_count"], 1)

    def test_missing_and_unsafe_snapshot_paths_are_reported_not_read(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "penpot"
            source.mkdir()
            files = [
                {"url": "https://help.penpot.app/user-guide/missing", "relative_path": "user-guide/missing/index.html", "content_type": "text/html"},
                {"url": "https://help.penpot.app/user-guide/unsafe", "relative_path": "user-guide/../../outside.html", "content_type": "text/html"},
            ]
            (source / "manifest.json").write_text(json.dumps({
                "root_url": "https://help.penpot.app/", "files": files
            }), encoding="utf-8")
            summary = RequirementsCatalog(root).summary()
            self.assertEqual(summary["topic_count"], 0)
            penpot = next(s for s in summary["sources"] if s["id"] == "penpot")
            self.assertEqual(len(penpot["issues"]), 2)


class RequirementsCorpusTests(unittest.TestCase):
    def test_real_snapshot_corpus_uses_a_bounded_persistent_index(self) -> None:
        root = Path(__file__).resolve().parents[2] / "requirement" / "downloaded_docs"
        if not root.is_dir():
            self.skipTest("The snapshot corpus is not bundled in this checkout")
        started = time.perf_counter()
        summary = RequirementsCatalog(root).summary()
        elapsed = time.perf_counter() - started
        self.assertGreater(summary["topic_count"], 0)
        self.assertLess(elapsed, 20, f"Indexed catalog loading took {elapsed:.2f}s")


if __name__ == "__main__":
    unittest.main()
