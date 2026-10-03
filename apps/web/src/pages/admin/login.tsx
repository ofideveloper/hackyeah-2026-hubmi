import { useEffect } from "react";
import { useRouter } from "next/router";

/** Stary URL — przekierowanie na logowanie użytkownika. */
export default function AdminLoginRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    void router.replace("/login");
  }, [router]);

  return null;
}
