import React, { useCallback, useEffect, useState } from 'react';

interface CounterData {
  count: number;
  updated_at: string;
}

export const CounterWidget: React.FC = () => {
  const [count, setCount] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const fetchCounter = useCallback(async () => {
    try {
      const res = await fetch('/api/counter');
      if (res.ok) {
        const data: CounterData = await res.json();
        setCount(data.count);
        setUpdatedAt(data.updated_at);
      }
    } catch {
      // Backend maybe loading
    }
  }, []);

  useEffect(() => {
    fetchCounter();
  }, [fetchCounter]);

  const handleRecordClick = async () => {
    setIsPending(true);
    try {
      const res = await fetch('/api/counter/click', { method: 'POST' });
      if (res.ok) {
        const data: CounterData = await res.json();
        setCount(data.count);
        setUpdatedAt(data.updated_at);
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleClearCount = async () => {
    setIsPending(true);
    try {
      const res = await fetch('/api/counter', { method: 'DELETE' });
      if (res.ok) {
        const data: CounterData = await res.json();
        setCount(data.count);
        setUpdatedAt(data.updated_at);
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className={`counter-floating-widget ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="counter-card">
        <div className="counter-widget-header">
          <div className="eyebrow">
            <span className="status-dot"></span>
            <span>PERSISTENT SYNC</span>
          </div>
          <button
            className="collapse-toggle-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand Counter' : 'Minimize Counter'}
          >
            {isCollapsed ? '▲' : '▼'}
          </button>
        </div>

        <h1>Persistent click counter</h1>

        <div className="count-panel">
          <div className="count-label">Recorded clicks</div>
          <div className="count-value">{count ?? 0}</div>
          <div className="updated-time">
            {updatedAt ? `Last updated: ${new Date(updatedAt).toLocaleTimeString()}` : 'Ready'}
          </div>
        </div>

        <div className="counter-actions">
          <button
            className="click-button"
            disabled={isPending}
            onClick={handleRecordClick}
          >
            Record a click
          </button>
          <button
            className="clear-button"
            disabled={isPending || (count ?? 0) === 0}
            onClick={handleClearCount}
          >
            Clear count
          </button>
        </div>
      </div>
    </div>
  );
};
