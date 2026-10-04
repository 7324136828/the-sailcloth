import { useEffect, useState } from 'react';
import { fetchRequirements, fetchRequirementTopics } from '../api';
import type { RequirementsSummary, RequirementTopics } from '../types';
import { PlatformDialog } from './PlatformDialog';

export function RequirementsPanel({ onClose }: { onClose: () => void }) {
  const [summary, setSummary] = useState<RequirementsSummary | null>(null);
  const [topics, setTopics] = useState<RequirementTopics | null>(null);
  const [tab, setTab] = useState<'capabilities' | 'topics' | 'phases'>('capabilities');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [phase, setPhase] = useState('');
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError('');
    fetchRequirements().then(result => { if (active) setSummary(result); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load requirements.'); });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    const controller = new AbortController();
    setTopics(null);
    const timer = window.setTimeout(() => {
      fetchRequirementTopics({ query, source, phase: phase ? Number(phase) : undefined, offset }, controller.signal)
        .then(result => { if (!controller.signal.aborted) setTopics(result); })
        .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load topics.'); });
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, source, phase, offset, attempt]);

  const capabilities = summary?.capabilities.filter(capability =>
    (!phase || capability.phase === Number(phase)) &&
    `${capability.title} ${capability.scope}`.toLowerCase().includes(query.toLowerCase())) ?? [];

  return (
    <PlatformDialog title="Requirements & delivery" onClose={onClose} wide>
      {error && <div className="platform-notice" role="alert">{error} <button onClick={() => setAttempt(value => value + 1)}>Retry</button></div>}
      {!summary && !error && <p role="status">Reading the downloaded requirement snapshots...</p>}
      {summary && <>
        <p className="platform-intro">{summary.coverage_note}</p>
        <div className="platform-stats">
          <div><strong>{summary.topic_count}</strong><span>captured topics</span></div>
          <div><strong>{summary.capabilities.filter(item => item.status === 'implemented').length}</strong><span>implemented foundation capabilities</span></div>
          <div><strong>{summary.capabilities.filter(item => item.status === 'partial').length}</strong><span>partially implemented groups</span></div>
          <div><strong>{summary.sources.filter(item => item.status !== 'snapshot').length}</strong><span>missing or limited sources</span></div>
        </div>
        <div className="platform-tabs" aria-label="Requirements sections">
          <button aria-pressed={tab === 'capabilities'} onClick={() => setTab('capabilities')}>Capabilities</button>
          <button aria-pressed={tab === 'topics'} onClick={() => setTab('topics')}>Sources & topics</button>
          <button aria-pressed={tab === 'phases'} onClick={() => setTab('phases')}>Delivery phases</button>
        </div>
        {tab !== 'phases' && <div className="platform-filters">
          <input aria-label="Search requirements" placeholder="Search titles, outlines, or capabilities" maxLength={200} value={query}
            onChange={event => { setQuery(event.target.value); setOffset(0); }} />
          {tab === 'topics' && <select aria-label="Requirement source" value={source} onChange={event => { setSource(event.target.value); setOffset(0); }}>
            <option value="">All sources</option>
            {summary.sources.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>}
          <select aria-label="Delivery phase" value={phase} onChange={event => { setPhase(event.target.value); setOffset(0); }}>
            <option value="">All phases</option>
            {summary.phases.map(item => <option key={item.id} value={item.id}>Phase {item.id}</option>)}
          </select>
        </div>}
        {tab === 'capabilities' && <div className="capability-list">
          {capabilities.map(item => <article className="platform-card" key={item.id}>
            <div className="platform-card-heading"><h3>{item.title}</h3><span className={`coverage-status coverage-${item.status}`}>{item.status}</span></div>
            <p>{item.scope}</p>
            <div className="platform-meta">Phase {item.phase} · {item.source_topic_ids.length} related captured topics</div>
            {item.evidence && <details><summary>Verification evidence</summary><code>{item.evidence}</code></details>}
          </article>)}
          {!capabilities.length && <p>No capabilities match these filters.</p>}
        </div>}
        {tab === 'phases' && <div className="phase-list">
          {summary.phases.map(item => <article className="platform-card" key={item.id}>
            <div className="platform-card-heading"><h3>Phase {item.id}: {item.title}</h3><span className="coverage-status">{item.status.replaceAll('_', ' ')}</span></div>
            <p>{item.scope}</p><p className="platform-meta"><strong>Acceptance gate:</strong> {item.gate}</p>
            <p className="platform-meta">Dependencies: {item.dependencies.length ? item.dependencies.map(id => `Phase ${id}`).join(', ') : 'None'}</p>
          </article>)}
        </div>}
        {tab === 'topics' && <>
          <div className="requirement-sources">
            {summary.sources.map(item => <article className="platform-card source-card" key={item.id}>
              <div className="platform-card-heading"><h3>{item.name}</h3><span className={`coverage-status coverage-${item.status}`}>{item.status.replaceAll('_', ' ')}</span></div>
              <p>{item.topic_count} captured topics</p>
              {item.issues.length > 0 && <details><summary>{item.issues.length} source issue{item.issues.length === 1 ? '' : 's'}</summary>
                <ul>{item.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></details>}
            </article>)}
          </div>
          <p className="platform-intro">All {summary.unreviewed_count} captured topics need a granular acceptance-criteria review. Suggested phases do not mean a source feature is implemented.</p>
          {!topics ? <p role="status">Loading topics...</p> : <>
            <p className="platform-meta">{topics.total} matching topics</p>
            <div className="topic-list">
              {topics.items.map(item => <details className="platform-card" key={item.id}>
                <summary>{item.title}<span className="platform-meta">{item.source} · suggested phase {item.phase} · needs review</span></summary>
                <p className="platform-meta">Snapshot: <code>{item.local_path}</code></p>
                <a href={item.url} target="_blank" rel="noopener noreferrer">Open original source</a>
                {item.outline.length ? <ul className="topic-outline">{item.outline.map((heading, index) =>
                  <li key={index} style={{ marginLeft: `${Math.max(0, heading.level - 1) * 12}px` }}>{heading.text}</li>)}</ul>
                  : <p className="platform-meta">No detailed outline was captured.</p>}
              </details>)}
            </div>
            <div className="platform-pagination">
              <button disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 30))}>Previous</button>
              <span>{topics.total ? offset + 1 : 0}–{Math.min(offset + 30, topics.total)} of {topics.total}</span>
              <button disabled={offset + 30 >= topics.total} onClick={() => setOffset(value => value + 30)}>Next</button>
            </div>
          </>}
        </>}
      </>}
    </PlatformDialog>
  );
}
