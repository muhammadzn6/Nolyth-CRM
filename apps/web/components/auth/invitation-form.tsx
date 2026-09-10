"use client";

import { type FormEvent, useState } from "react";

import { Button, Field, Input } from "@orbit/ui";

import { acceptInvitation, ApiClientError } from "../../lib/api-client";

type FieldErrors = {
  token?: string;
  password?: string;
  confirmPassword?: string;
};

function invitationError(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : "";
  if (
    (reason instanceof ApiClientError && (reason.status === 401 || reason.code === "UNAUTHENTICATED")) ||
    /invalid invitation token/i.test(message)
  ) {
    return "Invitation expired or already used. Ask your Orbit administrator for a new invitation link.";
  }
  return reason instanceof ApiClientError
    ? reason.message
    : "Orbit could not accept this invitation. Try again.";
}

export function InvitationForm({ token }: { token: string }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");
    const nextErrors: FieldErrors = {};

    if (!token.trim()) nextErrors.token = "Invitation link is invalid";
    if (password.length < 12) nextErrors.password = "Use at least 12 characters";
    if (password !== confirmPassword) nextErrors.confirmPassword = "Passwords must match";

    setErrors(nextErrors);
    setFormError(undefined);

    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    try {
      await acceptInvitation({ token, password });
      setSuccess(true);
      window.location.assign("/login");
    } catch (reason) {
      setFormError(invitationError(reason));
    } finally {
      setPending(false);
    }
  }

  return (
    <form aria-label="Accept invitation" className="grid gap-5" onSubmit={handleSubmit}>
      <Field error={errors.password} hint="Minimum 12 characters" htmlFor="password" label="Create password">
        <Input
          aria-describedby={errors.password ? "password-error" : undefined}
          autoComplete="new-password"
          id="password"
          minLength={12}
          name="password"
          required
          type="password"
        />
      </Field>
      <Field error={errors.confirmPassword} htmlFor="confirmPassword" label="Confirm password">
        <Input
          aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
          autoComplete="new-password"
          id="confirmPassword"
          minLength={12}
          name="confirmPassword"
          required
          type="password"
        />
      </Field>
      {errors.token ? <p className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger" role="alert">{errors.token}</p> : null}
      {formError ? <p className="rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-3 text-sm font-medium text-warning-foreground" role="alert">{formError}</p> : null}
      {success ? <p className="rounded-xl border border-success/20 bg-success-soft px-3.5 py-3 text-sm font-medium text-success" role="status">Password created. Redirecting to sign in…</p> : null}
      <Button disabled={pending} loading={pending} type="submit">
        {pending ? "Creating password…" : "Create password"}
      </Button>
    </form>
  );
}
