import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login/login-form";
import { auth } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const session = await auth();
  if (typeof session?.user?.id === "string") {
    redirect("/");
  }

  const { callbackUrl } = await searchParams;

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4">
      <LoginForm callbackUrl={safeCallbackUrl(callbackUrl)} />
    </div>
  );
}
