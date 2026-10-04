import { useCallback, useEffect, useState } from 'react';
import {
  createCanvas,
  createVersion,
  deleteCanvas,
  duplicateCanvas,
  fetchCanvas,
  fetchCanvases,
  restoreVersion,
} from './api';
import { CanvasArea } from './components/CanvasArea';
import { CounterWidget } from './components/CounterWidget';
import { LayersPanel } from './components/LayersPanel';
import { Navbar } from './components/Navbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ShortcutsModal } from './components/ShortcutsModal';
import { TemplateModal } from './components/TemplateModal';
import { Toolbar } from './components/Toolbar';
import { RequirementsPanel } from './components/RequirementsPanel';
import { VersionsPanel } from './components/VersionsPanel';
import { applyAutoLayoutToArtboard } from './utils/autoLayout';
import { exportToJSON } from './utils/export';
import { LAST_DOCUMENT_KEY, readRecoveryDraft, useCanvasPersistence } from './utils/useCanvasPersistence';
import {
  Artboard,
  ARTBOARD_PRESETS,
  ArtboardPreset,
  CanvasData,
  CanvasDocument,
  CanvasElement,
  CanvasSettings,
  CanvasSummary,
  Connector,
  STICKY_PRESETS,
  StickyColor,
  ToolType,
  Viewport,
} from './types';

export default function App() {
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const handleDocumentSaved = useCallback((saved: CanvasDocument) => {
    // Refresh canvas summary list
    setCanvases((previous) => previous.map((canvas) => canvas.id === saved.id ? {
      ...canvas, name: saved.name, description: saved.description,
      element_count: saved.data.elements.length, artboard_count: saved.data.artboards.length,
      revision: saved.revision, updated_at: saved.updated_at,
    } : canvas));
  }, []);
  const {
    document: currentDoc, documentRef, setDocument: setCurrentDoc, saveStatus, syncMessage,
    loadDocument, triggerAutoSave, flushPendingSaves, reportError, discardDraft,
  } = useCanvasPersistence(handleDocumentSaved);

  // Interactive selection state
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedArtboardId, setSelectedArtboardId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [selectedStickyColor, setSelectedStickyColor] = useState<StickyColor>('yellow');

  // History stack for Undo/Redo
  const [historyPast, setHistoryPast] = useState<CanvasData[]>([]);
  const [historyFuture, setHistoryFuture] = useState<CanvasData[]>([]);

  // Modals
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  const [isRequirementsOpen, setIsRequirementsOpen] = useState(false);
  const [isVersionsOpen, setIsVersionsOpen] = useState(false);

  // Initial load
  const loadInitialData = useCallback(async () => {
    try {
      const list = await fetchCanvases();
      setCanvases(list);
      let remembered: string | null = null;
      try { remembered = localStorage.getItem(LAST_DOCUMENT_KEY); } catch {}
      const orphanedDraft = remembered && !list.some((canvas) => canvas.id === remembered) ? readRecoveryDraft(remembered) : null;
      if (orphanedDraft) {
        loadDocument(orphanedDraft.document, false);
        triggerAutoSave(orphanedDraft.document);
        reportError(new Error('The original project is no longer on the server. Your browser draft is retained; keep it as a new project or download its JSON.'));
        return;
      }
      if (list.length > 0) {
        const target = list.find((canvas) => canvas.id === remembered) ?? list[0];
        loadDocument(await fetchCanvas(target.id));
      } else {
        const created = await createCanvas('Starter Project: Hybrid Creative Canvas');
        loadDocument(created);
        setCanvases([{
          id: created.id, name: created.name, description: created.description,
          element_count: created.data.elements.length, artboard_count: created.data.artboards.length,
          revision: created.revision, created_at: created.created_at, updated_at: created.updated_at,
        }]);
      }
    } catch (error) {
      let remembered: string | null = null;
      try { remembered = localStorage.getItem(LAST_DOCUMENT_KEY); } catch {}
      const draft = remembered ? readRecoveryDraft(remembered) : null;
      if (draft) {
        loadDocument(draft.document, false);
        triggerAutoSave(draft.document);
      }
      reportError(error);
    }
  }, [loadDocument, triggerAutoSave, reportError]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // Save history snapshot before making mutating changes
  const saveHistorySnapshot = useCallback(() => {
    const document = documentRef.current;
    if (!document) return;
    const snapshot = JSON.stringify(document.data);
    setHistoryPast((prev) => prev.length && JSON.stringify(prev[prev.length - 1]) === snapshot
      ? prev : [...prev.slice(-49), JSON.parse(snapshot)]);
    setHistoryFuture([]);
  }, [documentRef]);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyPast.length === 0 || !currentDoc) return;
    const previous = historyPast[historyPast.length - 1];
    const newPast = historyPast.slice(0, -1);
    setHistoryFuture((prev) => [JSON.parse(JSON.stringify(currentDoc.data)), ...prev]);
    setHistoryPast(newPast);

    const updatedDoc: CanvasDocument = {
      ...currentDoc,
      data: previous,
    };
    setCurrentDoc(updatedDoc);
    triggerAutoSave(updatedDoc);
  }, [historyPast, currentDoc, triggerAutoSave]);

  const handleRedo = useCallback(() => {
    if (historyFuture.length === 0 || !currentDoc) return;
    const next = historyFuture[0];
    const newFuture = historyFuture.slice(1);
    setHistoryPast((prev) => [...prev, JSON.parse(JSON.stringify(currentDoc.data))]);
    setHistoryFuture(newFuture);

    const updatedDoc: CanvasDocument = {
      ...currentDoc,
      data: next,
    };
    setCurrentDoc(updatedDoc);
    triggerAutoSave(updatedDoc);
  }, [historyFuture, currentDoc, triggerAutoSave]);

  // Update canvas document data
  const updateCanvasData = useCallback(
    (updater: (prev: CanvasData) => CanvasData) => {
      const document = documentRef.current;
      if (!document) return;
      const nextData = updater(document.data);
      const updatedDoc: CanvasDocument = { ...document, data: nextData };
      setCurrentDoc(updatedDoc);
      triggerAutoSave(updatedDoc);
    },
    [documentRef, setCurrentDoc, triggerAutoSave]
  );

  // Viewport updates
  const handleUpdateViewport = useCallback(
    (viewport: Viewport) => {
      updateCanvasData((prev) => ({ ...prev, viewport }));
    },
    [updateCanvasData]
  );

  // Settings updates
  const handleUpdateSettings = useCallback(
    (updates: Partial<CanvasSettings>) => {
      saveHistorySnapshot();
      updateCanvasData((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...updates },
      }));
    },
    [saveHistorySnapshot, updateCanvasData]
  );

  // Element CRUD
  const handleAddElement = useCallback(
    (newEl: CanvasElement) => {
      saveHistorySnapshot();
      updateCanvasData((prev) => {
        let elToAdd = { ...newEl };
        if (!elToAdd.artboardId) {
          const cx = elToAdd.x + elToAdd.width / 2;
          const cy = elToAdd.y + elToAdd.height / 2;
          const containingAb = prev.artboards.find(
            (ab) => cx >= ab.x && cx <= ab.x + ab.width && cy >= ab.y && cy <= ab.y + ab.height
          );
          if (containingAb) {
            elToAdd.artboardId = containingAb.id;
          }
        }

        let nextElements = [...prev.elements, elToAdd];
        if (elToAdd.artboardId) {
          const ab = prev.artboards.find((a) => a.id === elToAdd.artboardId);
          if (ab && ab.autoLayout?.enabled) {
            nextElements = applyAutoLayoutToArtboard(ab, nextElements);
          }
        }

        return {
          ...prev,
          elements: nextElements,
        };
      });
    },
    [saveHistorySnapshot, updateCanvasData]
  );

  const handleUpdateElement = useCallback(
    (id: string, updates: Partial<CanvasElement>) => {
      updateCanvasData((prev) => {
        const previousTarget = prev.elements.find((el) => el.id === id);
        let updatedElements = prev.elements.map((el) => (el.id === id ? { ...el, ...updates } : el));
        const updatedTarget = updatedElements.find((el) => el.id === id);
        const affectedFrames = new Set([previousTarget?.artboardId, updatedTarget?.artboardId]);
        for (const ab of prev.artboards) {
          if (affectedFrames.has(ab.id) && ab.autoLayout?.enabled) {
            updatedElements = applyAutoLayoutToArtboard(ab, updatedElements);
          }
        }
        return {
          ...prev,
          elements: updatedElements,
        };
      });
    },
    [updateCanvasData]
  );

  const handleDeleteElement = useCallback(
    (id: string) => {
      saveHistorySnapshot();
      updateCanvasData((prev) => {
        const target = prev.elements.find((el) => el.id === id);
        let nextElements = prev.elements.filter((el) => el.id !== id);
        if (target?.artboardId) {
          const ab = prev.artboards.find((a) => a.id === target.artboardId);
          if (ab && ab.autoLayout?.enabled) {
            nextElements = applyAutoLayoutToArtboard(ab, nextElements);
          }
        }
        return {
          ...prev,
          elements: nextElements,
          connectors: prev.connectors.filter(
            (c) => c.fromElementId !== id && c.toElementId !== id
          ),
        };
      });
      if (selectedElementId === id) setSelectedElementId(null);
    },
    [saveHistorySnapshot, updateCanvasData, selectedElementId]
  );

  // Artboard CRUD
  const handleAddArtboard = useCallback(
    (newAb: Artboard) => {
      saveHistorySnapshot();
      updateCanvasData((prev) => ({
        ...prev,
        artboards: [...prev.artboards, newAb],
      }));
    },
    [saveHistorySnapshot, updateCanvasData]
  );

  const handleUpdateArtboard = useCallback(
    (id: string, updates: Partial<Artboard>) => {
      updateCanvasData((prev) => {
        const nextArtboards = prev.artboards.map((ab) => (ab.id === id ? { ...ab, ...updates } : ab));
        const updatedAb = nextArtboards.find((ab) => ab.id === id);
        let nextElements = prev.elements;
        if (updatedAb && updatedAb.autoLayout?.enabled) {
          nextElements = applyAutoLayoutToArtboard(updatedAb, nextElements);
        }
        return {
          ...prev,
          artboards: nextArtboards,
          elements: nextElements,
        };
      });
    },
    [updateCanvasData]
  );

  const handleReflowArtboard = useCallback(
    (id: string) => {
      saveHistorySnapshot();
      updateCanvasData((prev) => {
        const targetAb = prev.artboards.find((ab) => ab.id === id);
        if (!targetAb) return prev;
        const nextElements = applyAutoLayoutToArtboard(targetAb, prev.elements);
        return {
          ...prev,
          elements: nextElements,
        };
      });
    },
    [saveHistorySnapshot, updateCanvasData]
  );

  const handleDeleteArtboard = useCallback(
    (id: string) => {
      saveHistorySnapshot();
      updateCanvasData((prev) => {
        const removed = new Set(prev.elements.filter((el) => el.artboardId === id).map((el) => el.id));
        return {
          ...prev,
          artboards: prev.artboards.filter((ab) => ab.id !== id),
          elements: prev.elements.filter((el) => !removed.has(el.id)),
          connectors: prev.connectors.filter((connector) => !removed.has(connector.fromElementId) && !removed.has(connector.toElementId)),
        };
      });
      if (selectedArtboardId === id) setSelectedArtboardId(null);
    },
    [saveHistorySnapshot, updateCanvasData, selectedArtboardId]
  );

  // Quick preset adders
  const handleAddArtboardPreset = useCallback(
    (presetKey: ArtboardPreset) => {
      saveHistorySnapshot();
      const preset = ARTBOARD_PRESETS[presetKey];
      const viewport = currentDoc?.data.viewport || { zoom: 1, panX: 0, panY: 0 };
      const centerX = Math.round((-viewport.panX + 400) / viewport.zoom);
      const centerY = Math.round((-viewport.panY + 250) / viewport.zoom);

      const newArtboard: Artboard = {
        id: `artboard-${Date.now()}`,
        name: preset.label.split(' ')[0] + ' Frame',
        preset: presetKey,
        x: centerX,
        y: centerY,
        width: preset.width,
        height: preset.height,
        fill: '#ffffff',
        clipContent: true,
      };

      handleAddArtboard(newArtboard);
      setSelectedElementId(null);
      setSelectedArtboardId(newArtboard.id);
      setActiveTool('select');
    },
    [saveHistorySnapshot, currentDoc, handleAddArtboard]
  );

  const handleAddQuickSticky = useCallback(
    (color: StickyColor) => {
      saveHistorySnapshot();
      const preset = STICKY_PRESETS[color];
      const viewport = currentDoc?.data.viewport || { zoom: 1, panX: 0, panY: 0 };
      const centerX = Math.round((-viewport.panX + 500) / viewport.zoom);
      const centerY = Math.round((-viewport.panY + 300) / viewport.zoom);

      const newSticky: CanvasElement = {
        id: `sticky-${Date.now()}`,
        type: 'sticky',
        name: `${preset.label} Sticky Note`,
        x: centerX,
        y: centerY,
        width: 200,
        height: 180,
        rotation: Math.floor(Math.random() * 6) - 3,
        fill: preset.fill,
        stroke: preset.stroke,
        strokeWidth: 1,
        opacity: 1,
        cornerRadius: 6,
        text: 'New thought or idea...',
        fontSize: 14,
        textColor: preset.textColor,
        colorPreset: color,
        zIndex: (currentDoc?.data.elements.length || 0) + 1,
      };

      handleAddElement(newSticky);
      setSelectedArtboardId(null);
      setSelectedElementId(newSticky.id);
      setActiveTool('select');
    },
    [saveHistorySnapshot, currentDoc, handleAddElement]
  );

  // Duplicate selected element
  const handleDuplicateSelected = useCallback(() => {
    if (!selectedElementId || !currentDoc) return;
    const target = currentDoc.data.elements.find((el) => el.id === selectedElementId);
    if (!target) return;

    saveHistorySnapshot();
    const cloned: CanvasElement = {
      ...JSON.parse(JSON.stringify(target)),
      id: `copy-${Date.now()}`,
      name: `${target.name} (Copy)`,
      x: target.x + 30,
      y: target.y + 30,
      zIndex: currentDoc.data.elements.length + 1,
    };
    handleAddElement(cloned);
    setSelectedElementId(cloned.id);
  }, [selectedElementId, currentDoc, saveHistorySnapshot, handleAddElement]);

  // Align elements
  const handleAlignElements = useCallback(
    (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      if (!selectedElementId || !currentDoc) return;
      const target = currentDoc.data.elements.find((el) => el.id === selectedElementId);
      if (!target) return;

      saveHistorySnapshot();
      // Find parent artboard if inside one, or align to 0
      const artboard = target.artboardId
        ? currentDoc.data.artboards.find((ab) => ab.id === target.artboardId)
        : null;

      const refX = artboard ? artboard.x : 100;
      const refY = artboard ? artboard.y : 100;
      const refW = artboard ? artboard.width : 800;
      const refH = artboard ? artboard.height : 600;

      let newX = target.x;
      let newY = target.y;

      switch (alignment) {
        case 'left':
          newX = refX + 20;
          break;
        case 'center':
          newX = refX + (refW - target.width) / 2;
          break;
        case 'right':
          newX = refX + refW - target.width - 20;
          break;
        case 'top':
          newY = refY + 20;
          break;
        case 'middle':
          newY = refY + (refH - target.height) / 2;
          break;
        case 'bottom':
          newY = refY + refH - target.height - 20;
          break;
      }

      handleUpdateElement(target.id, { x: Math.round(newX), y: Math.round(newY) });
    },
    [selectedElementId, currentDoc, saveHistorySnapshot, handleUpdateElement]
  );

  // Layer ordering
  const handleReorderElement = useCallback(
    (direction: 'front' | 'back' | 'forward' | 'backward', id = selectedElementId) => {
      if (!id || !documentRef.current) return;
      saveHistorySnapshot();
      updateCanvasData((prev) => {
        const ordered = [...prev.elements].sort((a, b) => a.zIndex - b.zIndex);
        const index = ordered.findIndex((el) => el.id === id);
        if (index < 0) return prev;
        const [target] = ordered.splice(index, 1);
        const destination = direction === 'front' ? ordered.length : direction === 'back' ? 0
          : direction === 'forward' ? Math.min(index + 1, ordered.length) : Math.max(0, index - 1);
        ordered.splice(destination, 0, target);
        let elements = ordered.map((el, order) => ({ ...el, zIndex: order + 1 }));
        for (const artboard of prev.artboards) {
          if (artboard.autoLayout?.enabled) elements = applyAutoLayoutToArtboard(artboard, elements);
        }
        return { ...prev, elements };
      });
    },
    [selectedElementId, documentRef, saveHistorySnapshot, updateCanvasData]
  );

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const activeTag = target.tagName;
      if (isRequirementsOpen || isVersionsOpen || isTemplateModalOpen || isShortcutsModalOpen ||
          target.isContentEditable || activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementId) {
          e.preventDefault();
          handleDeleteElement(selectedElementId);
        } else if (selectedArtboardId) {
          e.preventDefault();
          handleDeleteArtboard(selectedArtboardId);
        }
        return;
      }

      // Tool switching
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          break;
        case 'h':
          setActiveTool('hand');
          break;
        case 'r':
          setActiveTool('rect');
          break;
        case 'o':
          setActiveTool('circle');
          break;
        case 's':
          setActiveTool('sticky');
          break;
        case 'f':
          setActiveTool('artboard');
          break;
        case 't':
          setActiveTool('text');
          break;
        case 'l':
          setActiveTool('arrow');
          break;
        case 'p':
          setActiveTool('freehand');
          break;
        case 'g':
          if (currentDoc) {
            handleUpdateSettings({ grid: !currentDoc.data.settings.grid });
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isRequirementsOpen,
    isVersionsOpen,
    isTemplateModalOpen,
    isShortcutsModalOpen,
    selectedElementId,
    selectedArtboardId,
    currentDoc,
    handleUndo,
    handleRedo,
    handleDuplicateSelected,
    handleDeleteElement,
    handleDeleteArtboard,
    handleUpdateSettings,
  ]);

  // Project Document management
  const showDocument = (doc: CanvasDocument, recover = true) => {
    loadDocument(doc, recover);
    setSelectedElementId(null);
    setSelectedArtboardId(null);
    setHistoryPast([]);
    setHistoryFuture([]);
    const summary: CanvasSummary = {
      id: doc.id, name: doc.name, description: doc.description,
      element_count: doc.data.elements.length, artboard_count: doc.data.artboards.length,
      revision: doc.revision, created_at: doc.created_at, updated_at: doc.updated_at,
    };
    setCanvases((prev) => prev.some((item) => item.id === doc.id)
      ? prev.map((item) => item.id === doc.id ? summary : item) : [summary, ...prev]);
  };

  const handleSelectCanvas = async (id: string) => {
    if (id === documentRef.current?.id) return;
    try {
      await flushPendingSaves();
      showDocument(await fetchCanvas(id));
    } catch (error) {
      reportError(error);
    }
  };

  const handleCreateNewCanvas = async () => {
    try {
      await flushPendingSaves();
      const created = await createCanvas(`Canvas ${canvases.length + 1}`, '', {
        schemaVersion: 1, viewport: { zoom: 1, panX: 80, panY: 60 },
        settings: { grid: true, snapToGrid: true, gridSize: 20, theme: 'light', backgroundColor: '#f8fafc' },
        artboards: [], elements: [], connectors: [],
      });
      showDocument(created, false);
    } catch (error) {
      reportError(error);
    }
  };

  const handleDuplicateCurrentCanvas = async () => {
    try {
      await flushPendingSaves();
      const doc = documentRef.current;
      if (doc) showDocument(await duplicateCanvas(doc.id), false);
    } catch (error) {
      reportError(error);
    }
  };

  const handleDeleteCurrentCanvas = async () => {
    if (!currentDoc || canvases.length <= 1) return;
    try {
      await flushPendingSaves();
      const doc = documentRef.current!;
      await deleteCanvas(doc.id);
      discardDraft(doc.id);
      const remaining = canvases.filter((canvas) => canvas.id !== doc.id);
      setCanvases(remaining);
      if (remaining.length) showDocument(await fetchCanvas(remaining[0].id));
    } catch (error) {
      reportError(error);
    }
  };

  const handleUpdateDocumentName = (newName: string) => {
    const doc = documentRef.current;
    if (!doc) return;
    const updated: CanvasDocument = { ...doc, name: newName };
    setCurrentDoc(updated);
    triggerAutoSave(updated);
  };

  const handleImportJSON = async (imported: CanvasDocument) => {
    if (!imported.data || typeof imported.data !== 'object') throw new Error('The import must contain canvas data.');
    await flushPendingSaves();
    const created = await createCanvas(
      typeof imported.name === 'string' ? imported.name : 'Imported canvas',
      typeof imported.description === 'string' ? imported.description : '', imported.data,
    );
    showDocument(created, false);
  };

  const handleKeepDraftAsProject = async () => {
    const doc = documentRef.current;
    if (!doc) return;
    try {
      const created = await createCanvas(`${doc.name.slice(0, 109)} (Recovery)`, doc.description, doc.data);
      discardDraft(doc.id);
      showDocument(created, false);
    } catch (error) { reportError(error); }
  };

  const handleCreateVersion = async (label: string) => {
    await flushPendingSaves();
    const doc = documentRef.current;
    if (doc) await createVersion(doc.id, label, doc.revision);
  };

  const handleRestoreVersion = async (versionId: string) => {
    await flushPendingSaves();
    const doc = documentRef.current;
    if (doc) showDocument(await restoreVersion(doc.id, versionId, doc.revision), false);
  };

  // Zoom helpers
  const handleZoomIn = () => {
    if (!currentDoc) return;
    const zoom = Math.min(4.0, currentDoc.data.viewport.zoom * 1.2);
    handleUpdateViewport({ ...currentDoc.data.viewport, zoom });
  };

  const handleZoomOut = () => {
    if (!currentDoc) return;
    const zoom = Math.max(0.15, currentDoc.data.viewport.zoom / 1.2);
    handleUpdateViewport({ ...currentDoc.data.viewport, zoom });
  };

  const handleZoomReset = () => {
    if (!currentDoc) return;
    handleUpdateViewport({ ...currentDoc.data.viewport, zoom: 1.0 });
  };

  const handleZoomFit = () => {
    if (!currentDoc) return;
    const elements = currentDoc.data.elements;
    const artboards = currentDoc.data.artboards;
    if (elements.length === 0 && artboards.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const ab of artboards) {
      minX = Math.min(minX, ab.x);
      minY = Math.min(minY, ab.y);
      maxX = Math.max(maxX, ab.x + ab.width);
      maxY = Math.max(maxY, ab.y + ab.height);
    }
    for (const el of elements) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }

    const margin = 100;
    const boundsW = maxX - minX + margin * 2;
    const boundsH = maxY - minY + margin * 2;
    const windowW = window.innerWidth - 300;
    const windowH = window.innerHeight - 100;

    const zoom = Math.min(1.5, Math.max(0.2, Math.min(windowW / boundsW, windowH / boundsH)));
    const panX = -minX * zoom + margin;
    const panY = -minY * zoom + margin;

    handleUpdateViewport({ zoom, panX, panY });
  };

  // Apply pre-built template
  const handleApplyTemplate = (
    newArtboards: Artboard[],
    newElements: CanvasElement[],
    newConnectors: Connector[]
  ) => {
    saveHistorySnapshot();
    updateCanvasData((prev) => ({
      ...prev,
      artboards: [...prev.artboards, ...newArtboards],
      elements: [...prev.elements, ...newElements],
      connectors: [...prev.connectors, ...newConnectors],
    }));
  };

  if (!currentDoc) {
    return (
      <div className="canvas-loading-screen">
        {saveStatus !== 'error' && <div className="loading-spinner"></div>}
        <p>{saveStatus === 'error' ? 'Unable to load the workspace' : 'Initializing OmniCanvas workspace...'}</p>
        {saveStatus === 'error' && <>
          <p className="platform-intro" role="alert">{syncMessage}</p>
          <button className="nav-action-btn btn-primary" onClick={() => void loadInitialData()}>Retry connection</button>
        </>}
      </div>
    );
  }

  const selectedElement =
    currentDoc.data.elements.find((el) => el.id === selectedElementId) || null;
  const selectedArtboard =
    currentDoc.data.artboards.find((ab) => ab.id === selectedArtboardId) || null;

  return (
    <div className="canvas-app">
      {/* Top Navbar */}
      <Navbar
        document={currentDoc}
        canvases={canvases}
        saveStatus={saveStatus}
        zoom={currentDoc.data.viewport.zoom}
        grid={currentDoc.data.settings.grid}
        snapToGrid={currentDoc.data.settings.snapToGrid}
        canUndo={historyPast.length > 0}
        canRedo={historyFuture.length > 0}
        onUpdateName={handleUpdateDocumentName}
        onSelectCanvas={handleSelectCanvas}
        onCreateNewCanvas={handleCreateNewCanvas}
        onDuplicateCanvas={handleDuplicateCurrentCanvas}
        onDeleteCanvas={handleDeleteCurrentCanvas}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onZoomFit={handleZoomFit}
        onToggleGrid={() => handleUpdateSettings({ grid: !currentDoc.data.settings.grid })}
        onToggleSnap={() => handleUpdateSettings({ snapToGrid: !currentDoc.data.settings.snapToGrid })}
        onImportJSON={handleImportJSON}
        onOpenTemplates={() => setIsTemplateModalOpen(true)}
        onOpenCounter={() => {}}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        onOpenRequirements={() => setIsRequirementsOpen(true)}
        onOpenVersions={() => setIsVersionsOpen(true)}
      />
      {syncMessage && <div className="sync-notice" role="status">
        <span>{syncMessage}</span>
        {(saveStatus === 'error' || saveStatus === 'conflict') && <>
          <button onClick={() => void flushPendingSaves().catch(reportError)}>Retry save</button>
          <button onClick={() => void handleKeepDraftAsProject()}>Keep draft as new project</button>
        </>}
        <button onClick={() => exportToJSON(currentDoc)}>Download draft JSON</button>
      </div>}

      {/* Main Workspace Layout */}
      <div className="canvas-workspace">
        {/* Left Layers Hierarchy */}
        <LayersPanel
          artboards={currentDoc.data.artboards}
          elements={currentDoc.data.elements}
          selectedElementId={selectedElementId}
          selectedArtboardId={selectedArtboardId}
          onSelectElement={(id) => setSelectedElementId(id)}
          onSelectArtboard={(id) => setSelectedArtboardId(id)}
          onToggleVisibility={(id) => {
            const el = currentDoc.data.elements.find((e) => e.id === id);
            if (el) handleUpdateElement(id, { hidden: !el.hidden });
          }}
          onToggleLock={(id) => {
            const el = currentDoc.data.elements.find((e) => e.id === id);
            if (el) handleUpdateElement(id, { locked: !el.locked });
          }}
          onReorderElement={(id, dir) => {
            setSelectedElementId(id);
            handleReorderElement(dir === 'up' ? 'forward' : 'backward', id);
          }}
          onDeleteElement={handleDeleteElement}
          onDeleteArtboard={handleDeleteArtboard}
        />

        {/* Floating Creative Toolbar */}
        <Toolbar
          activeTool={activeTool}
          selectedStickyColor={selectedStickyColor}
          onSelectTool={(tool) => setActiveTool(tool)}
          onSelectStickyColor={(color) => setSelectedStickyColor(color)}
          onAddArtboardPreset={handleAddArtboardPreset}
          onAddQuickSticky={handleAddQuickSticky}
        />

        {/* Interactive Infinite Canvas */}
        <CanvasArea
          viewport={currentDoc.data.viewport}
          settings={currentDoc.data.settings}
          artboards={currentDoc.data.artboards}
          elements={currentDoc.data.elements}
          connectors={currentDoc.data.connectors}
          activeTool={activeTool}
          selectedElementId={selectedElementId}
          selectedArtboardId={selectedArtboardId}
          selectedStickyColor={selectedStickyColor}
          onUpdateViewport={handleUpdateViewport}
          onSelectElement={(id) => setSelectedElementId(id)}
          onSelectArtboard={(id) => setSelectedArtboardId(id)}
          onUpdateElement={handleUpdateElement}
          onAddElement={handleAddElement}
          onAddArtboard={handleAddArtboard}
          onSetTool={(tool) => setActiveTool(tool)}
          onSaveHistorySnapshot={saveHistorySnapshot}
        />

        {/* Right Properties & Styling Inspector */}
        <PropertiesPanel
          selectedElement={selectedElement}
          selectedArtboard={selectedArtboard}
          artboards={currentDoc.data.artboards}
          settings={currentDoc.data.settings}
          elementCount={currentDoc.data.elements.length}
          artboardCount={currentDoc.data.artboards.length}
          onUpdateElement={(updates) => {
            if (selectedElementId) {
              saveHistorySnapshot();
              handleUpdateElement(selectedElementId, updates);
            }
          }}
          onUpdateArtboard={(updates) => {
            if (selectedArtboardId) {
              saveHistorySnapshot();
              handleUpdateArtboard(selectedArtboardId, updates);
            }
          }}
          onUpdateSettings={handleUpdateSettings}
          onAlignElements={handleAlignElements}
          onReorderElement={handleReorderElement}
          onDuplicateSelected={handleDuplicateSelected}
          onDeleteSelected={() => {
            if (selectedElementId) handleDeleteElement(selectedElementId);
            else if (selectedArtboardId) handleDeleteArtboard(selectedArtboardId);
          }}
          onReflowArtboard={handleReflowArtboard}
        />
      </div>

      {/* Docked Persistent Counter Widget (Guarantees backward compatibility) */}
      <CounterWidget />

      {/* Modals */}
      <TemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onApplyTemplate={handleApplyTemplate}
      />

      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
      {isRequirementsOpen && <RequirementsPanel onClose={() => setIsRequirementsOpen(false)} />}
      {isVersionsOpen && <VersionsPanel document={currentDoc} onClose={() => setIsVersionsOpen(false)}
        onCreateVersion={handleCreateVersion} onRestoreVersion={handleRestoreVersion} />}
    </div>
  );
}
