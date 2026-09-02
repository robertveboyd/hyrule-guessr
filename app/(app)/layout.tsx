import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (typeof session?.user?.id !== "string") {
    redirect("/login");
  }

  return children;
}
