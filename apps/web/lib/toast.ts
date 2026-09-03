export type ToastKind = 'success' | 'error';

export function toast(message: string, kind: ToastKind = 'success') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('spheric:toast', { detail: { message, kind } }));
}

/** Wrap an async action so failures surface as a toast instead of vanishing silently. */
export function withFeedback(action: () => Promise<unknown>, opts?: { successMessage?: string; reload?: () => void }) {
  return async () => {
    try {
      await action();
      if (opts?.successMessage) toast(opts.successMessage, 'success');
      opts?.reload?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  };
}
