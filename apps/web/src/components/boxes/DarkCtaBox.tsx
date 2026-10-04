import Link from "next/link";
import type { ReactNode } from "react";

export type DarkCtaAction = {
  href: string;
  label: string;
  /** Domyślnie `true`. */
  showArrow?: boolean;
};

export type DarkCtaBoxProps = {
  title: string;
  description: string;
  action: DarkCtaAction;
  children?: ReactNode;
  className?: string;
  /** Domyślnie `div`. Na końcu strony wiedzy używamy `aside`. */
  as?: "div" | "aside";
};

/** Tło jak `SiteHeader` (`--header-bg`); tekst ciemny — biały nie spełnia WCAG na tym kolorze. */
const shellClassName =
  "rounded-2xl bg-[var(--header-bg)] px-6 py-7 text-[var(--text)] sm:px-8";

/** Jak CTA w `SiteHeader` (`btn-primary`). */
const actionClassName = "btn-primary shrink-0 gap-2";

export function DarkCtaBox({
  title,
  description,
  action,
  children,
  className,
  as = "div",
}: DarkCtaBoxProps) {
  const Tag = as;
  const showArrow = action.showArrow !== false;

  return (
    <Tag className={[shellClassName, className].filter(Boolean).join(" ")}>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <p className="mt-1.5 text-sm text-[var(--text)]/75">{description}</p>
        </div>
        <Link href={action.href} className={actionClassName}>
          {action.label}
          {showArrow ? <span aria-hidden="true">→</span> : null}
        </Link>
      </div>
      {children}
    </Tag>
  );
}

export type DarkCtaLinkCardProps = {
  href: string;
  title: string;
  description: string;
};

export function DarkCtaLinkCard({
  href,
  title,
  description,
}: DarkCtaLinkCardProps) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-xl border border-[var(--text)]/10 bg-white/35 px-4 py-4 transition hover:border-[var(--text)]/20 hover:bg-white/55"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="font-semibold leading-snug">{title}</span>
        <span
          className="translate-x-0 text-[var(--accent-hover)] opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100"
          aria-hidden="true"
        >
          →
        </span>
      </span>
      <span className="mt-2 text-sm leading-6 text-[var(--text)]/70">
        {description}
      </span>
    </Link>
  );
}
