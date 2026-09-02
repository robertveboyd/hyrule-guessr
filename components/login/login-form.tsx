"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  authenticate,
  type SignInState,
} from "@/lib/auth/actions/sign-in";
import { type SignInValues } from "@/lib/auth/schema";
import { updateField } from "@/lib/forms/update-field";

const initialState: SignInState = { message: null };

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState(
    authenticate,
    initialState,
  );
  const [fields, setFields] = useState<SignInValues>({
    email: "",
    password: "",
  });

  return (
    <form action={formAction} noValidate className="w-full max-w-sm">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-3xl font-normal">
            Hyrule Guessr
          </CardTitle>
          <CardDescription>Sign in to play</CardDescription>
        </CardHeader>
        <CardContent>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <FieldGroup>
            <Field data-invalid={!!state.errors?.email || undefined}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={fields.email}
                onChange={updateField(setFields, "email")}
                aria-invalid={!!state.errors?.email || undefined}
              />
              <FieldError>{state.errors?.email?.[0]}</FieldError>
            </Field>
            <Field data-invalid={!!state.errors?.password || undefined}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={fields.password}
                onChange={updateField(setFields, "password")}
                aria-invalid={!!state.errors?.password || undefined}
              />
              <FieldError>{state.errors?.password?.[0]}</FieldError>
            </Field>
            {state.message ? <FieldError>{state.message}</FieldError> : null}
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
