"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";

import { Button, Field, Input } from "@orbit/ui";
import type { UpdateUser, UserRole, UserSummary } from "@orbit/contracts";
import { Dialog } from "../ui/dialog";

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
  const [editOpen, setEditOpen] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await onSave(user.id, {
      displayName: String(data.get("displayName") ?? ""),
      role: String(data.get("role") ?? user.role) as UserRole,
      timezone: String(data.get("timezone") ?? ""),
    });
    setEditOpen(false);
  }

  return (
    <article className="flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-primary/5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-bold text-foreground">{user.displayName}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${user.isActive ? "bg-success-soft text-success" : "bg-surface-subtle text-muted-foreground"}`}>{user.isActive ? "Active" : "Inactive"}</span></div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs sm:grid-cols-3"><div><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Role</dt><dd className="mt-1 font-semibold text-foreground">{user.role === "BD" ? "Business development" : user.role === "CLOSER" ? "Closer" : "Administrator"}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Timezone</dt><dd className="mt-1 font-semibold text-foreground">{user.timezone}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Last login</dt><dd className="mt-1 font-semibold text-foreground">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}</dd></div></dl>
      <div className="flex flex-wrap gap-2 lg:justify-end"><Button aria-label={`Edit ${user.displayName}`} disabled={pending} onClick={() => setEditOpen(true)} variant="secondary">Edit</Button><Button aria-label={`${user.isActive ? "Deactivate" : "Activate"} ${user.displayName}`} disabled={pending} onClick={() => void onToggleActive(user)} variant={user.isActive ? "danger" : "primary"}>{user.isActive ? "Deactivate" : "Activate"}</Button><Button aria-label={`Revoke sessions for ${user.displayName}`} disabled={pending} onClick={() => void onRevokeSessions(user)} variant="ghost">Revoke sessions</Button>{!user.lastLoginAt ? <Button aria-label={`Resend invitation for ${user.displayName}`} disabled={pending} onClick={() => void onResendInvitation(user)} variant="ghost">Resend invitation</Button> : null}</div>
      <Dialog description={`Update role and workspace defaults for ${user.email}.`} onOpenChange={setEditOpen} open={editOpen} title={`Edit ${user.displayName}`}>
    <form
      aria-label={`Edit ${user.displayName}`}
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={handleSubmit}
    >
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
      <div className="flex justify-end sm:col-span-2">
        <Button disabled={pending} type="submit">
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
      </Dialog>
    </article>
  );
}
