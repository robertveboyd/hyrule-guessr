import { LoginForm } from "@/components/login/login-form";
import { RedirectIfActiveTab } from "@/components/login/redirect-if-active-tab";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4">
      <RedirectIfActiveTab />
      <LoginForm callbackUrl={safeCallbackUrl(callbackUrl)} />
    </div>
  );
}
