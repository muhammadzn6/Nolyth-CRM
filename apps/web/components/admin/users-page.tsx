"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type { CreateUser, SessionUser, UpdateUser, UserRole, UserSummary } from "@orbit/contracts";
import { Button, Card, EmptyState, Field, Input, LoadingState, UnauthorizedState } from "@orbit/ui";

import {
  ApiClientError,
  createUser,
  listUsers,
  revokeUserSessions,
  resendInvitation,
  updateUser,
  type CreateUserResult,
} from "../../lib/api-client";
import { RoleSelect, UserForm } from "./user-form";

type Notice = { tone: "success" | "danger"; message: string };

function getAppOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_BASE_URL;
  if (configured) return new URL(configured).origin;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function invitationUrl(token: string): string {
  return `${getAppOrigin()}/invite/${encodeURIComponent(token)}`;
}

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof ApiClientError ? reason.message : fallback;
}

function CreateUserForm({
  pending,
  onCreate,
}: {
  pending: boolean;
  onCreate: (input: CreateUser) => Promise<CreateUserResult>;
}) {
  const [role, setRole] = useState<UserRole>("BD");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await onCreate({
      displayName: String(data.get("displayName") ?? ""),
      email: String(data.get("email") ?? ""),
      role,
      timezone: String(data.get("timezone") ?? ""),
    });
    form.reset();
    setRole("BD");
  }

  return (
    <Card className="p-5 sm:p-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Invite teammate</p>
        <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] text-foreground">Create user invitation</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Administrators create users, then share a one-time password setup link.</p>
      </header>
      <form aria-label="Create user invitation" className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleSubmit}>
        <Field htmlFor="new-displayName" label="Name">
          <Input autoComplete="name" disabled={pending} id="new-displayName" name="displayName" required />
        </Field>
        <Field htmlFor="new-email" label="Work email">
          <Input autoComplete="email" disabled={pending} id="new-email" name="email" required type="email" />
        </Field>
        <Field htmlFor="new-role" label="Role">
          <RoleSelect disabled={pending} id="new-role" name="role" onChange={setRole} value={role} />
        </Field>
        <Field htmlFor="new-timezone" label="Timezone">
          <Input defaultValue="UTC" disabled={pending} id="new-timezone" name="timezone" required />
        </Field>
        <div className="md:col-span-2 xl:col-span-4">
          <Button disabled={pending} type="submit">
            {pending ? "Creating invitation…" : "Create the first teammate"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function UsersPage({ actor }: { actor: SessionUser }) {
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<Notice>();
  const [pending, setPending] = useState<string>();
  const [createdInvitation, setCreatedInvitation] = useState<{ user: UserSummary; url: string }>();

  const canManageUsers = actor.role === "ADMIN" && actor.isActive;

  const load = useCallback(async () => {
    if (!canManageUsers) return;
    setLoading(true);
    setError(undefined);
    try {
      setUsers(await listUsers());
    } catch (reason) {
      setError(errorMessage(reason, "Orbit could not load users. Try again."));
    } finally {
      setLoading(false);
    }
  }, [canManageUsers]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(() => users?.filter((user) => user.isActive).length ?? 0, [users]);

  async function handleCreate(input: CreateUser) {
    setPending("create");
    setNotice(undefined);
    try {
      const result = await createUser(input);
      setUsers((current) => [result.user, ...(current ?? [])]);
      setCreatedInvitation({ user: result.user, url: invitationUrl(result.invitationToken) });
      setNotice({ tone: "success", message: `Invitation ready for ${result.user.displayName}` });
      return result;
    } catch (reason) {
      const message = errorMessage(reason, "Orbit could not create this user. Try again.");
      setNotice({ tone: "danger", message });
      throw reason;
    } finally {
      setPending(undefined);
    }
  }

  async function handleSave(userId: string, input: UpdateUser) {
    setPending(`save:${userId}`);
    setNotice(undefined);
    try {
      const updated = await updateUser(userId, input);
      setUsers((current) => current?.map((user) => (user.id === userId ? updated : user)) ?? null);
      setNotice({ tone: "success", message: `Updated ${updated.displayName}` });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not update this user. Try again.") });
    } finally {
      setPending(undefined);
    }
  }

  async function handleToggleActive(user: UserSummary) {
    setPending(`toggle:${user.id}`);
    setNotice(undefined);
    try {
      const updated = await updateUser(user.id, { isActive: !user.isActive });
      setUsers((current) => current?.map((item) => (item.id === user.id ? updated : item)) ?? null);
      setNotice({ tone: "success", message: `${updated.displayName} is now ${updated.isActive ? "active" : "inactive"}` });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not change this user's status. Try again.") });
    } finally {
      setPending(undefined);
    }
  }

  async function handleRevokeSessions(user: UserSummary) {
    setPending(`revoke:${user.id}`);
    setNotice(undefined);
    try {
      await revokeUserSessions(user.id);
      setNotice({ tone: "success", message: `Sessions revoked for ${user.displayName}` });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not revoke sessions. Try again.") });
    } finally {
      setPending(undefined);
    }
  }

  async function handleResendInvitation(user: UserSummary) {
    setPending(`resend:${user.id}`); setNotice(undefined);
    try { const result = await resendInvitation(user.id); setCreatedInvitation({ user: result.user, url: invitationUrl(result.invitationToken) }); setNotice({ tone: "success", message: `New invitation ready for ${user.displayName}` }); }
    catch (reason) { setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not resend this invitation.") }); }
    finally { setPending(undefined); }
  }

  async function handleCopyInvitation() {
    if (!createdInvitation) return;
    try {
      await navigator.clipboard.writeText(createdInvitation.url);
      setNotice({ tone: "success", message: "Invitation link copied" });
    } catch {
      setNotice({ tone: "danger", message: "Copy failed. Select and copy the invitation link manually." });
    }
  }

  if (!canManageUsers) {
    return <UnauthorizedState description="Only active administrators can manage Orbit users." />;
  }

  return (
    <div className="mx-auto grid max-w-[1500px] gap-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Administration</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">Users and invitations</h1>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">Manage roles, account status, sessions, and one-time setup links.</p>
        </div>
        <Button aria-label="Refresh users" disabled={loading} onClick={() => void load()} variant="secondary">
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <div aria-label="User summary" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border/70 py-3 text-sm">
        <span className="font-semibold text-foreground">{users?.length ?? "—"} users</span>
        <span className="text-muted-foreground"><span className="font-semibold text-success">{users ? activeCount : "—"}</span> active</span>
        <span className="text-muted-foreground"><span className="font-semibold text-foreground">{users ? users.length - activeCount : "—"}</span> inactive</span>
      </div>

      <CreateUserForm pending={pending === "create"} onCreate={handleCreate} />

      {createdInvitation ? (
        <Card className="border-primary/30 bg-primary-soft p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Invitation ready</h2>
              <p className="mt-1 text-xs text-muted-foreground">Share this one-time link with {createdInvitation.user.displayName}. It is shown only after creation.</p>
              <p className="mt-3 break-all rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-foreground">{createdInvitation.url}</p>
            </div>
            <Button aria-label="Copy invitation link" onClick={() => void handleCopyInvitation()} variant="secondary">
              Copy link
            </Button>
          </div>
        </Card>
      ) : null}

      {notice ? (
        <p
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === "success" ? "border-success/20 bg-success-soft text-success" : "border-danger/20 bg-danger-soft text-danger"}`}
          role={notice.tone === "danger" ? "alert" : "status"}
        >
          {notice.message}
        </p>
      ) : null}

      {loading && users === null ? <LoadingState label="Loading admin users" /> : null}

      {error ? (
        <Card className="grid min-h-56 place-items-center border-danger/20 p-6 text-center" role="alert">
          <div>
            <span className="mx-auto mb-4 grid size-10 place-items-center rounded-xl bg-danger-soft text-danger" aria-hidden="true">!</span>
            <h2 className="text-base font-semibold text-foreground">Users unavailable</h2>
            <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">{error}</p>
            <Button aria-label="Retry loading users" className="mt-5" onClick={() => void load()} variant="secondary">
              Retry
            </Button>
          </div>
        </Card>
      ) : null}

      {!loading && !error && users?.length === 0 ? (
        <EmptyState
          title="No users yet"
          description="Create the first teammate with the invitation form above."
        />
      ) : null}

      {!error && users && users.length > 0 ? (
        <section aria-label="Managed users" className="grid gap-3">
          {users.map((user) => (
            <UserForm
              key={user.id}
              onRevokeSessions={handleRevokeSessions}
              onResendInvitation={handleResendInvitation}
              onSave={handleSave}
              onToggleActive={handleToggleActive}
              pending={pending?.endsWith(user.id)}
              user={user}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
