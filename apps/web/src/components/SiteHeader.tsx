import type { ReactNode } from "react";

import { BrandLogo } from "@/components/BrandLogo";

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
 * Menu: zwykle `AppNav` (desktop + hamburger); na auth może być `GuestHeaderActions`.
 */
export function SiteHeader({
  actions,
  width = "full",
  logoSize = "lg",
}: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className={`site-header-inner mx-auto w-full ${WIDTH[width]}`}>
        <BrandLogo size={logoSize} />
        <div className="site-header-nav">{actions}</div>
      </div>
    </header>
  );
}

export { AppNav, LoggedInMenu, ProductHeaderActions } from "@/components/AppNav";
export type { AppNavPage } from "@/components/AppNav";
export { UserMenu } from "@/components/UserMenu";
export {
  caretakerHref,
  GuestHeaderActions,
  HeaderLoginLink,
  HeaderRegisterLink,
} from "@/components/HeaderAuthLinks";
