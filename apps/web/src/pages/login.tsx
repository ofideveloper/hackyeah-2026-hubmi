import Head from "next/head";

import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <>
      <Head>
        <title>Zaloguj się · HubMI</title>
      </Head>
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-12">
        <LoginForm />
      </main>
    </>
  );
}
