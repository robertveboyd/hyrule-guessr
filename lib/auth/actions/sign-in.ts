"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { z } from "zod";

import { signIn } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";
import { signInSchema } from "@/lib/auth/schema";

export type SignInState = {
  errors?: {
    email?: string[];
    password?: string[];
  };
  message: string | null;
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

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      return { message: "Invalid email or password." };
    }
    if (error instanceof AuthError) {
      return { message: "Something went wrong. Please try again." };
    }
    throw error;
  }

  return { message: "Something went wrong. Please try again." };
}
