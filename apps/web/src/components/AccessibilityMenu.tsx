import { useEffect, useId, useRef, useState } from "react";

import { useA11yPrefs } from "@/hooks/useA11yPrefs";
import { TEXT_SIZE_LABELS, TEXT_SIZES, type TextSize } from "@/lib/a11yPrefs";

/**
 * Menu dostępności — rozmiar tekstu i tryb wysokiego kontrastu.
 * Wzorzec disclosure (`aria-expanded` + panel), jak `UserMenu`.
 */
export function AccessibilityMenu() {
  const menuId = useId();
  const titleId = useId();
  const textGroupId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const { textSize, highContrast, setTextSize, setHighContrast, resetPrefs } = useA11yPrefs();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    function onFocusIn(event: FocusEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  return (
    <div className="a11y-menu" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="a11y-menu-trigger"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Ustawienia dostępności"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="a11y-menu-trigger-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" focusable="false">
            <circle cx="12" cy="4.5" r="2.25" stroke="currentColor" strokeWidth="1.75" />
            <path
              d="M6.5 10.5h11M12 10.5v9M8.5 19.5h7M9 10.5 7 15.5M15 10.5l2 5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open && (
        <div id={menuId} className="a11y-menu-dropdown" role="region" aria-labelledby={titleId}>
          <p id={titleId} className="a11y-menu-title">
            Dostępność
          </p>

          <fieldset className="a11y-menu-fieldset">
            <legend id={textGroupId} className="a11y-menu-legend">
              Wielkość tekstu
            </legend>
            <div className="a11y-menu-size-row" role="group" aria-labelledby={textGroupId}>
              {TEXT_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={
                    textSize === size
                      ? "a11y-menu-size-btn a11y-menu-size-btn-active"
                      : "a11y-menu-size-btn"
                  }
                  aria-pressed={textSize === size}
                  onClick={() => setTextSize(size as TextSize)}
                >
                  <span className={`a11y-menu-size-label a11y-menu-size-label-${size}`}>
                    {TEXT_SIZE_LABELS[size]}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="a11y-menu-row">
            <label className="a11y-menu-toggle" htmlFor={`${menuId}-contrast`}>
              <span className="a11y-menu-toggle-text">Wysoki kontrast</span>
              <input
                id={`${menuId}-contrast`}
                type="checkbox"
                className="a11y-menu-checkbox"
                checked={highContrast}
                onChange={(event) => setHighContrast(event.target.checked)}
              />
            </label>
          </div>

          <button
            type="button"
            className="a11y-menu-reset"
            onClick={() => {
              resetPrefs();
            }}
          >
            Przywróć domyślne
          </button>
        </div>
      )}
    </div>
  );
}
