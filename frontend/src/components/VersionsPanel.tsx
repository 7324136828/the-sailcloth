import { useEffect, useState, type FormEvent } from 'react';
import { fetchVersions } from '../api';
import type { CanvasDocument, CanvasVersion } from '../types';
import { PlatformDialog } from './PlatformDialog';

interface VersionsPanelProps {
  document: CanvasDocument;
  onClose: () => void;
  onCreateVersion: (label: string) => Promise<void>;
  onRestoreVersion: (versionId: string) => Promise<void>;
}

export function VersionsPanel({ document, onClose, onCreateVersion, onRestoreVersion }: VersionsPanelProps) {
  const [versions, setVersions] = useState<CanvasVersion[]>([]);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchVersions(document.id).then(result => { if (active) setVersions(result); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load versions.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [document.id, generation]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onCreateVersion(label.trim());
      setLabel('');
      setGeneration(value => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create a version.');
    } finally { setBusy(false); }
  };

  const restore = async (version: CanvasVersion) => {
    if (!window.confirm(`Restore “${version.label}”? A recovery snapshot of the current server version will be kept.`)) return;
    setBusy(true);
    setError('');
    try {
      await onRestoreVersion(version.id);
      setGeneration(value => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to restore the version.');
    } finally { setBusy(false); }
  };

  return <PlatformDialog title="Version history" onClose={onClose}>
    <p className="platform-intro">{document.name} · revision {document.revision}. Named checkpoints persist in SQLite; restoring creates a recovery checkpoint first.</p>
    {error && <p className="platform-notice" role="alert">{error} <button onClick={() => setGeneration(value => value + 1)}>Retry</button></p>}
    <form className="version-form" onSubmit={create}>
      <label htmlFor="version-label">Checkpoint name</label>
      <input id="version-label" placeholder="e.g. Ready for review" value={label} maxLength={100} disabled={busy} onChange={event => setLabel(event.target.value)} />
      <button type="submit" className="nav-action-btn btn-primary" disabled={busy || !label.trim()}>Save version</button>
    </form>
    {loading ? <p role="status">Loading versions...</p> : versions.length ? <div className="version-list">
      {versions.map(version => <article className="platform-card" key={version.id}>
        <div className="platform-card-heading"><h3>{version.label}</h3>
          <button className="nav-action-btn btn-secondary" disabled={busy} onClick={() => void restore(version)}>Restore</button></div>
        <p className="platform-meta">Revision {version.revision} · {new Date(version.created_at).toLocaleString()} · {version.name}</p>
      </article>)}
    </div> : <p className="platform-intro">No named versions yet. Save a checkpoint before making major changes.</p>}
  </PlatformDialog>;
}
