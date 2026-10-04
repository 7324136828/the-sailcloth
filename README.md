# OmniCanvas: Hybrid Creative Canvas

A full-stack visual design and collaborative canvas platform combining **Vector Design Shapes** (Figma / Sketch / Penpot), **Whiteboard Sticky Notes** (Miro / FigJam), and **Layout Artboards & Frames** (Framer / Webflow), powered by a **React + TypeScript + Vite** frontend and **FastAPI + SQLite WAL** persistent backend.

> **Implementation status:** Phase 1 is implemented: a source-linked requirements backlog, durable document persistence, optimistic revision checks, local draft recovery, named versions, basic flexible layouts, and safe exports. Phases 2–6 remain planned roadmap work; the requirements dialog does not treat captured documentation topics as completed feature acceptance criteria.

---

## Key Features

### 1. Vector Design Shapes (Figma / Sketch / Penpot)
- **Geometric Shapes**: Rectangles with rounded corners, Ellipses/Circles, Triangles, 5-point Stars, Lines & Arrows, and Freehand Pencil sketches.
- **Transformation & Geometry**: Full interactive transform bounding box with 8 resize handles, rotation handle, and drag-to-move.
- **Styling Controls**: Fill color, stroke color, stroke width, stroke dash patterns (solid, dashed, dotted), opacity slider, corner radius, and drop shadows.
- **Layer Operations**: Bring to Front, Send to Back, Bring Forward, Send Backward, Grouping, Duplication (`Ctrl+D`), and Deletion (`Del`).
- **Alignment Suite**: Align Left, Center, Right, Top, Middle, Bottom.

### 2. Whiteboard Sticky Notes (Miro / FigJam)
- **Pastel Color Presets**: Quick switching between Yellow, Pink, Sky Blue, Mint Green, Peach Orange, and Lavender.
- **Inline Editing**: Double-click directly on any sticky note to edit its message inline on the infinite canvas.
- **Author & Tagging**: Custom author badges on sticky notes for collaborative brainstorm attribution.
- **Connectors**: Directed arrows connecting notes and shapes with custom labels.

### 3. Layout Artboards & Frames (Framer / Webflow)
- **Device Presets**: Desktop (1440 × 900), Tablet/iPad (768 × 1024), Mobile/iPhone (375 × 812), Slide (1920 × 1080), and Custom Dimensions.
- **Visual Containers**: Frame header with dimension badges, background styling, and optional content clipping.
- **Flexible Auto Layout**: Row/column flow, gap, padding, alignment, justification, wrapping, and opt-out absolute positioning for frame children.

### 4. Requirements Inventory & Versions
- **Source-Linked Backlog**: Indexes captured documentation manifests, titles, and outlines from Figma, Penpot, Webflow, Framer, and Sketch while preserving canonical source links.
- **Coverage Transparency**: Marks captured topics as review backlog items and keeps source limitations visible; Miro is missing because its download returned HTTP 403, while Framer and Sketch currently have landing-page-only snapshots.
- **Named Versions**: Create document checkpoints, inspect stored revisions, and restore safely while automatically preserving the replaced server state.
- **Recovery-Safe Persistence**: Revision-aware saves, conflict handling, browser draft recovery, retry, conflict recovery as a new project, and JSON draft download.

### 5. Canvas Navigation & Experience
- **Infinite Canvas**: Smooth zoom and pan via Mouse Wheel, pinch, Hand Tool (`H`), or `Space + Drag`.
- **Grid & Alignment**: Toggleable dot grid with configurable grid size and snap-to-grid alignment.
- **History**: Full Undo (`Ctrl+Z`) and Redo (`Ctrl+Y`) stack.
- **Keyboard Shortcuts**: `V` (Select), `H` (Hand), `R` (Rect), `O` (Circle), `S` (Sticky), `F` (Artboard), `T` (Text), `L` (Arrow), `P` (Pencil), `G` (Grid).

### 6. Export & Import
- **PNG Export**: Client-side high-resolution rasterization of the canvas.
- **Vector SVG Export**: Clean, standalone vector SVG download.
- **JSON Project Export & Import**: Save and re-load complete canvas workspaces.
- **Server-rendered SVG Endpoint**: `GET /api/canvases/{id}/export/svg` renders SVG directly from the FastAPI backend.

### 7. Durable SQLite Persistence
- **FastAPI + SQLite (WAL mode)** for low-latency auto-saving and full offline resilience.
- Auto-save debounced sync with visual save badge ("Saved to SQLite", "Saving...").
- Optimistic `expected_revision` checks reject stale writes with HTTP 409.
- Failed saves are retained as browser-local drafts and can be retried, downloaded, or kept as recovery projects.
- Multi-canvas project switcher: create, clone, rename, and delete canvas documents.
- Includes backward-compatible persistent click counter.

---

## Quick start

Windows:

```powershell
.\setup.bat
.\run.bat
```

Linux/macOS:

```bash
./setup.sh
./run.sh
```

If a Python virtual environment or Conda environment is already active, setup
installs into that environment and run uses the same interpreter. Otherwise,
the scripts create and reuse `.venv` in this project.

The default backend and frontend ports are `8000` and `5173`. The runner checks
both ports before launch and advances to the next available port when needed.
It prints the actual URLs selected for the session.

---

## API Documentation

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Backend health check |
| `GET` | `/api/requirements` | Sources, six-phase roadmap, capability coverage, and topic totals |
| `GET` | `/api/requirements/topics` | Search/filter captured source topics (`q`, `source`, `phase`, `offset`, `limit`) |
| `GET` | `/api/canvases` | List all saved canvas projects with summaries |
| `POST` | `/api/canvases` | Create a new canvas document |
| `GET` | `/api/canvases/{id}` | Retrieve full canvas document with artboards and elements |
| `PUT` | `/api/canvases/{id}` | Update canvas name, description, and elements |
| `DELETE` | `/api/canvases/{id}` | Delete a canvas document |
| `POST` | `/api/canvases/{id}/duplicate` | Duplicate an existing canvas |
| `GET` | `/api/canvases/{id}/versions` | List named checkpoints for a canvas |
| `POST` | `/api/canvases/{id}/versions` | Create a named checkpoint (`label`, optional `expected_revision`) |
| `GET` | `/api/canvases/{id}/versions/{version_id}` | Retrieve a checkpoint and its canvas payload |
| `POST` | `/api/canvases/{id}/versions/{version_id}/restore` | Restore a checkpoint after saving a recovery snapshot |
| `POST` | `/api/export/svg` | Validate and render a posted canvas payload as SVG |
| `GET` | `/api/canvases/{id}/export/svg` | Server-rendered SVG vector export |
| `GET` | `/api/counter` | Read persistent count |
| `POST` | `/api/counter/click` | Atomically increment count |
| `DELETE` | `/api/counter` | Reset count |

`PUT /api/canvases/{id}`, version creation, and version restore accept `expected_revision`; a stale revision returns HTTP 409 rather than overwriting newer work. Canvas payloads are schema-normalized, preserve unknown extension fields, and reject malformed references, duplicate IDs, unsupported object types, invalid dimensions/colors, and non-finite numbers.

The requirements catalog stores a fingerprinted generated index at `requirement/downloaded_docs/.requirements-index.json`. It is refreshed automatically when a manifest entry or snapshot file changes.

Interactive API documentation is available at the backend `/docs` URL.

---

## Tests and build

```powershell
# Run backend unit tests (FastAPI + SQLite Store)
.\.venv\Scripts\python.exe -m unittest discover -s backend\tests -v

# Typecheck and build frontend
cd frontend
npm run typecheck
npm run build

# Run Playwright end-to-end tests
cd ..\e2e
npm run typecheck
npm test
```

---

## Project Layout

```text
backend/
  app/
    canvas_schema.py       Extensible canvas payload validation and normalization
    canvas_store.py        SQLite WAL persistence, revisions, and named versions
    requirements_catalog.py Source manifest parsing and cached requirements inventory
    svg_export.py          XML-safe server SVG renderer
    store.py               SQLite store for counter
    main.py                FastAPI application and REST routes
  tests/
    test_canvas.py         Unit tests for canvas store and API endpoints
    test_counter.py        Unit tests for counter
    test_platform.py       Phase 1 persistence, versions, export, and catalog tests
frontend/
  src/
    components/
      Navbar.tsx          Header with project switcher, zoom, grid, export & status
      Toolbar.tsx         Tool palette (Select, Hand, Shapes, Sticky, Frame, Text, Pen)
      CanvasArea.tsx      Infinite zoom/pan canvas, SVG renderer, and transform handles
      PropertiesPanel.tsx Contextual styling inspector (geometry, colors, typography)
      LayersPanel.tsx     Left sidebar layer hierarchy with visibility and lock controls
      TemplateModal.tsx   Pre-built templates (Sprint Whiteboard, Mobile Wireframe)
      ShortcutsModal.tsx  Keyboard shortcuts cheatsheet
      CounterWidget.tsx   Docked persistent counter widget
      PlatformDialog.tsx  Shared accessible requirements/version dialog
      RequirementsPanel.tsx Source coverage, topics, capabilities, and phases
      VersionsPanel.tsx   Named checkpoint list, create, and restore actions
    utils/
      autoLayout.ts       Deterministic frame auto-layout engine
      export.ts           Safe PNG, SVG, and JSON export utilities
      saveQueue.ts        Ordered per-document save queue and conflicts
      useCanvasPersistence.ts Autosave, local drafts, retry, and recovery
    types.ts              TypeScript interfaces and preset definitions
    api.ts                Frontend REST API client
    App.tsx               Root application coordinating state, auto-save, and shortcuts
    styles.css            Complete UI and canvas styling
e2e/
  tests/
    canvas.spec.ts             Playwright tests for canvas, tools, inspector, and persistence
    counter.spec.ts            Playwright tests for counter persistence
    foundation-utils.spec.ts   Browser tests for layout, save queue, and safe exports
    platform.spec.ts           Requirements, versions, recovery, imports, and export tests
```
