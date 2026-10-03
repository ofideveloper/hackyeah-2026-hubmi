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

/** Para akcji gościa na LP / auth — bez menu produktowego */
export function GuestHeaderActions() {
  return (
    <>
      <HeaderLoginLink />
      <HeaderRegisterLink />
    </>
  );
}

/** Link do czatu opiekuna — zalogowany → `/app`, gość → landing `#opiekun`. */
export function caretakerHref(loggedIn: boolean): string {
  return loggedIn ? "/app" : "/#opiekun";
}
