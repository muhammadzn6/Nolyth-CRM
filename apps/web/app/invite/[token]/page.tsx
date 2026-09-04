import type { Metadata } from "next";

import { InvitationForm } from "../../../components/auth/invitation-form";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function InviteRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,0.92fr)_minmax(520px,1.08fr)]">
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="absolute -right-32 -top-28 size-[430px] rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -right-12 -top-8 size-[260px] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-white text-lg font-black text-sidebar shadow-lg">O</span>
          <div>
            <p className="font-bold tracking-[0.16em]">ORBIT</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-sidebar-muted">Placement CRM</p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#91aaf8]">Secure setup</p>
          <h1 className="mt-5 text-5xl font-semibold leading-[1.08] tracking-[-0.045em]">Create your Orbit password.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-sidebar-muted">Use this one-time invitation link to finish account setup. Your administrator never sees your password.</p>
        </div>
        <p className="relative text-xs text-sidebar-muted">Single-use invitation · Authorized users only</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-sidebar font-black text-white">O</span>
            <span className="font-bold tracking-[0.14em] text-foreground">ORBIT</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Invitation</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-foreground">Set up your account</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose a password to activate your Orbit workspace access.</p>
          <div className="mt-8">
            <InvitationForm token={token} />
          </div>
        </div>
      </section>
    </main>
  );
}
