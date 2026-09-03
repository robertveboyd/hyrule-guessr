import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ExclusiveSessionGate } from "@/components/auth/exclusive-session-gate";
import { auth } from "@/lib/auth";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (typeof session?.user?.id !== "string") {
    redirect("/login");
  }

  return <ExclusiveSessionGate>{children}</ExclusiveSessionGate>;
}
