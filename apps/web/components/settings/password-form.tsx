"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button, Field, Input } from "@orbit/ui";
import { ApiClientError, changePassword } from "../../lib/api-client";

export function PasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (newPassword !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    setPending(true);
    try {
      await changePassword({ currentPassword: String(form.get("currentPassword") ?? ""), newPassword });
      router.replace("/login?changed=1");
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Orbit could not change your password.");
      setPending(false);
    }
  }

  return (
    <form className="grid max-w-xl gap-5" onSubmit={handleSubmit}>
      <Field htmlFor="currentPassword" label="Current password">
        <Input autoComplete="current-password" id="currentPassword" name="currentPassword" required type="password" />
      </Field>
      <Field htmlFor="newPassword" label="New password" hint="At least 12 characters">
        <Input autoComplete="new-password" id="newPassword" minLength={12} name="newPassword" required type="password" />
      </Field>
      <Field htmlFor="confirmation" label="Confirm new password">
        <Input autoComplete="new-password" id="confirmation" minLength={12} name="confirmation" required type="password" />
      </Field>
      {error ? <p className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger" role="alert">{error}</p> : null}
      <Button className="w-fit" disabled={pending} type="submit">{pending ? "Changing password…" : "Change password"}</Button>
      <p className="text-xs leading-5 text-muted-foreground">For your protection, all active sessions are signed out after a password change.</p>
    </form>
  );
}
