from __future__ import annotations

import hashlib
import json
import os
import re
import stat
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from threading import Lock
from typing import Any
from urllib.parse import urlsplit, urlunsplit


PHASES = [
    {"id": 1, "title": "Durable editor foundation", "status": "in_progress", "dependencies": [],
     "scope": "Source inventory, schema validation, document management, ordered saves, revision conflicts, recoverable versions, and basic flexible layout.",
     "gate": "Backend regression tests, frontend typecheck/build, and browser tests for persistence, imports, layout, versions, and coverage reporting."},
    {"id": 2, "title": "Design systems, prototypes, and whiteboards", "status": "planned", "dependencies": [1],
     "scope": "Advanced vectors and images, nested layers/pages, components/variants, libraries/tokens, responsive flex/grid, interactive prototypes, whiteboard facilitation, slides, and branded asset creation.",
     "gate": "Granular source acceptance criteria, geometry/rendering tests, component propagation tests, and complete prototype/whiteboard workflows."},
    {"id": 3, "title": "Identity and collaboration", "status": "planned", "dependencies": [1, 2],
     "scope": "Accounts, workspaces/teams, server-enforced permissions, sharing, comments/mentions, notifications, live cursors/editing, branches/reviews, and audit history.",
     "gate": "Authentication and permission isolation tests, concurrent multi-client conflict tests, and recoverable branch/merge workflows."},
    {"id": 4, "title": "Responsive web authoring and CMS", "status": "planned", "dependencies": [2, 3],
     "scope": "Semantic page builder, CSS classes/states/breakpoints, CMS schemas/references, conditional content, forms, localization, motion, code inspection, and accessibility.",
     "gate": "Responsive rendering, CMS validation, form security, locale routing, and keyboard/screen-reader acceptance tests."},
    {"id": 5, "title": "Publishing and business operations", "status": "planned", "dependencies": [3, 4],
     "scope": "Preview/staging/production publishing, domains/TLS, SEO/redirects, commerce/orders/payments, analytics, experimentation, hosting, billing, and backups.",
     "gate": "Configured staging environment, rollback tests, sandbox payment tests, analytics consent, security review, and explicit production release approval."},
    {"id": 6, "title": "Integrations and enterprise parity", "status": "planned", "dependencies": [2, 3, 4, 5],
     "scope": "Sandboxed plugins, REST/webhooks/MCP, AI providers and governance, SSO/SCIM, native format migration, IDE handoff, desktop deployment, and enterprise controls.",
     "gate": "Provider credentials/configuration, integration contract tests, plugin isolation, native-format fixtures, and enterprise access-control verification."},
]

SOURCE_DEFINITIONS = {
    "figma": ("Figma / FigJam", "help.figma.com", ("hc/",)),
    "miro": ("Miro", "help.miro.com", ()),
    "penpot": ("Penpot", "help.penpot.app", ("user-guide/", "technical-guide/", "plugins/", "mcp/", "contributing-guide/")),
    "framer": ("Framer", "framer.com", ("learn/", "academy/")),
    "sketch": ("Sketch", "sketch.com", ("docs/",)),
    "webflow": ("Webflow", "university.webflow.com", ("videos/", "courses/", "learning-paths/", "resources/", "glossary/")),
}

CAPABILITIES = [
    ("requirements", "Source-linked requirements inventory", 1, "implemented", "Inventory all captured documentation topics, outlines, source gaps, and provisional phase assignments. This is not a complete acceptance-criteria audit.", "backend/tests/test_platform.py:RequirementsCatalogTests", ("user guide", "guide", "overview")),
    ("documents", "Local project management", 1, "implemented", "Create, list, rename, clone, and persist canvas documents in SQLite without replacing existing databases.", "backend/tests/test_canvas.py; e2e/tests/canvas.spec.ts", ("projects and files", "design files", "workspace basics")),
    ("saving", "Ordered saves and revision conflicts", 1, "implemented", "Serialize edits, retain local recovery drafts, flush before project changes, retry network failures, and reject stale revision writes. Multi-user merge is not implemented.", "e2e/tests/foundation-utils.spec.ts; e2e/tests/platform.spec.ts", ("save", "offline", "version")),
    ("versions", "Named version snapshots and safe restore", 1, "implemented", "Persist named checkpoints and keep a recovery snapshot before restoring. Branches and reviews remain planned.", "backend/tests/test_platform.py:PlatformApiTests; e2e/tests/platform.spec.ts", ("version history", "history", "compare changes")),
    ("json", "Validated JSON project import", 1, "implemented", "Normalize supported schema fields, reject malformed references, and import into a new project rather than trusting an exported document ID.", "backend/tests/test_platform.py; e2e/tests/platform.spec.ts", ("import", "export")),
    ("layout", "Flexible layout", 2, "partial", "Basic row/column layout, wrapping, uniform gap/padding, alignment, justification, and absolute children are implemented. Nested containers, reverse flow, per-side spacing, sizing modes, constraints, and CSS grid are not.", "e2e/tests/foundation-utils.spec.ts; e2e/tests/platform.spec.ts", ("layout", "flexbox", "grid", "constraints")),
    ("canvas", "Drawing, frames, and navigation", 2, "partial", "Existing primitive shapes, sticky notes, text, freehand, single selection/transforms, frame presets, grid, and zoom/pan. Full pointer/device fidelity, multi-selection, nested groups/pages, and advanced geometry remain open.", "e2e/tests/canvas.spec.ts", ("layers", "frames", "canvas", "draw", "zoom", "toolbar")),
    ("exports", "Rendering and export formats", 2, "partial", "Safe SVG and JSON exports for the supported canvas schema. Full PNG fidelity, layer-level exports, PDF/JPEG/PPT, native format compatibility, and code export remain open.", "backend/tests/test_platform.py:test_svg_exports_every_supported_shape_safely", ("export", "file format", "import")),
    ("vectors", "Advanced vector editing", 2, "planned", "Bezier pen/node editing, boolean operations, winding rules, masks, blend modes, gradients/patterns, multiple fills/strokes, and effects.", "", ("vector", "paths", "boolean", "fill", "stroke", "gradient", "patterns", "effects")),
    ("typography", "Rich typography and media assets", 2, "planned", "Rich text runs, font management/variable fonts, image uploads/cropping, asset replacement, video/GIF/Lottie, and asset libraries.", "", ("typography", "text", "fonts", "images", "assets", "video", "lottie")),
    ("hierarchy", "Pages, nested layers, and grouping", 2, "planned", "Multi-page documents, multi-selection, groups, parent/child hierarchy, group transforms, distribution, guides, and layout-aware layer reordering.", "", ("pages", "layers", "parent", "group", "sections")),
    ("components", "Components, instances, variants, and slots", 2, "planned", "Reusable main components, linked instances with overrides, propagation, properties, variants, nesting, slots, and reset/detach.", "", ("components", "variants", "slots")),
    ("tokens", "Styles, variables, tokens, and libraries", 2, "planned", "Shared color/type/effect assets, variables and collections/modes, aliases, token binding, library publishing, and updates.", "", ("tokens", "variables", "libraries", "styles", "collections")),
    ("prototypes", "Interactive prototypes", 2, "planned", "Flows/hotspots, triggers/actions, transitions, overlays, scrolling, variables/conditions/expressions, device previews, and offline playback.", "", ("prototype", "prototyping", "interactions", "conditionals", "expressions")),
    ("whiteboards", "Whiteboard and meeting facilitation", 2, "partial", "Sticky notes and sample connectors/templates exist. Editable diagram connections, mindmaps, tables, embeds, voting, timers, cursor chat, spotlight, reactions, and open sessions remain planned; Miro capture is missing.", "e2e/tests/canvas.spec.ts", ("figjam", "mindmaps", "voting", "timer", "cursor chat", "stickies", "spotlight")),
    ("presentations", "Slides and branded asset workflows", 2, "planned", "Slide decks/layouts, notes, presentation controls, interactive polls, branded templates/controls, bulk assets, and media workflows.", "", ("slides", "slide decks", "buzz", "brand", "bulk create")),
    ("accounts", "Accounts and sessions", 3, "planned", "Registration, verified login, password recovery, profile/preferences, account switching, session expiry, and secure logout. The current app is local and single-user.", "", ("account", "login", "log in", "authentication", "session")),
    ("teams", "Teams, organizations, and permissions", 3, "planned", "Workspaces/projects, membership/guests, roles, invitations, user groups, server authorization, ownership, and organization management.", "", ("teams", "organization", "members", "guests", "roles", "permissions", "access control")),
    ("sharing", "Sharing and review", 3, "planned", "View/edit sharing, link expiry, comments/replies/mentions, resolved threads, notifications, reviewer access, and activity history.", "", ("comments", "share", "sharing", "review", "public links", "activity log")),
    ("realtime", "Real-time collaborative editing", 3, "planned", "Presence/cursors, multi-client synchronization, conflict resolution, collaborative undo, reconnects, and user isolation.", "", ("collaborat", "cursor", "multiplayer")),
    ("branches", "Branches and change management", 3, "planned", "Branch creation, main updates, diffs, reviews, merge conflict resolution, and audit trails.", "", ("branch", "merge", "compare changes")),
    ("web-authoring", "Responsive website authoring", 4, "planned", "Semantic elements, pages/navigation, CSS classes and states, breakpoints, layout sizing/positioning, interactions, and reusable web components.", "", ("webpages", "breakpoints", "responsive", "css", "elements", "site structure")),
    ("cms", "CMS and dynamic content", 4, "planned", "Typed collections, items, references, validation, collection pages/lists, filtering/sorting, conditional content, and content editor roles.", "", ("cms", "dynamic content", "collection pages", "conditionals")),
    ("forms", "Forms and submissions", 4, "planned", "Form elements, validation, submission storage, spam protection, file uploads, notifications, and integrations.", "", ("forms", "form responses", "submission")),
    ("localization", "Localization", 4, "planned", "Locales, translated CMS/pages/assets, locale switching/routing, language metadata, and locale-specific SEO.", "", ("localiz", "locale", "language")),
    ("accessibility", "Accessibility and reduced motion", 4, "partial", "Basic browser controls are present. Full canvas keyboard access, screen-reader semantics, contrast audits, reduced motion, and generated-site accessibility require dedicated acceptance testing.", "", ("accessibility", "screen reader", "reduced motion", "alt text")),
    ("handoff", "Developer inspection and code handoff", 4, "planned", "Measured geometry/styles, generated HTML/CSS/SVG, copied code, component specifications, developer resources, ready statuses, and change comparison.", "", ("dev mode", "dev tools", "inspect", "code snippets", "specifications")),
    ("publishing", "Publishing, domains, and hosting", 5, "planned", "Preview/staging/production, per-page publishing, rollback, custom domains/TLS, CDN/storage, backups, and self-hosted deployment.", "", ("publish", "hosting", "domain", "staging", "self-host", "cloud")),
    ("seo", "SEO and site performance", 5, "planned", "Metadata, sitemaps, robots, redirects, schema markup, alt text, optimization checklists, performance budgets, and answer-engine visibility.", "", ("seo", "performance", "schema markup", "answer engine", "aeo", "llms")),
    ("commerce", "Commerce and payments", 5, "planned", "Products/variants, cart/checkout, orders, fulfillment, shipping/tax/discounts, digital downloads, and configured sandbox payment providers.", "", ("ecommerce", "e-commerce", "checkout", "orders", "digital downloads", "payments")),
    ("analytics", "Analytics and optimization", 5, "planned", "Consent-aware events/traffic, dashboards, segmentation, experiments, personalization, and optimization reporting.", "", ("analyz", "analytics", "optimiz", "traffic", "targeting")),
    ("billing", "Plans, seats, and billing", 5, "planned", "Entitlements/quotas, seat management, billing groups, subscriptions, invoices, and provider-backed checkout/webhooks.", "", ("billing", "plan overview", "credits", "seats", "subscription")),
    ("plugins", "Plugins, APIs, webhooks, and MCP", 6, "planned", "Permissioned APIs, sandboxed plugins, widgets/apps, webhooks, MCP tools, and integration management.", "", ("plugins", "integrations", "mcp", "webhook", "api", "widgets", "apps")),
    ("ai", "AI providers and governance", 6, "planned", "Configured AI provider adapters for generation/search/rewrite/translation, code creation, credits, attachment/web-search policies, and team guardrails. No placeholder AI is claimed.", "", (" ai", "ai ", "chatgpt", "agent", "make", "generative")),
    ("enterprise", "Enterprise identity and administration", 6, "planned", "SAML/OAuth/SSO/SCIM, domain capture, custom roles, organization policies, audit/privacy controls, data residency, and managed desktop deployment.", "", ("saml", "sso", "scim", "governance", "enterprise", "deploy figma", "domain capture", "privacy")),
    ("native-formats", "Native file migration and interoperability", 6, "planned", "Documented Penpot/Figma/Sketch formats, cross-tool migration, whiteboard imports, spreadsheet/CSV data, IDE integration, and compatibility fixtures.", "", ("migration", "migrate", "file format", "penpot files", "lucid", "mural", "spreadsheet", "vs code")),
]


class TopicParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.headings: list[dict[str, Any]] = []
        self._ignored: list[str] = []
        self._capture: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "nav", "header", "footer", "aside", "svg"}:
            self._ignored.append(tag)
        if not self._ignored and tag in {"title", "h1", "h2", "h3", "h4"}:
            self._capture = tag
            self._text = []

    def handle_endtag(self, tag: str) -> None:
        if tag == self._capture:
            text = " ".join("".join(self._text).split())
            if tag == "title":
                self.title = text
            elif text:
                self.headings.append({"level": int(tag[1]), "text": text})
            self._capture = None
            self._text = []
        if tag in self._ignored:
            index = len(self._ignored) - 1 - self._ignored[::-1].index(tag)
            del self._ignored[index:]

    def handle_data(self, data: str) -> None:
        if self._capture and not self._ignored:
            self._text.append(data)


IGNORED_SECTIONS = re.compile(r"<(script|style|nav|header|footer|aside|svg)\b[^>]*>.*?</\1\s*>", re.IGNORECASE | re.DOTALL)
OUTLINE_FRAGMENTS = re.compile(r"<(title|h[1-4])\b[^>]*>.*?</\1\s*>", re.IGNORECASE | re.DOTALL)
HTML_COMMENTS = re.compile(r"<!--.*?-->", re.DOTALL)


def extract_outline(content: str) -> TopicParser:
    parser = TopicParser()
    content = IGNORED_SECTIONS.sub("", HTML_COMMENTS.sub("", content))
    for fragment in OUTLINE_FRAGMENTS.finditer(content):
        parser.feed(fragment.group())
    return parser


def suggested_phase(text: str) -> int:
    text = text.lower()
    for phase, terms in (
        (6, ("saml", "sso", "scim", "mcp", "plugin", " ai ", "chatgpt", "agent", "enterprise installer", "file format")),
        (5, ("publish", "billing", "ecommerce", "checkout", "analytics", "analyze", "optimize", "seo", "domain", "hosting", "pricing", "plan overview")),
        (3, ("account", "team", "organization", "comment", "collaborat", "branch", "permission", "sharing", "session", "members", "roles")),
        (4, ("cms", "locale", "localiz", "forms", "webpage", "responsive", "breakpoint", "accessibility", "screen reader", "dev mode", "dev tools", "css", "webflow")),
        (1, ("version history", "save", "projects and files", "workspace basics")),
    ):
        if any(term in f" {text} " for term in terms):
            return phase
    return 2


def canonical_url(value: str) -> str:
    parsed = urlsplit(value)
    path = re.sub(r"/(articles|sections|categories)/(\d+)(?:-[^/]+)?", r"/\1/\2", parsed.path)
    return urlunsplit((parsed.scheme, parsed.netloc.lower(), path.rstrip("/"), parsed.query, ""))


class RequirementsCatalog:
    _CACHE_VERSION = 1

    def __init__(self, root: Path, cache_path: Path | None = None) -> None:
        self.root = root
        self._cache_path = cache_path or root / ".requirements-index.json"
        self._loaded = False
        self._lock = Lock()
        self._sources: list[dict[str, Any]] = []
        self._topics: list[dict[str, Any]] = []

    def _read_cache(self) -> dict[str, Any]:
        try:
            payload = json.loads(self._cache_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}
        if payload.get("version") != self._CACHE_VERSION or not isinstance(payload.get("topics"), dict):
            return {}
        return payload["topics"]

    def _write_cache(self, topics: dict[str, Any]) -> None:
        temporary = self._cache_path.with_name(f"{self._cache_path.name}.{os.getpid()}.tmp")
        try:
            temporary.write_text(json.dumps({"version": self._CACHE_VERSION, "topics": topics}, separators=(",", ":")), encoding="utf-8")
            os.replace(temporary, self._cache_path)
        except OSError:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass

    @classmethod
    def _topic_fingerprint(cls, source_id: str, key: str, relative: str, item: dict[str, Any], file_stat: os.stat_result) -> str:
        payload = {
            "version": cls._CACHE_VERSION, "source": source_id, "key": key,
            "relative_path": relative, "encoding": item.get("encoding") or "utf-8",
            "size": file_stat.st_size, "mtime_ns": file_stat.st_mtime_ns,
        }
        return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

    @staticmethod
    def _topic_key(source_id: str, url: str) -> str:
        return f"{source_id}:{canonical_url(url)}"

    def _restore_cached_topic(self, record: Any, key: str, source_id: str, relative: str, local_path: str) -> dict[str, Any] | None:
        if not isinstance(record, dict) or record.get("key") != key or record.get("relative_path") != relative:
            return None
        cached = record.get("topic")
        if not isinstance(cached, dict):
            return None
        title = cached.get("title")
        url = cached.get("url")
        cached_outline = cached.get("outline")
        if not isinstance(title, str) or not isinstance(url, str) or not isinstance(cached_outline, list):
            return None
        outline = [
            {"level": heading["level"], "text": heading["text"]}
            for heading in cached_outline
            if isinstance(heading, dict) and isinstance(heading.get("level"), int)
            and 1 <= heading["level"] <= 4 and isinstance(heading.get("text"), str)
        ]
        searchable = " ".join([title, relative, *(heading["text"] for heading in outline)])
        return {
            "id": hashlib.sha256(key.encode()).hexdigest()[:16], "source": source_id,
            "title": title, "url": url, "local_path": local_path,
            "outline": outline, "phase": suggested_phase(searchable),
            "status": "needs_review", "kind": "reference" if relative.startswith(("glossary/", "contributing-guide/")) else "documentation",
            "_search": searchable.lower(),
        }

    def _load(self) -> None:
        with self._lock:
            if self._loaded:
                return
            cache_records = self._read_cache()
            current_records: dict[str, Any] = {}
            sources: dict[str, dict[str, Any]] = {}
            topics: dict[str, dict[str, Any]] = {}
            seen_keys: set[str] = set()
            for manifest_path in sorted(self.root.glob("*/manifest.json")):
                try:
                    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                    base = manifest_path.parent.resolve()
                except (OSError, ValueError):
                    continue
                host = urlsplit(manifest.get("root_url", "")).netloc.removeprefix("www.")
                source_id = next((key for key, definition in SOURCE_DEFINITIONS.items() if host == definition[1]), None)
                if source_id is None:
                    continue
                name, _, prefixes = SOURCE_DEFINITIONS[source_id]
                source = sources.setdefault(source_id, {
                    "id": source_id, "name": name, "root_url": manifest.get("root_url", ""),
                    "downloaded_at": manifest.get("downloaded_at", ""), "topic_count": 0,
                    "status": "snapshot", "issues": [],
                })
                source["issues"].extend(error.get("error", "Download failed") for error in manifest.get("errors", []))
                for item in manifest.get("files", []):
                    relative = item.get("relative_path", "").replace("\\", "/")
                    if item.get("content_type", "").split(";")[0] != "text/html":
                        continue
                    if relative != "index.html" and not relative.startswith(prefixes):
                        continue
                    if "theming_assets/" in relative or "article_attachments/" in relative:
                        continue
                    url = item.get("final_url") or item.get("url", "")
                    if urlsplit(url).scheme not in {"https", "http"}:
                        source["issues"].append(f"Invalid source URL: {relative}")
                        continue
                    relative_path = PurePosixPath(relative)
                    try:
                        path = base.joinpath(*relative_path.parts).resolve()
                    except OSError:
                        source["issues"].append(f"Unsafe snapshot path: {relative}")
                        continue
                    if relative_path.is_absolute() or ".." in relative_path.parts or not path.is_relative_to(base):
                        source["issues"].append(f"Unsafe snapshot path: {relative}")
                        continue
                    key = self._topic_key(source_id, url)
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)
                    try:
                        file_stat = path.stat()
                    except OSError:
                        source["issues"].append(f"Unreadable snapshot: {relative}")
                        continue
                    if not stat.S_ISREG(file_stat.st_mode):
                        source["issues"].append(f"Unreadable snapshot: {relative}")
                        continue
                    fingerprint = self._topic_fingerprint(source_id, key, relative, item, file_stat)
                    local_path = f"{manifest_path.parent.name}/{relative}"
                    topic = self._restore_cached_topic(cache_records.get(fingerprint), key, source_id, relative, local_path)
                    if topic is None:
                        try:
                            parser = extract_outline(path.read_text(encoding=item.get("encoding") or "utf-8", errors="replace"))
                        except (OSError, ValueError, LookupError):
                            source["issues"].append(f"Unreadable snapshot: {relative}")
                            continue
                        title = parser.title or next((h["text"] for h in parser.headings if h["level"] == 1), relative)
                        title = re.split(r"\s[–·]\s|\s-\s(?:Webflow|Figma)", title)[0]
                        searchable = " ".join([title, relative, *(h["text"] for h in parser.headings)])
                        topic = {
                            "id": hashlib.sha256(key.encode()).hexdigest()[:16], "source": source_id,
                            "title": title, "url": url, "local_path": local_path,
                            "outline": parser.headings, "phase": suggested_phase(searchable),
                            "status": "needs_review", "kind": "reference" if relative.startswith(("glossary/", "contributing-guide/")) else "documentation",
                            "_search": searchable.lower(),
                        }
                    topics[key] = topic
                    current_records[fingerprint] = {
                        "key": key, "relative_path": relative,
                        "topic": {field: value for field, value in topic.items() if field != "_search"},
                    }
                    source["topic_count"] += 1
            for source_id, (name, _, _) in SOURCE_DEFINITIONS.items():
                source = sources.setdefault(source_id, {
                    "id": source_id, "name": name, "root_url": "", "downloaded_at": "",
                    "topic_count": 0, "status": "missing", "issues": ["No download manifest is available."],
                })
                if source["topic_count"] == 0:
                    source["status"] = "missing"
                elif source["topic_count"] == 1:
                    source["status"] = "landing_only"
                    source["issues"].append("Only one page was captured; detailed product requirements are incomplete.")
            self._write_cache(current_records)
            self._sources = list(sources.values())
            self._topics = sorted(topics.values(), key=lambda item: (item["source"], item["title"].lower()))
            self._loaded = True

    def summary(self) -> dict[str, Any]:
        self._load()
        capabilities = []
        for identifier, title, phase, status, scope, evidence, terms in CAPABILITIES:
            refs = [topic["id"] for topic in self._topics if any(term in topic["_search"] for term in terms)]
            capabilities.append({
                "id": identifier, "title": title, "phase": phase, "status": status,
                "scope": scope, "evidence": evidence, "source_topic_ids": refs,
            })
        return {
            "topic_count": len(self._topics), "unreviewed_count": len(self._topics),
            "sources": self._sources, "phases": PHASES, "capabilities": capabilities,
            "coverage_note": "Captured topics and outlines form a review backlog, not a claim of full product parity. Phase assignments are suggestions. Detailed acceptance criteria and missing/linked-only documentation still need review.",
        }

    def topics(self, query: str = "", source: str | None = None, phase: int | None = None,
               offset: int = 0, limit: int = 30) -> dict[str, Any]:
        self._load()
        words = query.lower().split()
        matches = [topic for topic in self._topics if
                   (source is None or topic["source"] == source) and
                   (phase is None or topic["phase"] == phase) and
                   all(word in topic["_search"] for word in words)]
        return {
            "total": len(matches), "offset": offset, "limit": limit,
            "items": [{key: value for key, value in topic.items() if key != "_search"} for topic in matches[offset:offset + limit]],
        }
