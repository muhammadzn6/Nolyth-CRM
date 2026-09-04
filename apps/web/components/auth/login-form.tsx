"use client";

import { useState, type FormEvent } from "react";

import { Button, Field, Input } from "@orbit/ui";
import { ApiClientError, login } from "../../lib/api-client";

export function LoginForm() {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      await login({ email: String(data.get("email") ?? ""), password: String(data.get("password") ?? "") });
      window.location.assign("/");
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Orbit could not sign you in. Try again.");
      setPending(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <Field htmlFor="email" label="Work email">
        <Input autoComplete="email" id="email" name="email" placeholder="you@company.com" required type="email" />
      </Field>
      <Field htmlFor="password" label="Password" hint="Case sensitive">
        <Input autoComplete="current-password" id="password" minLength={1} name="password" placeholder="Enter your password" required type="password" />
      </Field>
      {error ? <p className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger" role="alert">{error}</p> : null}
      <Button className="mt-1 w-full" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in to Orbit"}
      </Button>
      <a className="text-center text-xs font-semibold text-primary hover:underline" href="/reset-password">Forgot your password?</a>
      <p className="text-center text-xs leading-5 text-muted-foreground">Access is managed by your Orbit administrator.</p>
    </form>
  );
}
