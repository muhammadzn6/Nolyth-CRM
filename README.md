# Orbit CRM Phase 1

Phase 1 foundation for an internal Job Placement / Lead Management CRM built with Next.js App Router, MongoDB, Mongoose, Auth.js credentials authentication, and a centralized activity event model.

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/orbit
AUTH_SECRET=replace-with-a-long-random-secret
AUTH_URL=http://localhost:3000
```

## Local development

```bash
npm install
npm run seed
npm run dev
```

Open `http://localhost:3000/login`.

## Demo credentials

Created by `npm run seed`:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@orbit.local` | `Admin12345!` |
| BD (Eyong) | `siddiqah@orbit.local` | `Orbit12345!` |
| Closer (Eyong) | `ali@orbit.local` | `Orbit12345!` |
| BD (Olabi Toufic) | `shagufta@orbit.local` | `Orbit12345!` |
| Closer (Olabi Toufic) | `emaz@orbit.local` | `Orbit12345!` |

### Profiles

1. **Eyong** — BD: Siddiqah, Closer: Ali
2. **Olabi Toufic** — BD: Shagufta, Closer: Emaz Ashraf

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
npm run seed
```

## Phase 1 scope

Included:

- project foundation
- MongoDB and Mongoose setup
- Auth.js login
- role-based authorization
- user, profile, lead, interview round, and activity models
- service layer and Route Handlers
- centralized audit architecture
- base authenticated shell and shared UI primitives
- seed data and business-rule tests

Intentionally deferred:

- detailed lead spreadsheet workspace
- Kanban board
- advanced search UI
- analytics dashboard
- interview workflow screens
