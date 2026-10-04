import type { CanvasData, CanvasDocument, CanvasSummary, CanvasVersion, RequirementsSummary, RequirementTopics } from './types';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = Array.isArray(body.detail)
      ? body.detail.map((item: { msg: string }) => item.msg).join('; ')
      : body.detail;
    throw new ApiError(detail || `Request failed (${response.status})`, response.status);
  }
  return response.json();
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export function fetchCanvases(): Promise<CanvasSummary[]> {
  return request('/canvases');
}

export function fetchCanvas(id: string): Promise<CanvasDocument> {
  return request(`/canvases/${encodeURIComponent(id)}`);
}

export function createCanvas(name = 'Untitled Canvas', description = '', data?: CanvasData): Promise<CanvasDocument> {
  return request('/canvases', json('POST', { name, description, data }));
}

export function saveCanvas(id: string, payload: { name?: string; description?: string; data?: CanvasData; expected_revision?: number }): Promise<CanvasDocument> {
  return request(`/canvases/${encodeURIComponent(id)}`, json('PUT', payload));
}

export async function deleteCanvas(id: string): Promise<void> {
  await request(`/canvases/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function duplicateCanvas(id: string): Promise<CanvasDocument> {
  return request(`/canvases/${encodeURIComponent(id)}/duplicate`, json('POST', {}));
}

export function fetchVersions(id: string): Promise<CanvasVersion[]> {
  return request(`/canvases/${encodeURIComponent(id)}/versions`);
}

export function createVersion(id: string, label: string, revision: number): Promise<CanvasVersion> {
  return request(`/canvases/${encodeURIComponent(id)}/versions`, json('POST', { label, expected_revision: revision }));
}

export function restoreVersion(id: string, versionId: string, revision: number): Promise<CanvasDocument> {
  return request(`/canvases/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}/restore`, json('POST', { expected_revision: revision }));
}

export function fetchRequirements(): Promise<RequirementsSummary> {
  return request('/requirements');
}

export function fetchRequirementTopics(params: { query?: string; source?: string; phase?: number; offset?: number }, signal?: AbortSignal): Promise<RequirementTopics> {
  const query = new URLSearchParams({ limit: '30', offset: String(params.offset ?? 0) });
  if (params.query) query.set('q', params.query);
  if (params.source) query.set('source', params.source);
  if (params.phase) query.set('phase', String(params.phase));
  return request(`/requirements/topics?${query}`, { signal });
}
