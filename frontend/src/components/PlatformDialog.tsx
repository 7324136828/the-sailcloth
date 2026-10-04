import { useEffect, useId, useRef, type ReactNode } from 'react';

interface PlatformDialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function PlatformDialog({ title, onClose, children, wide = false }: PlatformDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current!;
    dialog.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary')]
        .filter(element => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); return; }
      const outside = !dialog.contains(document.activeElement) || document.activeElement === dialog;
      if (event.shiftKey && (document.activeElement === first || outside)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || outside)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      previous?.focus();
    };
  }, []);

  return (
    <div className="modal-overlay" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`modal-card platform-dialog ${wide ? 'platform-dialog-wide' : ''}`} role="dialog"
        aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialogRef}>
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close dialog">×</button>
        </div>
        <div className="platform-dialog-body">{children}</div>
      </div>
    </div>
  );
}
