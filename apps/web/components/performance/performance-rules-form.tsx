"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  performanceRuleInputSchema,
  type BdTargetSchedule,
  type PerformanceApprovedLeave,
  type PerformanceHoliday,
  type PerformanceRuleSet,
  type SessionUser,
  type UserSummary,
} from "@orbit/contracts";
import { Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, UnauthorizedState } from "@orbit/ui";

import {
  ApiClientError,
  createBdTargetSchedule,
  createPerformanceApprovedLeave,
  createPerformanceHoliday,
  getDuplicateReviews,
  getPerformanceRules,
  listBdTargetSchedules,
  listPerformanceApprovedLeaves,
  listPerformanceHolidays,
  listUsers,
  previewPerformanceRules,
  reviewDuplicateOverride,
  updateBdTargetSchedule,
  updatePerformanceRules,
  type DuplicateReviewWithLead,
  type PerformanceRuleInput,
  type PerformanceRulePreview,
} from "../../lib/api-client";
import { RuleImpactPreview } from "./rule-impact-preview";

type Notice = { tone: "success" | "danger"; message: string };

const weekdays = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
] as const;

function inputDateTime(value: string) {
  return value.slice(0, 16);
}

function isoDateTime(value: string) {
  return value ? `${value}:00.000Z` : "";
}

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "No end date";
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof ApiClientError || reason instanceof Error ? reason.message : fallback;
}

function toDraft(rule: PerformanceRuleSet): PerformanceRuleInput {
  const {
    id: _id,
    createdAt: _createdAt,
    createdById: _createdById,
    updatedAt: _updatedAt,
    version: _version,
    effectiveTo,
    ...draft
  } = rule;
  return { ...draft, auditMetadata: draft.auditMetadata ?? undefined, effectiveTo: effectiveTo ?? undefined };
}

function NumberField({
  id,
  label,
  value,
  onChange,
  hint,
  min = 0,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  min?: number;
}) {
  return (
    <Field hint={hint} htmlFor={id} label={label}>
      <Input id={id} min={min} onChange={(event) => onChange(Number(event.target.value))} type="number" value={Number.isFinite(value) ? value : ""} />
    </Field>
  );
}

export function PerformanceRulesForm({ actor }: { actor: SessionUser }) {
  const canManageRules = actor.role === "ADMIN" && actor.isActive;
  const [rule, setRule] = useState<PerformanceRuleSet | null>();
  const [draft, setDraft] = useState<PerformanceRuleInput>();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [targets, setTargets] = useState<BdTargetSchedule[]>([]);
  const [holidays, setHolidays] = useState<PerformanceHoliday[]>([]);
  const [leaves, setLeaves] = useState<PerformanceApprovedLeave[]>([]);
  const [reviews, setReviews] = useState<DuplicateReviewWithLead[]>([]);
  const [loading, setLoading] = useState(canManageRules);
  const [pending, setPending] = useState<string>();
  const [notice, setNotice] = useState<Notice>();
  const [preview, setPreview] = useState<PerformanceRulePreview>();
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>({});
  const [holiday, setHoliday] = useState({ date: "", name: "" });
  const [leave, setLeave] = useState({ bdId: "", startsAt: "", endsAt: "", reason: "", availableStartHour: "", availableEndHour: "" });
  const [newTarget, setNewTarget] = useState({ bdId: "", dailyTarget: "" });

  const load = useCallback(async () => {
    if (!canManageRules) return;
    setLoading(true);
    try {
      const [nextRule, nextUsers, nextTargets, nextHolidays, nextLeaves, nextReviews] = await Promise.all([
        getPerformanceRules(),
        listUsers(),
        listBdTargetSchedules(),
        listPerformanceHolidays(),
        listPerformanceApprovedLeaves(),
        getDuplicateReviews(),
      ]);
      setRule(nextRule);
      setDraft(nextRule ? toDraft(nextRule) : undefined);
      setUsers(nextUsers.filter((user) => user.role === "BD" && user.isActive));
      setTargets(nextTargets);
      setHolidays(nextHolidays);
      setLeaves(nextLeaves);
      setReviews(nextReviews);
      setNotice(undefined);
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not load performance rules.") });
    } finally {
      setLoading(false);
    }
  }, [canManageRules]);

  useEffect(() => {
    void load();
  }, [load]);

  const bdNames = useMemo(() => new Map(users.map((user) => [user.id, user.displayName])), [users]);
  const pendingReviews = reviews.filter((review) => review.status === "PENDING");

  function setDraftValue<K extends keyof PerformanceRuleInput>(key: K, value: PerformanceRuleInput[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    setPreview(undefined);
    setPreviewConfirmed(false);
  }

  function toggleWorkingDay(day: number) {
    if (!draft) return;
    const workingDays = draft.workingDays.includes(day)
      ? draft.workingDays.filter((value) => value !== day)
      : [...draft.workingDays, day].sort((left, right) => left - right);
    setDraftValue("workingDays", workingDays);
  }

  function validateDraft(): string | null {
    if (!draft) return "Performance rules are unavailable.";
    const parsed = performanceRuleInputSchema.safeParse(draft);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.message.includes("weights")) return "Weights must total 100%";
      return issue?.message ?? "Enter valid performance rule values.";
    }
    if (new Date(draft.effectiveFrom).getTime() <= Date.now()) return "Rule versions must have a future effective date.";
    return null;
  }

  async function handlePreview() {
    const validation = validateDraft();
    if (validation) {
      setNotice({ tone: "danger", message: validation });
      return;
    }
    setPending("preview");
    try {
      setPreview(await previewPerformanceRules(draft!));
      setPreviewConfirmed(false);
      setNotice(undefined);
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not preview this rule version.") });
    } finally {
      setPending(undefined);
    }
  }

  async function handleSave() {
    const validation = validateDraft();
    if (validation) {
      setNotice({ tone: "danger", message: validation });
      return;
    }
    if (!rule || !preview || !previewConfirmed) {
      setNotice({ tone: "danger", message: "Confirm the impact preview before saving." });
      return;
    }
    setPending("save");
    try {
      const saved = await updatePerformanceRules({ id: rule.id, expectedVersion: rule.version, ...draft! });
      setRule(saved);
      setDraft(toDraft(saved));
      setPreview(undefined);
      setPreviewConfirmed(false);
      setNotice({ tone: "success", message: "Future-effective performance rules saved." });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not save performance rules.") });
    } finally {
      setPending(undefined);
    }
  }

  async function handleTargetSave(schedule: BdTargetSchedule, dailyTarget: number) {
    if (!Number.isInteger(dailyTarget) || dailyTarget <= 0) {
      setNotice({ tone: "danger", message: "BD targets must be positive whole numbers." });
      return;
    }
    setPending(`target:${schedule.id}`);
    try {
      const saved = await updateBdTargetSchedule(schedule.id, {
        bdId: schedule.bdId,
        dailyTarget,
        effectiveFrom: schedule.effectiveFrom,
        ...(schedule.effectiveTo ? { effectiveTo: schedule.effectiveTo } : {}),
        expectedVersion: schedule.version,
      });
      setTargets((current) => current.map((item) => item.id === saved.id ? saved : item));
      setNotice({ tone: "success", message: "BD target saved." });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not update the BD target.") });
    } finally {
      setPending(undefined);
    }
  }

  async function handleAddTarget() {
    const dailyTarget = Number(newTarget.dailyTarget);
    if (!newTarget.bdId || !Number.isInteger(dailyTarget) || dailyTarget <= 0) {
      setNotice({ tone: "danger", message: "Select a BD and enter a positive daily target." });
      return;
    }
    setPending("new-target");
    try {
      const saved = await createBdTargetSchedule({ bdId: newTarget.bdId, dailyTarget });
      setTargets((current) => [...current, saved]);
      setNewTarget({ bdId: "", dailyTarget: "" });
      setNotice({ tone: "success", message: "BD target added." });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not add the BD target.") });
    } finally {
      setPending(undefined);
    }
  }

  async function handleAddHoliday() {
    if (!holiday.date || !holiday.name.trim()) {
      setNotice({ tone: "danger", message: "A holiday date and name are required." });
      return;
    }
    setPending("holiday");
    try {
      const saved = await createPerformanceHoliday({ holidayDate: holiday.date, name: holiday.name.trim() });
      setHolidays((current) => [...current, saved]);
      setHoliday({ date: "", name: "" });
      setNotice({ tone: "success", message: "Holiday added to the business calendar." });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not add the holiday.") });
    } finally {
      setPending(undefined);
    }
  }

  async function handleAddLeave() {
    const availableStartHour = leave.availableStartHour === "" ? null : Number(leave.availableStartHour);
    const availableEndHour = leave.availableEndHour === "" ? null : Number(leave.availableEndHour);
    if (!leave.bdId || !leave.startsAt || !leave.endsAt || (availableStartHour === null) !== (availableEndHour === null)) {
      setNotice({ tone: "danger", message: "Select a BD, valid leave dates, and both reduced-schedule hours when used." });
      return;
    }
    setPending("leave");
    try {
      const saved = await createPerformanceApprovedLeave({
        bdId: leave.bdId,
        startsAt: isoDateTime(leave.startsAt),
        endsAt: isoDateTime(leave.endsAt),
        reason: leave.reason.trim() || null,
        availableStartHour,
        availableEndHour,
      });
      setLeaves((current) => [...current, saved]);
      setLeave({ bdId: "", startsAt: "", endsAt: "", reason: "", availableStartHour: "", availableEndHour: "" });
      setNotice({ tone: "success", message: "Approved leave saved." });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not save approved leave.") });
    } finally {
      setPending(undefined);
    }
  }

  async function handleReview(review: DuplicateReviewWithLead, status: "APPROVED" | "REJECTED") {
    const reviewReason = reviewReasons[review.id]?.trim() ?? "";
    if (!reviewReason) {
      setNotice({ tone: "danger", message: "A decision reason is required." });
      return;
    }
    setPending(`review:${review.id}`);
    try {
      const saved = await reviewDuplicateOverride(review.id, { status, reviewReason, expectedVersion: review.version });
      setReviews((current) => current.map((item) => item.id === saved.id ? saved : item));
      setNotice({ tone: "success", message: `Duplicate override ${status.toLowerCase()}.` });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not resolve the duplicate override.") });
    } finally {
      setPending(undefined);
    }
  }

  if (!canManageRules) return <UnauthorizedState description="Only active administrators can manage performance rules and duplicate overrides." />;
  if (loading) return <LoadingState label="Loading performance rules" />;
  if (!rule || !draft) return <ErrorState actionLabel="Retry" description={notice?.message ?? "No active performance rule version is available."} onAction={() => void load()} title="Performance rules unavailable" />;

  return (
    <div className="mx-auto grid max-w-[1500px] gap-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Administration</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">Performance rules</h1>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">Configure future performance policy. Scores and target credit remain server-calculated.</p>
        </div>
        <Button aria-label="Refresh performance rules" disabled={pending !== undefined} onClick={() => void load()} variant="secondary">Refresh</Button>
      </header>

      {notice ? <p className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === "success" ? "border-success/20 bg-success-soft text-success" : "border-danger/20 bg-danger-soft text-danger"}`} role={notice.tone === "danger" ? "alert" : "status"}>{notice.message}</p> : null}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Future-effective version</p>
            <h2 className="mt-1 text-lg font-bold text-foreground">Core policy</h2>
            <p className="mt-1 text-sm text-muted-foreground">Edit a future version, then preview its server-calculated impact before saving.</p>
          </div>
          <span className="rounded-full bg-surface-subtle px-3 py-1.5 text-xs font-semibold text-muted-foreground">Version {rule.version}</span>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field hint="UTC" htmlFor="rule-effective-from" label="Effective from">
              <Input id="rule-effective-from" onChange={(event) => setDraftValue("effectiveFrom", isoDateTime(event.target.value))} type="datetime-local" value={inputDateTime(draft.effectiveFrom)} />
            </Field>
            <Field hint="Optional" htmlFor="rule-effective-to" label="Effective until">
              <Input id="rule-effective-to" onChange={(event) => setDraftValue("effectiveTo", event.target.value ? isoDateTime(event.target.value) : undefined)} type="datetime-local" value={draft.effectiveTo ? inputDateTime(draft.effectiveTo) : ""} />
            </Field>
            <NumberField id="defaultDailyTarget" label="Default daily target" min={1} onChange={(value) => setDraftValue("defaultDailyTarget", value)} value={draft.defaultDailyTarget} />
            <Field htmlFor="businessCalendarTimeZone" label="Business calendar timezone"><Input id="businessCalendarTimeZone" onChange={(event) => setDraftValue("businessCalendarTimeZone", event.target.value)} value={draft.businessCalendarTimeZone} /></Field>
            <NumberField id="workdayStartHour" label="Workday starts" min={0} onChange={(value) => setDraftValue("workdayStartHour", value)} value={draft.workdayStartHour} />
            <NumberField id="workdayEndHour" label="Workday ends" min={1} onChange={(value) => setDraftValue("workdayEndHour", value)} value={draft.workdayEndHour} />
          </div>
          <div className="rounded-2xl border border-border bg-surface-subtle p-4">
            <p className="text-sm font-bold text-foreground">Working days</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">These days drive target capacity and business-hour SLA calculations.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {weekdays.map(([day, label]) => <label className={`cursor-pointer rounded-full border px-3 py-2 text-xs font-semibold ${draft.workingDays.includes(day) ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted-foreground"}`} key={day}><input checked={draft.workingDays.includes(day)} className="sr-only" onChange={() => toggleWorkingDay(day)} type="checkbox" />{label}</label>)}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <NumberField id="followUpSlaBusinessHours" label="BD follow-up SLA" min={1} onChange={(value) => setDraftValue("followUpSlaBusinessHours", value)} value={draft.followUpSlaBusinessHours} />
              <NumberField id="adminReassignmentSlaBusinessHours" label="Admin reassignment SLA" min={1} onChange={(value) => setDraftValue("adminReassignmentSlaBusinessHours", value)} value={draft.adminReassignmentSlaBusinessHours} />
              <NumberField id="maturityWindowDays" label="Outcome maturity window" min={1} onChange={(value) => setDraftValue("maturityWindowDays", value)} value={draft.maturityWindowDays} />
              <NumberField id="duplicateLookbackMonths" label="Duplicate lookback" min={1} onChange={(value) => setDraftValue("duplicateLookbackMonths", value)} value={draft.duplicateLookbackMonths} />
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-3">
          <fieldset className="rounded-2xl border border-border p-4"><legend className="px-1 text-sm font-bold text-foreground">Score weights</legend><div className="mt-2 grid gap-3"><NumberField id="applicationWeightPercent" label="Qualified applications" min={0} onChange={(value) => setDraftValue("applicationWeightPercent", value)} value={draft.applicationWeightPercent} /><NumberField id="followUpWeightPercent" label="Follow-up SLA" min={0} onChange={(value) => setDraftValue("followUpWeightPercent", value)} value={draft.followUpWeightPercent} /><NumberField id="outcomeWeightPercent" label="Matured outcomes" min={0} onChange={(value) => setDraftValue("outcomeWeightPercent", value)} value={draft.outcomeWeightPercent} /></div></fieldset>
          <fieldset className="rounded-2xl border border-border p-4"><legend className="px-1 text-sm font-bold text-foreground">Outcome points</legend><div className="mt-2 grid gap-3"><NumberField id="positiveReplyPoints" label="Positive reply" min={1} onChange={(value) => setDraftValue("positiveReplyPoints", value)} value={draft.positiveReplyPoints} /><NumberField id="screeningPoints" label="Screening" min={1} onChange={(value) => setDraftValue("screeningPoints", value)} value={draft.screeningPoints} /><NumberField id="interviewPoints" label="Interview" min={1} onChange={(value) => setDraftValue("interviewPoints", value)} value={draft.interviewPoints} /><NumberField id="offerPoints" label="Offer" min={1} onChange={(value) => setDraftValue("offerPoints", value)} value={draft.offerPoints} /></div></fieldset>
          <fieldset className="rounded-2xl border border-border p-4"><legend className="px-1 text-sm font-bold text-foreground">Extra-target slowdown</legend><p className="mt-1 text-xs leading-5 text-muted-foreground">Above the threshold, extra attainment uses the configured multiplier.</p><div className="mt-4 grid gap-3"><NumberField id="slowdownThresholdPercent" label="Threshold percent" min={1} onChange={(value) => setDraftValue("slowdownThresholdPercent", value)} value={draft.slowdownThresholdPercent} /><NumberField id="slowdownMultiplierPercent" label="Multiplier percent" min={0} onChange={(value) => setDraftValue("slowdownMultiplierPercent", value)} value={draft.slowdownMultiplierPercent} /></div></fieldset>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3"><Button data-action="preview-rules" disabled={pending !== undefined} onClick={() => void handlePreview()} variant="secondary">{pending === "preview" ? "Previewing…" : "Preview impact"}</Button><Button data-action="save-rules" disabled={pending !== undefined} onClick={() => void handleSave()}>{pending === "save" ? "Saving…" : "Save future version"}</Button></div>
      </Card>

      {preview ? <RuleImpactPreview confirmed={previewConfirmed} onConfirmedChange={setPreviewConfirmed} preview={preview} /> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5"><h2 className="text-lg font-bold text-foreground">Individual BD targets</h2><p className="mt-1 text-sm text-muted-foreground">Individual targets override the default from their effective date.</p><div className="mt-4 grid gap-3">{targets.map((target) => <div className="grid gap-3 rounded-xl border border-border bg-surface-subtle p-3 sm:grid-cols-[1fr_150px_auto] sm:items-end" key={target.id}><div><p className="text-sm font-semibold text-foreground">{bdNames.get(target.bdId) ?? target.bdId}</p><p className="mt-1 text-xs text-muted-foreground">{target.dailyTarget} applications / day · effective {dateTime(target.effectiveFrom)}</p></div><Field htmlFor={`bd-target-${target.id}`} label="Daily target"><Input defaultValue={target.dailyTarget} id={`bd-target-${target.id}`} min={1} type="number" /></Field><Button data-action="save-bd-target" disabled={pending !== undefined} onClick={() => void handleTargetSave(target, Number((document.getElementById(`bd-target-${target.id}`) as HTMLInputElement | null)?.value))} size="sm" variant="secondary">Save</Button></div>)}</div><div className="mt-4 grid gap-3 rounded-xl border border-dashed border-border p-3 sm:grid-cols-[1fr_140px_auto] sm:items-end"><Field htmlFor="new-target-bd" label="BD"><select className="h-11 rounded-full border border-border bg-surface px-4 text-sm" id="new-target-bd" onChange={(event) => setNewTarget((current) => ({ ...current, bdId: event.target.value }))} value={newTarget.bdId}><option value="">Select BD</option>{users.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}</select></Field><Field htmlFor="new-target-value" label="Daily target"><Input id="new-target-value" min={1} onChange={(event) => setNewTarget((current) => ({ ...current, dailyTarget: event.target.value }))} type="number" value={newTarget.dailyTarget} /></Field><Button disabled={pending !== undefined} onClick={() => void handleAddTarget()} size="sm">Add target</Button></div></Card>

        <Card className="p-5"><h2 className="text-lg font-bold text-foreground">Current version provenance</h2><dl className="mt-4 grid gap-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Effective period</dt><dd className="text-right font-semibold text-foreground">{dateTime(rule.effectiveFrom)} — {dateTime(rule.effectiveTo)}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Created</dt><dd className="text-right font-semibold text-foreground">{dateTime(rule.createdAt)}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Updated</dt><dd className="text-right font-semibold text-foreground">{dateTime(rule.updatedAt)}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Created by</dt><dd className="break-all text-right font-semibold text-foreground">{rule.createdById}</dd></div></dl><p className="mt-4 rounded-xl bg-surface-subtle p-3 text-xs leading-5 text-muted-foreground">The server preserves effective-date versions. This page shows the active version and previews the next version before it is created.</p></Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5"><h2 className="text-lg font-bold text-foreground">Holiday calendar</h2><p className="mt-1 text-sm text-muted-foreground">Holidays pause business-hour SLA clocks and remove target capacity.</p><div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end"><Field htmlFor="holiday-date" label="Date"><Input id="holiday-date" onChange={(event) => setHoliday((current) => ({ ...current, date: event.target.value }))} type="date" value={holiday.date} /></Field><Field htmlFor="holiday-name" label="Holiday name"><Input id="holiday-name" onChange={(event) => setHoliday((current) => ({ ...current, name: event.target.value }))} value={holiday.name} /></Field><Button data-action="add-holiday" disabled={pending !== undefined} onClick={() => void handleAddHoliday()} size="sm">Add holiday</Button></div><ul className="mt-4 grid gap-2">{holidays.map((item) => <li className="rounded-xl border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground" key={item.id}>{item.holidayDate} · {item.name}</li>)}{holidays.length === 0 ? <li className="text-sm text-muted-foreground">No holidays configured.</li> : null}</ul></Card>

        <Card className="p-5"><h2 className="text-lg font-bold text-foreground">Approved leave and reduced schedules</h2><p className="mt-1 text-sm text-muted-foreground">Leave pauses the owner SLA. Use both hours to keep a reduced working window.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field htmlFor="leave-bd" label="BD"><select className="h-11 rounded-full border border-border bg-surface px-4 text-sm" id="leave-bd" onChange={(event) => setLeave((current) => ({ ...current, bdId: event.target.value }))} value={leave.bdId}><option value="">Select BD</option>{users.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}</select></Field><Field htmlFor="leave-reason" label="Reason"><Input id="leave-reason" onChange={(event) => setLeave((current) => ({ ...current, reason: event.target.value }))} value={leave.reason} /></Field><Field htmlFor="leave-start" label="Starts"><Input id="leave-start" onChange={(event) => setLeave((current) => ({ ...current, startsAt: event.target.value }))} type="datetime-local" value={leave.startsAt} /></Field><Field htmlFor="leave-end" label="Ends"><Input id="leave-end" onChange={(event) => setLeave((current) => ({ ...current, endsAt: event.target.value }))} type="datetime-local" value={leave.endsAt} /></Field><Field htmlFor="leave-start-hour" label="Reduced start hour"><Input id="leave-start-hour" max={23} min={0} onChange={(event) => setLeave((current) => ({ ...current, availableStartHour: event.target.value }))} type="number" value={leave.availableStartHour} /></Field><Field htmlFor="leave-end-hour" label="Reduced end hour"><Input id="leave-end-hour" max={24} min={1} onChange={(event) => setLeave((current) => ({ ...current, availableEndHour: event.target.value }))} type="number" value={leave.availableEndHour} /></Field></div><Button className="mt-4" data-action="save-leave" disabled={pending !== undefined} onClick={() => void handleAddLeave()} size="sm">Save leave</Button><ul className="mt-4 grid gap-2">{leaves.map((item) => <li className="rounded-xl border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground" key={item.id}>{bdNames.get(item.bdId) ?? item.bdId} · {dateTime(item.startsAt)} — {dateTime(item.endsAt)}{item.availableStartHour !== null ? ` · reduced ${item.availableStartHour}:00–${item.availableEndHour}:00` : ""}</li>)}{leaves.length === 0 ? <li className="text-sm text-muted-foreground">No approved leave configured.</li> : null}</ul></Card>
      </div>

      <Card className="p-5 sm:p-6"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Admin review</p><h2 className="mt-1 text-lg font-bold text-foreground">Pending duplicate overrides</h2><p className="mt-1 text-sm text-muted-foreground">Every likely-duplicate override remains provisional until an Admin resolves it with a reason.</p></div><span className="text-sm font-semibold text-muted-foreground">{pendingReviews.length} pending</span></div><div className="mt-5 grid gap-3">{pendingReviews.map((review) => <article className="rounded-2xl border border-border p-4" key={review.id}><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold text-foreground">{review.lead.companyName} · {review.lead.jobTitle}</h3><p className="mt-1 text-sm text-muted-foreground">Override reason: {review.overrideReason}</p></div><span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning-foreground">{review.provisionalCreditGranted ? "Provisional credit" : "No provisional credit"}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"><Field htmlFor={`review-reason-${review.id}`} label="Decision reason"><Input id={`review-reason-${review.id}`} onChange={(event) => setReviewReasons((current) => ({ ...current, [review.id]: event.target.value }))} value={reviewReasons[review.id] ?? ""} /></Field><Button data-review-decision="APPROVED" disabled={pending !== undefined} onClick={() => void handleReview(review, "APPROVED")} size="sm" variant="secondary">Approve</Button><Button data-review-decision="REJECTED" disabled={pending !== undefined} onClick={() => void handleReview(review, "REJECTED")} size="sm" variant="danger">Reject</Button></div></article>)}{pendingReviews.length === 0 ? <EmptyState description="All duplicate override decisions are up to date." title="No pending duplicate overrides" /> : null}</div></Card>
    </div>
  );
}
