"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { signIn } from "@/lib/auth";
import {
  clearLoginFailures,
  getLoginClientIp,
  isLoginRateLimited,
  recordLoginFailure,
} from "@/lib/auth/rate-limit";
import { rotateSessionId } from "@/lib/auth/rotate-session-id";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";
import { signInSchema } from "@/lib/auth/schema";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const INVALID_CREDENTIALS = "Invalid email or password.";

function signInReturnedError(result: unknown): boolean {
  if (result && typeof result === "object" && "error" in result && result.error) {
    return true;
  }
  if (typeof result !== "string") return false;
  try {
    return new URL(result, "http://n").searchParams.has("error");
  } catch {
    return false;
  }
}

export type SignInState = {
  errors?: {
    email?: string[];
    password?: string[];
  };
  message: string | null;
  sessionId?: string;
  redirectTo?: string;
};

export async function authenticate(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeCallbackUrl(formData.get("callbackUrl"));

  const parsed = signInSchema.safeParse({ email, password });
  if (!parsed.success) {
    return {
      errors: z.flattenError(parsed.error).fieldErrors,
      message: null,
    };
  }

  const ip = await getLoginClientIp();
  if (isLoginRateLimited(parsed.data.email, ip)) {
    return { message: INVALID_CREDENTIALS };
  }

  try {
    const result = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });

    if (signInReturnedError(result)) {
      recordLoginFailure(parsed.data.email, ip);
      return { message: INVALID_CREDENTIALS };
    }
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      recordLoginFailure(parsed.data.email, ip);
      return { message: INVALID_CREDENTIALS };
    }
    if (error instanceof AuthError) {
      return { message: "Something went wrong. Please try again." };
    }
    throw error;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
    columns: { id: true },
  });
  if (!user) {
    return { message: "Something went wrong. Please try again." };
  }

  clearLoginFailures(parsed.data.email, ip);
  const sessionId = await rotateSessionId(user.id);

  return {
    message: null,
    sessionId,
    redirectTo,
  };
}
