"use client";

import { useState } from "react";

import type { CalendarConnection } from "@orbit/contracts";
import { Button, Card, CardDescription, CardTitle } from "@orbit/ui";
import { connectGoogleCalendar, connectProfileGoogleCalendar, disconnectGoogleCalendar, disconnectProfileGoogleCalendar } from "../../lib/api-client";

export function GoogleCalendarConnection({ companyId, profileId, initialConnection, canManage = true }: { companyId?: string; profileId?: string; initialConnection: CalendarConnection; canManage?: boolean }) {
  const [connection, setConnection] = useState(initialConnection);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function connect() {
    setPending(true);
    setError(undefined);
    try {
      window.location.assign(profileId ? await connectProfileGoogleCalendar(profileId) : await connectGoogleCalendar(companyId!));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google Calendar could not be connected.");
      setPending(false);
    }
  }

  async function disconnect() {
    setPending(true);
    setError(undefined);
    try {
      await (profileId ? disconnectProfileGoogleCalendar(profileId) : disconnectGoogleCalendar(companyId!));
      setConnection({ connected: false, email: null, calendarName: null, lastSyncedAt: null, status: "DISCONNECTED" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google Calendar could not be disconnected.");
    } finally {
      setPending(false);
    }
  }

  const connected = connection.connected;
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Candidate profile calendar</p>
          <CardTitle className="mt-2">Google Calendar</CardTitle>
          <CardDescription className="mt-1">Orbit syncs this candidate profile’s interviews to the candidate-owned primary calendar.</CardDescription>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${connected ? "bg-success-soft text-success" : "bg-surface-subtle text-muted-foreground"}`}>
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>
      {connected ? <p className="mt-4 text-sm text-foreground">{connection.email} · {connection.calendarName ?? "Primary"}</p> : <p className="mt-4 text-sm leading-6 text-muted-foreground">An Admin can connect the candidate’s Google account. BD and assigned Closers use the calendar through Orbit.</p>}
      {error ? <p className="mt-4 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</p> : null}
      {canManage ? <div className="mt-5 flex flex-wrap gap-3">
        {connected ? <Button disabled={pending} onClick={() => void disconnect()} variant="secondary">{pending ? "Disconnecting…" : "Disconnect Google Calendar"}</Button> : <Button disabled={pending} onClick={() => void connect()}>{pending ? "Opening Google…" : "Connect Google Calendar"}</Button>}
      </div> : <p className="mt-5 text-xs font-semibold text-muted-foreground">Calendar connections are managed by Admins.</p>}
    </Card>
  );
}
