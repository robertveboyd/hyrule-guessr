import { notFound } from "next/navigation";

import { MatchPage } from "@/components/match/match-page";
import { auth } from "@/lib/auth";
import { SESSION_ID_RE } from "@/lib/auth/session-id";

export default async function MatchRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!SESSION_ID_RE.test(id)) notFound();
  const session = await auth();
  if (typeof session?.user?.id !== "string") notFound();
  return <MatchPage matchId={id} userId={session.user.id} />;
}
