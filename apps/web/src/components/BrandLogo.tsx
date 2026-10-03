import Link from "next/link";

type BrandLogoSize = "sm" | "md" | "lg";

const SIZE: Record<
  BrandLogoSize,
  { className: string; width: number; height: number }
> = {
  sm: { className: "h-9 w-auto", width: 200, height: 44 },
  md: { className: "h-11 w-auto sm:h-12", width: 240, height: 52 },
  lg: { className: "h-12 w-auto sm:h-14", width: 280, height: 60 },
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
  const dim = SIZE[size];
  const mark = (
    <span className="brand-logo-mark">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/malohub-logo.png"
        alt="MaloHUB"
        className={dim.className}
        width={dim.width}
        height={dim.height}
      />
    </span>
  );

  if (href == null) {
    return <span className={`inline-flex items-center ${className}`.trim()}>{mark}</span>;
  }

  return (
    <Link
      href={href}
      className={`inline-flex items-center transition-opacity hover:opacity-80 ${className}`.trim()}
      aria-label={label}
    >
      {mark}
    </Link>
  );
}
