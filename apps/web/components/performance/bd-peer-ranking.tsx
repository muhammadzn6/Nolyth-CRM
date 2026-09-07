import type { BdPeerSummary } from "@orbit/contracts";
import { Card } from "@orbit/ui";

function rate(value: number | null): string {
  return value === null ? "—" : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

/** The API contract deliberately exposes only these aggregate values for a peer. */
export function BdPeerRanking({ peers, selfBdId, periodLabel = "30 days" }: { peers: BdPeerSummary[]; selfBdId: string; periodLabel?: string }) {
  const rankedPeers = [...peers].sort((left, right) => right.qualifiedApplications - left.qualifiedApplications || left.bdName.localeCompare(right.bdName));
  return <Card aria-label="BD team ranking" className="editorial-insight-card p-5 sm:p-6">
    <header className="flex items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Team position</p><h2 className="mt-1 text-xl font-bold text-foreground">Team leaderboard</h2><p className="mt-1 text-xs text-muted-foreground">Ranked by qualified applications</p></div>
      <span className="editorial-today-pill">{periodLabel}</span>
    </header>
    {rankedPeers.length ? <div className="bd-leaderboard mt-4 overflow-hidden">
      <table className="w-full table-fixed border-collapse text-left">
        <thead className="border-b border-border/80 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <tr><th className="w-14 px-2 py-2.5 text-center" scope="col">Rank</th><th className="px-2 py-2.5" scope="col">BD</th><th className="w-24 px-3 py-2.5 text-right" scope="col">Qualified</th><th className="w-32 px-3 py-2.5" scope="col">Health</th></tr>
        </thead>
        <tbody className="divide-y divide-border/80">
          {rankedPeers.map((peer, index) => {
            const position = index + 1;
            const isSelf = peer.bdId === selfBdId;
            const rankTone = position === 1 ? "bg-primary text-primary-foreground shadow-[0_5px_14px_rgba(234,95,67,0.22)]" : position <= 3 ? "bg-primary-soft text-primary" : "bg-surface-subtle text-muted-foreground";
            return <tr aria-current={isSelf ? "true" : undefined} className={isSelf ? "bg-primary/[0.06]" : "transition-colors hover:bg-background/80"} key={peer.bdId}>
              <td className="px-3 py-3"><span aria-label={`Position ${position}`} className={`mx-auto grid size-8 place-items-center rounded-full text-xs font-bold ${rankTone}`}>{position}</span></td>
              <th className="min-w-0 px-2 py-3" scope="row"><span className="block truncate text-sm font-semibold text-foreground">{peer.bdName}</span></th>
              <td className="px-3 py-3 text-right"><strong className="text-sm font-bold tabular-nums text-foreground">{peer.qualifiedApplications.toLocaleString()}</strong><span className="sr-only"> qualified applications</span></td>
              <td className="px-3 py-3"><div className="flex items-center gap-2"><span className="bd-health-track" aria-hidden="true"><i style={{ width: `${peer.recordHealthRate ?? 0}%` }} /></span><strong className="w-10 text-right text-xs tabular-nums text-foreground">{rate(peer.recordHealthRate)}</strong></div></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div> : <p className="mt-4 text-sm text-muted-foreground">Team comparisons appear when there is a safe peer summary to show.</p>}
  </Card>;
}
