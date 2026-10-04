import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, saveCanvas } from '../api';
import type { CanvasDocument } from '../types';
import { CanvasSaveQueue, type SaveStatus } from './saveQueue';

type Draft = { document: CanvasDocument; baseRevision: number };
const draftKey = (id: string) => `omnicanvas:draft:${id}`;
export const LAST_DOCUMENT_KEY = 'omnicanvas:last-document';

export function readRecoveryDraft(id: string): Draft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey(id)) || 'null') as Draft | null;
    const data = draft?.document?.data;
    return draft?.document.id === id && Number.isInteger(draft.baseRevision) && data?.settings &&
      data.viewport && Array.isArray(data.elements) && Array.isArray(data.artboards) && Array.isArray(data.connectors)
      ? draft : null;
  } catch {
    return null;
  }
}

export function useCanvasPersistence(onSaved: (document: CanvasDocument) => void) {
  const [document, setState] = useState<CanvasDocument | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [syncMessage, setSyncMessage] = useState('');
  const documentRef = useRef<CanvasDocument | null>(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const queueRef = useRef<CanvasSaveQueue | null>(null);

  // Auto-save debounce timer
  const saveTimeoutRef = useRef<number | null>(null);

  const setDocument = useCallback((next: CanvasDocument) => {
    documentRef.current = next;
    setState(next);
  }, []);

  const writeDraft = useCallback((next: CanvasDocument, baseRevision = next.revision) => {
    try {
      localStorage.setItem(draftKey(next.id), JSON.stringify({ document: next, baseRevision }));
    } catch {
      setSyncMessage('Browser recovery storage is unavailable. Keep this tab open or download a JSON backup until the server save succeeds.');
    }
  }, []);

  if (!queueRef.current) {
    queueRef.current = new CanvasSaveQueue(
      (next, revision) => saveCanvas(next.id, {
        name: next.name, description: next.description, data: next.data, expected_revision: revision,
      }),
      (saved, status, latest, error, persisted) => {
        if (persisted) {
          onSavedRef.current(saved);
          const current = documentRef.current;
          if (current?.id === saved.id) {
            setDocument({ ...current, revision: saved.revision, updated_at: saved.updated_at });
          }
          if (latest) {
            try { localStorage.removeItem(draftKey(saved.id)); } catch {}
          } else {
            const draft = readRecoveryDraft(saved.id);
            if (draft) writeDraft({ ...draft.document, revision: saved.revision }, saved.revision);
          }
        }
        if (documentRef.current?.id === saved.id) {
          setSaveStatus(status);
          if (status === 'error' || status === 'conflict') {
            setSyncMessage(error instanceof Error ? error.message : 'Unable to save. Your changes are retained in this tab.');
          } else if (status === 'saved') {
            setSyncMessage('');
          }
        }
      },
    );
  }

  // Debounced auto-save function
  const triggerAutoSave = useCallback((next: CanvasDocument) => {
    writeDraft(next);
    queueRef.current!.enqueue(next);
    if (saveTimeoutRef.current !== null) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      void queueRef.current!.flush().catch(() => {});
    }, 600);
  }, [writeDraft]);

  const loadDocument = useCallback((next: CanvasDocument, recover = true) => {
    queueRef.current!.register(next);
    setDocument(next);
    setSaveStatus('saved');
    setSyncMessage('');
    try { localStorage.setItem(LAST_DOCUMENT_KEY, next.id); } catch {}
    const draft = recover ? readRecoveryDraft(next.id) : null;
    if (draft) {
      const recovered = { ...draft.document, revision: draft.baseRevision };
      queueRef.current!.register(recovered);
      setDocument(recovered);
      if (draft.baseRevision === next.revision) {
        triggerAutoSave(recovered);
        setSyncMessage('Recovered unsaved edits from this browser. Synchronizing them now.');
      } else {
        queueRef.current!.enqueue(recovered);
        setSaveStatus('conflict');
        setSyncMessage('A recovery draft and the server document have different revisions. Download the draft or keep it as a new project; the server version will not be overwritten.');
      }
    }
  }, [setDocument, triggerAutoSave]);

  const flushPendingSaves = useCallback(async () => {
    if (saveTimeoutRef.current !== null) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = null;
    await queueRef.current!.flush();
  }, []);

  const reportError = useCallback((error: unknown) => {
    setSaveStatus(error instanceof ApiError && error.status === 409 ? 'conflict' : 'error');
    setSyncMessage(error instanceof Error ? error.message : 'Unable to connect to the backend.');
  }, []);

  const discardDraft = useCallback((id: string) => {
    queueRef.current!.discard(id);
    try { localStorage.removeItem(draftKey(id)); } catch {}
  }, []);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!queueRef.current!.hasPending()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const retry = () => { void queueRef.current!.flush().catch(() => {}); };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('online', retry);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('online', retry);
      if (saveTimeoutRef.current !== null) window.clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return { document, documentRef, setDocument, saveStatus, syncMessage, loadDocument,
    triggerAutoSave, flushPendingSaves, reportError, discardDraft };
}
