import Head from "next/head";

import { AdminPanel } from "@/components/AdminPanel";

export default function AdminPage() {
  return (
    <>
      <Head>
        <title>Admin · HubMI</title>
      </Head>
      <AdminPanel />
    </>
  );
}
