"use client";

import { useState } from "react";
import type { ReactNode } from "react";

const periods = ["Today", "7 days", "30 days"] as const;

export function BdDashboardControls() {
  const [period, setPeriod] = useState<(typeof periods)[number]>("Today");
  const [offset, setOffset] = useState(0);
  const label = offset === 0 ? "Today" : offset < 0 ? `${Math.abs(offset)} day${Math.abs(offset) === 1 ? "" : "s"} ago` : `In ${offset} day${offset === 1 ? "" : "s"}`;

  return <div aria-label="BD dashboard controls" className="bd-dashboard-control-band mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-3 py-2 shadow-[0_1px_2px_rgba(16,35,56,0.02)]">
    <div className="flex items-center gap-1"><button aria-label="Previous day" className="rounded-xl px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary" onClick={() => setOffset((value) => value - 1)} type="button">‹</button><button className="rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary" onClick={() => setOffset(0)} type="button">{label}</button><button aria-label="Next day" className="rounded-xl px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary" onClick={() => setOffset((value) => value + 1)} type="button">›</button></div>
    <div aria-label="Dashboard period" className="flex items-center gap-0.5 rounded-xl bg-surface-subtle p-1">{periods.map((item) => <button aria-pressed={period === item} className={`rounded-lg px-3 py-1.5 text-xs transition-all ${period === item ? "bg-background font-bold text-primary shadow-sm" : "font-medium text-muted-foreground hover:text-foreground"}`} key={item} onClick={() => setPeriod(item)} type="button">{item}</button>)}</div>
    <p aria-live="polite" className="text-[11px] text-muted-foreground">Showing <span className="font-semibold text-foreground">{period}</span> · US Eastern <span className="mx-1 text-border">·</span> updates instantly</p>
  </div>;
}

export function BdReveal({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="mt-4"><button aria-expanded={open} className="text-xs font-semibold text-primary transition-colors hover:text-primary/70" onClick={() => setOpen((value) => !value)} type="button">{open ? "Hide details ↑" : `${label} →`}</button>{open ? <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">{children}</div> : null}</div>;
}
