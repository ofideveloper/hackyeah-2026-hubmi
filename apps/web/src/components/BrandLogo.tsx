import Link from "next/link";

type BrandLogoSize = "sm" | "md" | "lg";

/** Native asset: 566×162 — max-height w CSS skaluje, ratio z atrybutów. */
const SIZE: Record<BrandLogoSize, string> = {
  sm: "brand-logo-img brand-logo-img-sm",
  md: "brand-logo-img brand-logo-img-md",
  lg: "brand-logo-img brand-logo-img-lg",
};

type BrandLogoProps = {
  /** `null` = samo logo bez linku */
  href?: string | null;
  size?: BrandLogoSize;
  className?: string;
  /** Nadpisuje domyślne aria-label linku */
  label?: string;
};

export function BrandLogo({
  href = "/",
  size = "md",
  className = "",
  label = "MaloHUB - strona główna",
}: BrandLogoProps) {
  const mark = (
    <span className="brand-logo-mark">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/malohub-logo.png"
        alt="MaloHUB"
        className={SIZE[size]}
        width={566}
        height={162}
      />
    </span>
  );

  if (href == null) {
    return (
      <span className={`brand-logo brand-logo-static ${className}`.trim()}>{mark}</span>
    );
  }

  return (
    <Link
      href={href}
      className={`brand-logo transition-opacity hover:opacity-80 ${className}`.trim()}
      aria-label={label}
    >
      {mark}
    </Link>
  );
}
