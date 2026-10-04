import type { CanvasDocument } from '../types';

export type SaveStatus = 'saved' | 'saving' | 'error' | 'conflict';

type SaveFunction = (document: CanvasDocument, revision: number) => Promise<CanvasDocument>;
type SaveListener = (document: CanvasDocument, status: SaveStatus, latest: boolean, error?: unknown, persisted?: boolean) => void;

export class CanvasSaveQueue {
  private pending = new Map<string, CanvasDocument>();
  private revisions = new Map<string, number>();
  private worker: Promise<void> | null = null;

  constructor(private save: SaveFunction, private listener: SaveListener = () => {}) {}

  register(document: CanvasDocument) {
    this.revisions.set(document.id, document.revision ?? 0);
  }

  enqueue(document: CanvasDocument) {
    if (!this.revisions.has(document.id)) this.register(document);
    this.pending.set(document.id, document);
    this.listener(document, 'saving', false);
  }

  hasPending(id?: string) {
    return id ? this.pending.has(id) : this.pending.size > 0;
  }

  discard(id: string) {
    this.pending.delete(id);
    this.revisions.delete(id);
  }

  flush(): Promise<void> {
    if (this.worker) return this.worker;
    this.worker = this.drain().finally(() => { this.worker = null; });
    return this.worker;
  }

  private async drain() {
    while (this.pending.size) {
      const [id, document] = this.pending.entries().next().value!;
      this.listener(document, 'saving', false);
      try {
        const saved = await this.save(document, this.revisions.get(id) ?? 0);
        this.revisions.set(id, saved.revision);
        const latest = this.pending.get(id) === document;
        if (latest) this.pending.delete(id);
        this.listener(saved, latest ? 'saved' : 'saving', latest, undefined, true);
      } catch (error) {
        const status = error instanceof Error && 'status' in error && error.status === 409 ? 'conflict' : 'error';
        this.listener(document, status, false, error);
        throw error;
      }
    }
  }
}
