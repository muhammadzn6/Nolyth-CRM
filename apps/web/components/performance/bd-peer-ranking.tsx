import type { BdPeerSummary } from "@orbit/contracts";
import { Card } from "@orbit/ui";

function rate(value: number | null): string {
  return value === null ? "N/A" : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

/** The API contract deliberately exposes only these aggregate values for a peer. */
export function BdPeerRanking({ peers, selfRank }: { peers: BdPeerSummary[]; selfRank: number | null }) {
  return <Card aria-label="BD team ranking" className="editorial-insight-card p-5 sm:p-6">
    <header className="flex items-start justify-between gap-4">
      <div><h2 className="text-base font-bold text-foreground">Team position</h2><p className="mt-1 text-xs text-muted-foreground">Your rank: {selfRank ? `#${selfRank}` : "Building baseline"}</p></div>
      <span className="editorial-today-pill">30 days</span>
    </header>
    {peers.length ? <ol className="mt-4 divide-y divide-border">
      {peers.map((peer) => <li className="py-3 first:pt-0 last:pb-0" key={peer.bdId}>
        <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{peer.rank ? `#${peer.rank} · ` : ""}{peer.bdName}</p><p className="mt-0.5 text-xs text-muted-foreground">{peer.qualifiedApplications.toLocaleString()} qualified applications</p></div></div>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground"><div><dt>Record health</dt><dd className="mt-0.5 font-semibold text-foreground">{rate(peer.recordHealthRate)}</dd></div><div><dt>Audit pass</dt><dd className="mt-0.5 font-semibold text-foreground">{rate(peer.adminAuditPassRate)}</dd></div><div><dt>Duplicate rate</dt><dd className="mt-0.5 font-semibold text-foreground">{rate(peer.duplicateRate)}</dd></div></dl>
      </li>)}
    </ol> : <p className="mt-4 text-sm text-muted-foreground">Team comparisons appear when there is a safe peer summary to show.</p>}
  </Card>;
}
