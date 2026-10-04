import { useEffect } from "react";

type ToastProps = {
  /** Pusty / null = toast ukryty */
  message: string | null;
  onClose: () => void;
};

/**
 * Krótkie potwierdzenie akcji w rogu ekranu. Region `role="status"` jest stale w DOM,
 * żeby czytnik ekranu ogłosił pojawiającą się treść. Bez auto-ukrywania (WCAG 2.2.1):
 * znika po „Zamknij”, Escape albo gdy zastąpi go kolejny komunikat.
 */
export function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    function onKeyDown(event: KeyboardEvent) {
      // otwarty <dialog> obsługuje Escape sam — nie zamykamy wtedy toasta
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
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
