from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.canvas_store import CanvasStore, default_canvas_data
from backend.app.main import create_app


class CanvasStoreTests(unittest.TestCase):
    def test_store_crud_and_persistence(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "test_canvas.db"
            store = CanvasStore(database)
            store.initialize()

            # Default starter canvas is seeded
            canvases = store.list_canvases()
            self.assertEqual(len(canvases), 1)
            starter_id = canvases[0]["id"]
            starter = store.get_canvas(starter_id)
            self.assertIsNotNone(starter)
            self.assertIn("artboards", starter["data"])
            self.assertIn("elements", starter["data"])

            # Create new canvas
            created = store.create_canvas(
                name="Marketing Mockup",
                description="Landing page wireframe with sticky notes",
                data={"artboards": [], "elements": [{"id": "rect1", "type": "rect"}]},
            )
            self.assertEqual(created["name"], "Marketing Mockup")
            self.assertEqual(created["description"], "Landing page wireframe with sticky notes")
            new_id = created["id"]

            # List again
            canvases_after = store.list_canvases()
            self.assertEqual(len(canvases_after), 2)

            # Update canvas
            updated = store.update_canvas(
                new_id,
                name="Marketing Mockup v2",
                data={"artboards": [], "elements": [{"id": "rect1", "type": "rect"}, {"id": "note1", "type": "sticky"}]},
            )
            self.assertIsNotNone(updated)
            self.assertEqual(updated["name"], "Marketing Mockup v2")
            self.assertEqual(len(updated["data"]["elements"]), 2)

            # Duplicate canvas
            cloned = store.duplicate_canvas(new_id)
            self.assertIsNotNone(cloned)
            self.assertIn("(Copy)", cloned["name"])
            self.assertNotEqual(cloned["id"], new_id)

            # Delete canvas
            self.assertTrue(store.delete_canvas(new_id))
            self.assertIsNone(store.get_canvas(new_id))
            self.assertEqual(len(store.list_canvases()), 2)


class CanvasApiTests(unittest.TestCase):
    def test_api_endpoints_flow(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "test_canvas_api.db"
            with TestClient(create_app(database)) as client:
                # Health check
                health = client.get("/api/health")
                self.assertEqual(health.status_code, 200)
                self.assertEqual(health.json()["status"], "ok")

                # List canvases
                list_res = client.get("/api/canvases")
                self.assertEqual(list_res.status_code, 200)
                items = list_res.json()
                self.assertGreaterEqual(len(items), 1)
                first_id = items[0]["id"]

                # Get canvas
                get_res = client.get(f"/api/canvases/{first_id}")
                self.assertEqual(get_res.status_code, 200)
                canvas_data = get_res.json()
                self.assertEqual(canvas_data["id"], first_id)
                self.assertIn("elements", canvas_data["data"])

                # Create canvas
                post_res = client.post(
                    "/api/canvases",
                    json={
                        "name": "Design Sprint Canvas",
                        "description": "Team whiteboard",
                        "data": default_canvas_data(),
                    },
                )
                self.assertEqual(post_res.status_code, 201)
                created_id = post_res.json()["id"]

                # Update canvas
                put_res = client.put(
                    f"/api/canvases/{created_id}",
                    json={"name": "Sprint 42 Canvas"},
                )
                self.assertEqual(put_res.status_code, 200)
                self.assertEqual(put_res.json()["name"], "Sprint 42 Canvas")

                # Duplicate canvas
                dup_res = client.post(f"/api/canvases/{created_id}/duplicate")
                self.assertEqual(dup_res.status_code, 201)
                dup_id = dup_res.json()["id"]
                self.assertNotEqual(dup_id, created_id)

                # Export SVG
                svg_res = client.get(f"/api/canvases/{created_id}/export/svg")
                self.assertEqual(svg_res.status_code, 200)
                self.assertEqual(svg_res.headers["content-type"], "image/svg+xml")
                self.assertIn("<svg", svg_res.text)

                # Delete canvas
                del_res = client.delete(f"/api/canvases/{created_id}")
                self.assertEqual(del_res.status_code, 200)
                self.assertTrue(del_res.json()["deleted"])

                # 404 for deleted
                get_del = client.get(f"/api/canvases/{created_id}")
                self.assertEqual(get_del.status_code, 404)


if __name__ == "__main__":
    unittest.main()
