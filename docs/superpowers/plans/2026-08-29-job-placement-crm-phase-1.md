# Job Placement CRM Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the verified Phase 1 foundation of the internal Job Placement CRM in a single Next.js application.

**Architecture:** Use a layered Next.js App Router application with Auth.js credentials authentication, Mongoose models, service modules for business logic, Zod validation, centralized authorization helpers, and a single immutable activity event collection. Keep route handlers thin and render a restrained authenticated shell UI to prove the foundation end to end.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Auth.js, MongoDB, Mongoose, Zod, bcryptjs, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-08-29-job-placement-crm-phase-1-design.md`

## Global Constraints

- Build only Phase 1 foundation work and stop before the detailed Lead Workspace UI.
- Use Next.js Route Handlers for backend APIs; do not create a separate backend server.
- Use the Node.js runtime for MongoDB and Mongoose code.
- Keep business logic out of React components and mostly out of route handlers.
- Enforce roles as controlled values: `ADMIN`, `BD`, `CLOSER`.
- Enforce server-side authorization; do not trust client-supplied user ids or roles.
- Use centralized activity events rather than separate audit systems.
- Validate all request inputs and whitelist mutation fields.
- Use a clean light theme with compact, operational UI primitives.
- Verify with lint, typecheck, tests, and build before completion.

---

### Task 1: Bootstrap The Application Foundation

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/lib/utils/cn.ts`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

**Interfaces:**
- Consumes: none
- Produces: a working Next.js app foundation, Tailwind setup, path aliases, and test runner wiring

- [ ] **Step 1: Scaffold the Next.js application**

```bash
npm create next-app@latest . --ts --tailwind --eslint --app --src-dir --use-npm --import-alias "@/*" --yes
```

- [ ] **Step 2: Add backend and test dependencies**

```bash
npm install mongoose zod @auth/core next-auth bcryptjs
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/bcryptjs
```

- [ ] **Step 3: Add a failing smoke test for the shared utility setup**

```ts
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils/cn";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", undefined, "b")).toBe("a b");
  });
});
```

- [ ] **Step 4: Run the test to verify it fails before the utility exists**

```bash
npx vitest run
```

- [ ] **Step 5: Implement the shared utility and test configuration**

```ts
export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
```

- [ ] **Step 6: Run the test suite again**

```bash
npx vitest run
```

### Task 2: Build Shared Domain Constants, Errors, Database, And Auth Foundation

**Files:**
- Create: `src/constants/roles.ts`
- Create: `src/constants/leads.ts`
- Create: `src/constants/activity.ts`
- Create: `src/lib/env.ts`
- Create: `src/lib/db/mongoose.ts`
- Create: `src/lib/db/transaction.ts`
- Create: `src/lib/errors/app-error.ts`
- Create: `src/lib/errors/handle-route-error.ts`
- Create: `src/lib/auth/password.ts`
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/auth/config.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Test: `src/lib/auth/password.test.ts`
- Test: `src/lib/env.test.ts`

**Interfaces:**
- Consumes: app foundation from Task 1
- Produces:
  - `Role`, `LeadStatus`, `DeadReason`, `RateUnit`, `ContractType`, `JobType`, `InterviewRoundType`, `InterviewRoundResult`, `ActivityEntityType`, `ActivityAction`
  - `getRequiredEnv(name: string): string`
  - `connectToDatabase(): Promise<typeof import("mongoose")>`
  - `runInTransaction<T>(work: (session: ClientSession | null) => Promise<T>): Promise<T>`
  - `hashPassword(password: string): Promise<string>`
  - `verifyPassword(password: string, hash: string): Promise<boolean>`
  - `auth`, `signIn`, `signOut`, `handlers`

- [ ] **Step 1: Write a failing test for password hashing**

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password helpers", () => {
  it("hashes and verifies credentials", async () => {
    const hash = await hashPassword("secret123");

    expect(hash).not.toBe("secret123");
    await expect(verifyPassword("secret123", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/auth/password.test.ts
```

- [ ] **Step 3: Implement the constants, env helper, db connection, transaction wrapper, Auth.js config, and password helpers**

```ts
export const ROLES = ["ADMIN", "BD", "CLOSER"] as const;
export type Role = (typeof ROLES)[number];
```

```ts
export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}
```

- [ ] **Step 4: Run focused tests for env and password helpers**

```bash
npx vitest run src/lib/auth/password.test.ts src/lib/env.test.ts
```

### Task 3: Define Models, Validation Schemas, Authorization Helpers, And Service Tests

**Files:**
- Create: `src/models/user.ts`
- Create: `src/models/profile.ts`
- Create: `src/models/job-lead.ts`
- Create: `src/models/interview-round.ts`
- Create: `src/models/activity-event.ts`
- Create: `src/lib/validation/common.ts`
- Create: `src/lib/validation/users.ts`
- Create: `src/lib/validation/profiles.ts`
- Create: `src/lib/validation/leads.ts`
- Create: `src/lib/auth/authorization.ts`
- Create: `src/services/activity-service.ts`
- Create: `src/services/user-service.ts`
- Create: `src/services/profile-service.ts`
- Create: `src/services/lead-service.ts`
- Create: `src/services/interview-round-service.ts`
- Test: `src/services/profile-service.test.ts`
- Test: `src/services/lead-service.test.ts`
- Test: `src/lib/auth/authorization.test.ts`

**Interfaces:**
- Consumes: constants, auth, db helpers from Task 2
- Produces:
  - Mongoose models for `User`, `Profile`, `JobLead`, `InterviewRound`, `ActivityEvent`
  - validation schemas for create and update flows
  - authorization helpers for profile and lead access
  - service functions:
    - `createUser(input, actor)`
    - `listUsers(actor)`
    - `createProfile(input, actor)`
    - `listAccessibleProfiles(actor)`
    - `getProfileById(profileId, actor)`
    - `updateProfile(profileId, input, actor)`
    - `createLead(profileId, input, actor)`
    - `getLeadById(leadId, actor)`
    - `updateLead(leadId, input, actor)`
    - `listLeadActivity(leadId, actor)`

- [ ] **Step 1: Write failing service tests for the key profile and lead rules**

```ts
it("returns all profiles to admins and scoped profiles to BD and CLOSER users", async () => {
  const adminProfiles = await listAccessibleProfiles(adminActor);
  const bdProfiles = await listAccessibleProfiles(bdActor);
  const closerProfiles = await listAccessibleProfiles(closerActor);

  expect(adminProfiles).toHaveLength(2);
  expect(bdProfiles).toHaveLength(1);
  expect(closerProfiles).toHaveLength(1);
});
```

```ts
it("creates a lead with APPLIED status and appliedDate by default", async () => {
  const lead = await createLead(profileId, { companyName: "Acme", jobUrl: "https://acme.test/job" }, bdActor);

  expect(lead.status).toBe("APPLIED");
  expect(lead.appliedDate).toBeInstanceOf(Date);
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

```bash
npx vitest run src/services/profile-service.test.ts src/services/lead-service.test.ts src/lib/auth/authorization.test.ts
```

- [ ] **Step 3: Implement the models with indexes, Zod schemas, authorization helpers, and services with transaction-backed activity creation**

```ts
const JobLeadSchema = new Schema(
  {
    profileId: { type: Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    companyName: { type: String, required: true, trim: true },
    jobUrl: { type: String, required: true, trim: true },
    status: { type: String, enum: LEAD_STATUSES, default: "APPLIED", index: true },
    appliedDate: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);
```

```ts
if (nextStatus === "DEAD" && !input.deadReason) {
  throw new ValidationError("deadReason is required when status is DEAD");
}
```

- [ ] **Step 4: Run the focused tests again**

```bash
npx vitest run src/services/profile-service.test.ts src/services/lead-service.test.ts src/lib/auth/authorization.test.ts
```

### Task 4: Add Route Handlers And API Response Utilities

**Files:**
- Create: `src/lib/api/response.ts`
- Create: `src/lib/api/route-context.ts`
- Create: `src/app/api/users/route.ts`
- Create: `src/app/api/profiles/route.ts`
- Create: `src/app/api/profiles/[profileId]/route.ts`
- Create: `src/app/api/profiles/[profileId]/leads/route.ts`
- Create: `src/app/api/profiles/[profileId]/activity/route.ts`
- Create: `src/app/api/leads/[leadId]/route.ts`
- Create: `src/app/api/leads/[leadId]/activity/route.ts`
- Create: `src/app/api/activity/route.ts`
- Test: `src/app/api/activity/route.test.ts`

**Interfaces:**
- Consumes: services and auth helpers from Task 3
- Produces:
  - `ok(data, init?)`
  - `created(data)`
  - `noContent()`
  - real route handlers that authenticate, validate, authorize, call a service, and return the response envelope

- [ ] **Step 1: Write a failing API test for admin-only platform activity**

```ts
it("rejects non-admin platform activity requests", async () => {
  await expect(getPlatformActivity(bdActor)).rejects.toMatchObject({ code: "FORBIDDEN" });
});
```

- [ ] **Step 2: Run the focused API test to verify it fails**

```bash
npx vitest run src/app/api/activity/route.test.ts
```

- [ ] **Step 3: Implement the response helpers and route handlers**

```ts
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, { status: init?.status ?? 200, ...init });
}
```

- [ ] **Step 4: Run the API test again**

```bash
npx vitest run src/app/api/activity/route.test.ts
```

### Task 5: Build The Authenticated Shell And Shared UI Primitives

**Files:**
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/table.tsx`
- Create: `src/components/ui/empty-state.tsx`
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/layout/app-sidebar.tsx`
- Create: `src/components/layout/app-header.tsx`
- Create: `src/components/layout/app-shell.tsx`
- Create: `src/components/layout/page-header.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/page.tsx`
- Create: `src/app/(app)/profiles/page.tsx`
- Create: `src/app/(app)/profiles/[profileId]/page.tsx`
- Create: `src/app/(app)/activity/page.tsx`
- Create: `src/app/(app)/admin/users/page.tsx`
- Create: `src/app/(app)/admin/profiles/page.tsx`
- Create: `src/middleware.ts`
- Test: `src/components/layout/app-shell.test.tsx`

**Interfaces:**
- Consumes: auth and service queries from earlier tasks
- Produces:
  - base design tokens in `globals.css`
  - role-aware navigation shell
  - authenticated pages proving access rules

- [ ] **Step 1: Write a failing UI test for role-aware navigation**

```tsx
it("shows admin navigation only to admins", () => {
  render(<AppShell user={adminUser}>admin content</AppShell>);
  expect(screen.getByText("Users")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused UI test to verify it fails**

```bash
npx vitest run src/components/layout/app-shell.test.tsx
```

- [ ] **Step 3: Implement the UI primitives, app shell, login page, protected layout, and role-based navigation**

```tsx
const navItems = [
  { href: "/profiles", label: "Profiles", roles: ["ADMIN", "BD", "CLOSER"] },
  { href: "/activity", label: "Activity", roles: ["ADMIN", "BD", "CLOSER"] },
  { href: "/admin/users", label: "Users", roles: ["ADMIN"] },
  { href: "/admin/profiles", label: "Profiles", roles: ["ADMIN"] },
];
```

- [ ] **Step 4: Run the focused UI test again**

```bash
npx vitest run src/components/layout/app-shell.test.tsx
```

### Task 6: Add Seed Data, Finish Cross-Cutting Verification, And Document Local Setup

**Files:**
- Create: `scripts/seed.ts`
- Create: `.env.example`
- Modify: `package.json`
- Modify: `README.md`
- Test: `src/services/activity-service.test.ts`

**Interfaces:**
- Consumes: models and services from earlier tasks
- Produces:
  - `npm run seed`
  - documented environment variables
  - verified final scripts for lint, test, typecheck, and build

- [ ] **Step 1: Write a failing test for activity creation on lead mutations**

```ts
it("records an activity event when a lead status changes", async () => {
  await updateLead(leadId, { status: "IN_PROCESS" }, bdActor);
  const activity = await getLeadActivity(leadId, bdActor);
  expect(activity[0]?.action).toBe("LEAD_STATUS_CHANGED");
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

```bash
npx vitest run src/services/activity-service.test.ts
```

- [ ] **Step 3: Implement the seed script, package scripts, and documentation**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "seed": "tsx scripts/seed.ts"
  }
}
```

- [ ] **Step 4: Run the full verification suite**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

- [ ] **Step 5: Fix any failures and rerun until clean**

```bash
npm run lint && npm run typecheck && npm run test && npm run build
```
