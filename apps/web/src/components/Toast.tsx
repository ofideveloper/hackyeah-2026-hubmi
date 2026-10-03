import { useEffect } from "react";

const TOAST_MS = 6000;

type ToastProps = {
  /** Pusty / null = toast ukryty */
  message: string | null;
  onClose: () => void;
};

/**
 * Krótkie potwierdzenie akcji w rogu ekranu. Region `role="status"` jest stale w DOM,
 * żeby czytnik ekranu ogłosił pojawiającą się treść.
 */
export function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message && (
        <div className="toast animate-fade-up">
          <p>{message}</p>
          <button type="button" className="toast-close" onClick={onClose} aria-label="Zamknij powiadomienie">
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}
    </div>
  );
}
