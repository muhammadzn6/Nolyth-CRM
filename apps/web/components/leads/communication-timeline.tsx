import type { CommunicationSummary, ContactSummary } from "@orbit/contracts";

import { CollaborationEditForm } from "./collaboration-edit-form";

type Thread = { key: string; subject: string | null; items: CommunicationSummary[] };

function normalizedSubject(value: string | null) {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

function threadCommunications(items: CommunicationSummary[]): Thread[] {
  return [...items]
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
    .reduce<Thread[]>((groups, item) => {
      const subject = item.subject?.trim().replace(/\s+/g, " ") || null;
      const key = normalizedSubject(subject) || `entry:${item.id}`;
      const previous = groups.at(-1);
      if (previous?.key === key) previous.items.push(item);
      else groups.push({ key, subject, items: [item] });
      return groups;
    }, []);
}

function label(item: CommunicationSummary) {
  if (item.direction === "INTERNAL" || item.type === "NOTE") return "Internal note";
  const channel = item.type.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
  return `${item.direction === "INBOUND" ? "Inbound" : "Outbound"} ${channel}`;
}

export function CommunicationTimeline({ editable = false, items, contacts, timeZone }: { editable?: boolean; items: CommunicationSummary[]; contacts: ContactSummary[]; timeZone: string }) {
  const contactNames = new Map(contacts.map((contact) => [contact.id, contact.name]));
  const formatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone });
  const threads = threadCommunications(items);

  return <section aria-label="Communication timeline" className="overflow-hidden rounded-[1.65rem] border border-border/90 bg-surface shadow-[0_1px_2px_rgba(16,35,56,0.02),0_16px_42px_rgba(35,42,58,0.045)]">
    {threads.map((thread) => <article className="border-b border-border/80 last:border-b-0" data-communication-thread={thread.key} key={thread.key}>
      {thread.subject ? <header className="border-b border-border/70 bg-surface-subtle px-5 py-3"><h2 className="font-semibold text-foreground">{thread.subject}</h2><p className="mt-0.5 text-xs text-muted-foreground">{thread.items.length} {thread.items.length === 1 ? "entry" : "entries"}</p></header> : null}
      <div className="divide-y divide-border/70">{thread.items.map((item) => {
        const internal = item.direction === "INTERNAL" || item.type === "NOTE";
        return <div className={internal ? "bg-surface-subtle px-5 py-4" : "px-5 py-4"} key={item.id}>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{label(item)}</p><time className="text-xs text-muted-foreground">{formatter.format(new Date(item.occurredAt))}</time></div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{item.contactId ? <span>{contactNames.get(item.contactId) ?? "Unknown contact"}</span> : null}{item.outcome ? <span><strong className="font-semibold text-foreground">Outcome:</strong> {item.outcome}</span> : null}</div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{item.body}</p>
          {item.nextActionSummary ? <p className="mt-3 rounded-xl bg-surface-subtle px-3 py-2 text-sm text-foreground"><strong>Next:</strong> {item.nextActionSummary}{item.nextActionDueAt ? ` · ${formatter.format(new Date(item.nextActionDueAt))}` : ""}</p> : null}
          {editable ? <CollaborationEditForm item={item} timezone={timeZone} /> : null}
        </div>;
      })}</div>
    </article>)}
  </section>;
}
