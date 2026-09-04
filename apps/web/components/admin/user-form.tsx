"use client";

import { type ChangeEvent, type FormEvent } from "react";

import { Button, Field, Input } from "@orbit/ui";
import type { UpdateUser, UserRole, UserSummary } from "@orbit/contracts";

const roles: UserRole[] = ["ADMIN", "BD", "CLOSER"];

function selectClassName() {
  return "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm font-semibold text-foreground outline-none transition hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-focus/15 disabled:cursor-not-allowed disabled:bg-surface-subtle motion-reduce:transition-none";
}

export function RoleSelect({
  id,
  name,
  value,
  defaultValue,
  disabled,
  onChange,
}: {
  id: string;
  name: string;
  value?: UserRole;
  defaultValue?: UserRole;
  disabled?: boolean;
  onChange?: (value: UserRole) => void;
}) {
  const controlProps = onChange
    ? { onChange: (event: ChangeEvent<HTMLSelectElement>) => onChange(event.currentTarget.value as UserRole), value }
    : { defaultValue };

  return (
    <select
      className={selectClassName()}
      disabled={disabled}
      id={id}
      name={name}
      {...controlProps}
    >
      {roles.map((role) => (
        <option key={role} value={role}>
          {role === "BD" ? "Business development" : role === "CLOSER" ? "Closer" : "Administrator"}
        </option>
      ))}
    </select>
  );
}

export function UserForm({
  user,
  pending,
  onSave,
  onToggleActive,
  onRevokeSessions,
  onResendInvitation,
}: {
  user: UserSummary;
  pending?: boolean;
  onSave: (userId: string, input: UpdateUser) => Promise<void>;
  onToggleActive: (user: UserSummary) => Promise<void>;
  onRevokeSessions: (user: UserSummary) => Promise<void>;
  onResendInvitation: (user: UserSummary) => Promise<void>;
}) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await onSave(user.id, {
      displayName: String(data.get("displayName") ?? ""),
      role: String(data.get("role") ?? user.role) as UserRole,
      timezone: String(data.get("timezone") ?? ""),
    });
  }

  return (
    <form
      aria-label={`Edit ${user.displayName}`}
      className="grid gap-4 rounded-xl border border-border/80 bg-surface p-4 shadow-[0_1px_2px_rgba(32,43,61,0.025)] lg:grid-cols-[minmax(190px,1fr)_minmax(150px,0.65fr)_minmax(150px,0.65fr)_auto] lg:items-end"
      onSubmit={handleSubmit}
    >
      <div className="lg:col-span-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-foreground">{user.displayName}</h3>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.isActive ? "bg-success-soft text-success" : "bg-surface-subtle text-muted-foreground"}`}>
            {user.isActive ? "Active" : "Inactive"}
          </span>
          <span className="text-xs text-muted-foreground">{user.email}</span>
          <span className="text-xs text-muted-foreground">Timezone: {user.timezone}</span>
          <span className="text-xs text-muted-foreground">Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</span>
        </div>
      </div>
      <Field htmlFor={`displayName-${user.id}`} label="Name">
        <Input
          autoComplete="name"
          defaultValue={user.displayName}
          disabled={pending}
          id={`displayName-${user.id}`}
          key={`displayName-${user.displayName}`}
          name="displayName"
          required
        />
      </Field>
      <Field htmlFor={`role-${user.id}`} label="Role">
        <RoleSelect
          defaultValue={user.role}
          disabled={pending}
          id={`role-${user.id}`}
          key={`role-${user.role}`}
          name="role"
        />
      </Field>
      <Field htmlFor={`timezone-${user.id}`} label="Timezone">
        <Input
          defaultValue={user.timezone}
          disabled={pending}
          id={`timezone-${user.id}`}
          key={`timezone-${user.timezone}`}
          name="timezone"
          required
        />
      </Field>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Button disabled={pending} type="submit" variant="secondary">
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button
          aria-label={`${user.isActive ? "Deactivate" : "Activate"} ${user.displayName}`}
          disabled={pending}
          onClick={() => void onToggleActive(user)}
          variant={user.isActive ? "danger" : "primary"}
        >
          {user.isActive ? "Deactivate" : "Activate"}
        </Button>
        <Button
          aria-label={`Revoke sessions for ${user.displayName}`}
          disabled={pending}
          onClick={() => void onRevokeSessions(user)}
          variant="ghost"
        >
          Revoke sessions
        </Button>
        {!user.lastLoginAt ? <Button aria-label={`Resend invitation for ${user.displayName}`} disabled={pending} onClick={() => void onResendInvitation(user)} variant="ghost">Resend invitation</Button> : null}
      </div>
    </form>
  );
}
