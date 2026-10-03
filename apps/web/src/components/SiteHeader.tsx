import type { ReactNode } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { GuestHeaderActions } from "@/components/HeaderAuthLinks";

type SiteHeaderWidth = "default" | "wide" | "full";

type SiteHeaderProps = {
  actions?: ReactNode;
  /** Szerokość kontenera — auth / LP */
  width?: SiteHeaderWidth;
  logoSize?: "sm" | "md" | "lg";
};

const WIDTH: Record<SiteHeaderWidth, string> = {
  default: "max-w-3xl",
  wide: "max-w-5xl",
  full: "max-w-7xl",
};

/**
 * Wspólny pasek nawigacji MaloHUB — ten sam układ na LP, auth i w aplikacji.
 */
export function SiteHeader({
  actions,
  width = "default",
  logoSize = "md",
}: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div
        className={`mx-auto flex w-full items-center justify-between gap-3 px-6 py-4 sm:px-10 ${WIDTH[width]}`}
      >
        <BrandLogo size={logoSize} />
        <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Główne">
          {actions}
        </nav>
      </div>
    </header>
  );
}

export { GuestHeaderActions, HeaderLoginLink, HeaderRegisterLink } from "@/components/HeaderAuthLinks";
