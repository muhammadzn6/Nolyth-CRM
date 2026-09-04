"use client";

import { useState } from "react";
import type { CommentSummary, CommunicationSummary } from "@orbit/contracts";
import { Button, Input } from "@orbit/ui";
import { updateLeadComment, updateLeadCommunication } from "../../lib/api-client";

export function CollaborationEditForm({ item }: { item: CommentSummary | CommunicationSummary }) {
  const communication = "type" in item;
  const [body, setBody] = useState(item.body);
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  async function save() { setPending(true); setError(undefined); try { if (communication) await updateLeadCommunication(item.id, { body, expectedVersion: item.version }); else await updateLeadComment(item.id, { body, expectedVersion: item.version }); window.location.reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "The entry could not be updated."); } finally { setPending(false); } }
  if (!editing) return <Button className="mt-4" disabled={pending} onClick={() => setEditing(true)} size="sm" variant="secondary">Edit</Button>;
  return <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><Input aria-label="Edit entry" disabled={pending} value={body} onChange={(event) => setBody(event.target.value)} /><Button disabled={pending || !body.trim()} onClick={() => void save()} size="sm">{pending ? "Saving…" : "Save"}</Button><Button disabled={pending} onClick={() => setEditing(false)} size="sm" variant="ghost">Cancel</Button>{error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}</div>;
}
