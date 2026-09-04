import type { Metadata } from "next";

import { LoginForm } from "../../components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,0.92fr)_minmax(520px,1.08fr)]">
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="absolute -right-32 -top-28 size-[430px] rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -right-12 -top-8 size-[260px] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-white text-lg font-black text-sidebar shadow-lg">O</span><div><p className="font-bold tracking-[0.16em]">ORBIT</p><p className="text-[10px] uppercase tracking-[0.18em] text-sidebar-muted">Placement CRM</p></div></div>
        <div className="relative max-w-xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#91aaf8]">One operational view</p><h1 className="mt-5 text-5xl font-semibold leading-[1.08] tracking-[-0.045em]">Move every placement forward.</h1><p className="mt-5 max-w-lg text-base leading-7 text-sidebar-muted">Coordinate applications, interviews, follow-ups, and outcomes with clear ownership at every stage.</p><div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-6"><div><p className="text-2xl font-semibold">Live</p><p className="mt-1 text-xs text-sidebar-muted">Operational status</p></div><div><p className="text-2xl font-semibold">Role</p><p className="mt-1 text-xs text-sidebar-muted">Scoped access</p></div><div><p className="text-2xl font-semibold">UTC</p><p className="mt-1 text-xs text-sidebar-muted">Reliable timing</p></div></div></div>
        <p className="relative text-xs text-sidebar-muted">Private workspace · Authorized users only</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden"><span className="grid size-9 place-items-center rounded-xl bg-sidebar font-black text-white">O</span><span className="font-bold tracking-[0.14em] text-foreground">ORBIT</span></div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Welcome back</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-foreground">Sign in to your workspace</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Use the credentials provided by your administrator.</p>
          <div className="mt-8"><LoginForm /></div>
          <div className="mt-8 border-t border-border pt-6"><p className="text-xs leading-5 text-muted-foreground">Having trouble signing in? Contact your Orbit administrator to restore access or revoke an old session.</p></div>
        </div>
      </section>
    </main>
  );
}
