import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions/sign-out";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  );
}