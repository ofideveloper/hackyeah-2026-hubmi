import Link from "next/link";

type LinkClassProps = {
  className?: string;
};

/** „Zaloguj się” — biały outline na tle site-header */
export function HeaderLoginLink({ className = "" }: LinkClassProps) {
  return (
    <Link href="/login" className={`btn-header-outline ${className}`.trim()}>
      Zaloguj się
    </Link>
  );
}

/** „Załóż konto” — primary w headerze */
export function HeaderRegisterLink({ className = "" }: LinkClassProps) {
  return (
    <Link href="/register" className={`btn-primary ${className}`.trim()}>
      Załóż konto
    </Link>
  );
}

/** Para akcji gościa: login + rejestracja */
export function GuestHeaderActions() {
  return (
    <>
      <HeaderLoginLink />
      <HeaderRegisterLink />
    </>
  );
}
