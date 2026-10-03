import Head from "next/head";

import { LoginForm } from "@/components/LoginForm";
import { HeaderRegisterLink, SiteHeader } from "@/components/SiteHeader";

export default function LoginPage() {
  return (
    <>
      <Head>
        <title>Zaloguj się · MaloHUB</title>
      </Head>
      <div className="flex min-h-screen flex-col">
        <SiteHeader actions={<HeaderRegisterLink />} />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 py-12">
          <LoginForm />
        </main>
      </div>
    </>
  );
}
