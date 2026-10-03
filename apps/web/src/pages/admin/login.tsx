import Head from "next/head";

import { AdminLoginForm } from "@/components/AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <>
      <Head>
        <title>Admin login · HubMI</title>
      </Head>
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-12">
        <AdminLoginForm />
      </main>
    </>
  );
}
