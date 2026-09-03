'use client';
import { useEffect, useState } from 'react';
import type { ToastKind } from '../lib/toast';

type Toast = { id: number; message: string; kind: ToastKind };
let nextId = 1;

export default function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    function onToast(e: Event) {
      const { message, kind } = (e as CustomEvent).detail as { message: string; kind: ToastKind };
      const id = nextId++;
      setToasts((t) => [...t, { id, message, kind }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
    }
    window.addEventListener('spheric:toast', onToast);
    return () => window.removeEventListener('spheric:toast', onToast);
  }, []);
  if (!toasts.length) return null;
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.message}
          <button aria-label="Dismiss" className="toast-close" onClick={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))}>×</button>
        </div>
      ))}
    </div>
  );
}
