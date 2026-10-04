import type { ReactNode } from "react";

const titleClassName =
  "font-display mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl";

export type SiteTitleProps = {
  children: ReactNode;
  className?: string;
};

/** H1 podstron produktowych (nie landing hero, nie admin). */
export function SiteTitle({ children, className }: SiteTitleProps) {
  return (
    <h1 className={[titleClassName, className].filter(Boolean).join(" ")}>
      {children}
    </h1>
  );
}

/** Fragment tytułu w kolorze akcentu (kontrast WCAG na tle strony). */
export function SiteTitleAccent({ children }: { children: ReactNode }) {
  return <span className="text-[var(--accent-text)]">{children}</span>;
}
