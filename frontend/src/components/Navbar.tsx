import React, { useRef, useState } from 'react';
import { CanvasDocument, CanvasSummary } from '../types';
import { exportToJSON, exportToPNG, exportToSVG } from '../utils/export';

interface NavbarProps {
  document: CanvasDocument;
  canvases: CanvasSummary[];
  saveStatus: 'saved' | 'saving' | 'error' | 'conflict';
  zoom: number;
  grid: boolean;
  snapToGrid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUpdateName: (name: string) => void;
  onSelectCanvas: (id: string) => void;
  onCreateNewCanvas: () => void;
  onDuplicateCanvas: () => void;
  onDeleteCanvas: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomFit: () => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onImportJSON: (imported: CanvasDocument) => Promise<void>;
  onOpenTemplates: () => void;
  onOpenCounter: () => void;
  onOpenShortcuts: () => void;
  onOpenRequirements: () => void;
  onOpenVersions: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  document,
  canvases,
  saveStatus,
  zoom,
  grid,
  snapToGrid,
  canUndo,
  canRedo,
  onUpdateName,
  onSelectCanvas,
  onCreateNewCanvas,
  onDuplicateCanvas,
  onDeleteCanvas,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomFit,
  onToggleGrid,
  onToggleSnap,
  onImportJSON,
  onOpenTemplates,
  onOpenCounter,
  onOpenShortcuts,
  onOpenRequirements,
  onOpenVersions,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [docName, setDocName] = useState(document.name);
  const [showProjectsMenu, setShowProjectsMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (docName.trim() && docName !== document.name) {
      onUpdateName(docName.trim());
    } else {
      setDocName(document.name);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Project imports must be under 20 MB.');
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !parsed.data) throw new Error('Invalid canvas JSON format.');
      await onImportJSON(parsed as CanvasDocument);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to import JSON file.');
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <div className="brand-logo" title="OmniCanvas: Hybrid Design & Whiteboard Canvas">
          <span className="logo-icon">🎨</span>
          <span className="logo-title">OmniCanvas</span>
        </div>

        <div className="project-selector-wrapper">
          <button
            className="project-menu-btn"
            onClick={() => setShowProjectsMenu(!showProjectsMenu)}
            title="Switch project"
          >
            <span className="project-name-display">{document.name}</span>
            <span className="dropdown-arrow">▾</span>
          </button>

          {showProjectsMenu && (
            <div className="dropdown-menu projects-dropdown">
              <div className="dropdown-header">
                <span>All Canvases ({canvases.length})</span>
                <button
                  className="btn-link"
                  onClick={() => {
                    setShowProjectsMenu(false);
                    onCreateNewCanvas();
                  }}
                >
                  + New
                </button>
              </div>
              <div className="dropdown-scroll-list">
                {canvases.map((c) => (
                  <div
                    key={c.id}
                    className={`dropdown-item ${c.id === document.id ? 'active' : ''}`}
                    onClick={() => {
                      setShowProjectsMenu(false);
                      onSelectCanvas(c.id);
                    }}
                  >
                    <div className="item-title">{c.name}</div>
                    <div className="item-subtitle">
                      {c.artboard_count} artboards · {c.element_count} elements
                    </div>
                  </div>
                ))}
              </div>
              <div className="dropdown-footer">
                <button
                  className="btn-dropdown-action"
                  onClick={() => {
                    setShowProjectsMenu(false);
                    onDuplicateCanvas();
                  }}
                >
                  Duplicate Current
                </button>
                {canvases.length > 1 && (
                  <button
                    className="btn-dropdown-action text-danger"
                    onClick={() => {
                      setShowProjectsMenu(false);
                      if (confirm('Delete this canvas?')) {
                        onDeleteCanvas();
                      }
                    }}
                  >
                    Delete Current
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {isEditingName ? (
          <input
            className="nav-name-input"
            maxLength={120}
            value={docName}
            autoFocus
            onChange={(e) => setDocName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleNameBlur()}
          />
        ) : (
          <button
            className="rename-trigger"
            onClick={() => {
              setDocName(document.name);
              setIsEditingName(true);
            }}
            title="Click to rename"
          >
            ✎
          </button>
        )}

        <div className={`save-badge status-${saveStatus}`}>
          <span className="status-indicator"></span>
          <span className="status-text">
            {saveStatus === 'saved' && 'Saved (SQLite)'}
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'error' && 'Sync error'}
            {saveStatus === 'conflict' && 'Revision conflict'}
          </span>
        </div>
      </div>

      {/* Center undo / redo & view controls */}
      <div className="navbar-center">
        <div className="btn-group">
          <button
            className="nav-btn"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            className="nav-btn"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo (Ctrl+Y)"
          >
            ↪
          </button>
        </div>

        <div className="separator"></div>

        <div className="btn-group zoom-group">
          <button className="nav-btn" onClick={onZoomOut} title="Zoom out">
            −
          </button>
          <button className="nav-btn zoom-level" onClick={onZoomReset} title="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button className="nav-btn" onClick={onZoomIn} title="Zoom in">
            +
          </button>
          <button className="nav-btn" onClick={onZoomFit} title="Fit all elements">
            [ ]
          </button>
        </div>

        <div className="separator"></div>

        <div className="btn-group">
          <button
            className={`nav-btn ${grid ? 'active' : ''}`}
            onClick={onToggleGrid}
            title="Toggle Grid (G)"
          >
            ▦ Grid
          </button>
          <button
            className={`nav-btn ${snapToGrid ? 'active' : ''}`}
            onClick={onToggleSnap}
            title="Toggle Snap to Grid"
          >
            🧲 Snap
          </button>
        </div>
      </div>

      {/* Right actions: Export, Templates, Counter, Help */}
      <div className="navbar-right">
        <button className="nav-action-btn btn-secondary" onClick={onOpenRequirements}>Requirements</button>
        <button className="nav-action-btn btn-secondary" onClick={onOpenVersions}>Versions</button>
        <button
          className="nav-action-btn btn-secondary"
          onClick={onOpenTemplates}
          title="Insert Templates & Wireframes"
        >
          🧩 Templates
        </button>

        <div className="export-menu-wrapper">
          <button
            className="nav-action-btn btn-primary"
            onClick={() => setShowExportMenu(!showExportMenu)}
          >
            Export ▾
          </button>

          {showExportMenu && (
            <div className="dropdown-menu export-dropdown">
              <button
                className="dropdown-item"
                onClick={() => {
                  setShowExportMenu(false);
                  void exportToPNG(document).catch((error: unknown) => alert(error instanceof Error ? error.message : 'PNG export failed.'));
                }}
              >
                🖼️ Export as PNG image
              </button>
              <button
                className="dropdown-item"
                onClick={() => {
                  setShowExportMenu(false);
                  exportToSVG(document);
                }}
              >
                📐 Export as vector SVG
              </button>
              <button
                className="dropdown-item"
                onClick={() => {
                  setShowExportMenu(false);
                  window.open(`/api/canvases/${document.id}/export/svg`, '_blank');
                }}
              >
                🌐 Server-rendered SVG URL
              </button>
              <div className="dropdown-divider"></div>
              <button
                className="dropdown-item"
                onClick={() => {
                  setShowExportMenu(false);
                  exportToJSON(document);
                }}
              >
                💾 Export project as JSON
              </button>
              <button
                className="dropdown-item"
                onClick={() => {
                  setShowExportMenu(false);
                  fileInputRef.current?.click();
                }}
              >
                📂 Import project JSON
              </button>
            </div>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          accept=".json"
          aria-label="Import project JSON"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <button
          className="nav-icon-btn"
          onClick={onOpenCounter}
          title="Persistent click counter panel"
        >
          ⏱️
        </button>

        <button
          className="nav-icon-btn"
          onClick={onOpenShortcuts}
          title="Keyboard shortcuts & help"
        >
          ❓
        </button>
      </div>
    </header>
  );
};
