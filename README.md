# BE Rejection Sheet

**Daily Rejection & Rework Tracking System — Billion Engineer Pvt Ltd**

A full-stack web application that replaces Excel-based rejection tracking with a proper database, real-time dashboards, trend analytics (daily through 12-month), and optional AI-powered insights via OpenAI.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React, TypeScript |
| Styling | Tailwind CSS + shadcn/ui components |
| Charts | Recharts |
| Backend | Next.js API Routes (Node.js) |
| Database | PostgreSQL via **Neon** (serverless) |
| ORM | Prisma 5 |
| Auth | NextAuth v4 (email/password, JWT) |
| AI | Anthropic API (claude-sonnet-4-6) — optional |
| Deploy | Render |

---

## Features

- **Daily Entry Form** — select line, part, produced qty, add defect rows with auto-calculated cost. Handles PROD=0 gracefully (shows N/A, no division by zero).
- **Overview Dashboard** — KPI cards, line comparison charts, anomaly alerts, AI summary button.
- **Analytics Page** — trend charts (daily/weekly/monthly), Pareto analysis, line vs line comparison, defect intensity heatmap. Period filters: Today, This Week, This Month, 3/6/9/12 months.
- **AI Insights Page** — natural language query chatbox, root cause analysis per defect type.
- **Admin Panel** — manage lines, parts, defect types (with merge/normalize), and users.
- **Role-Based Access** — Admin, Supervisor, Viewer.

---

## Neon Setup

1. Go to [neon.tech](https://neon.tech) and create a free account.
2. Create a new project (pick the region closest to your deploy server).
3. In the **Connection Details** panel, you will see two connection strings:
   - **Pooled connection** (for app runtime, uses PgBouncer) — use this as `DATABASE_URL`
   - **Direct connection** (for Prisma migrations) — use this as `DIRECT_URL`
4. Both strings look like: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
   - The pooled one has `-pooler` in the host name and `pgbouncer=true` in the query string.

**Neon Branching tip:** Use Neon's branching feature to keep a `dev` branch separate from `main` (production). In the Neon dashboard → Branches → Create Branch. Each branch gets its own connection strings. Use `dev` strings locally and in staging, keep `main` for production.

---

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in:

```env
# Neon PostgreSQL (pooled — for app runtime)
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"

# Neon PostgreSQL (direct — for Prisma migrate)
DIRECT_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"

# NextAuth — generate with: openssl rand -base64 32
NEXTAUTH_SECRET="your-random-secret"
NEXTAUTH_URL="http://localhost:3000"

# OpenAI (optional — AI features gracefully degrade without it)
ANTHROPIC_API_KEY="sk-..."
```

---

## Local Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your Neon connection strings

# 3. Run Prisma migration (creates tables in Neon)
npx prisma migrate dev --name init

# 4. Seed the database (creates admin user + sample data)
npm run db:seed

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Default credentials:**
- Admin: `admin@plant.com` / `admin123`
- Supervisor: `supervisor@plant.com` / `super123`

---

## Database Schema

```
users           — email, password_hash, role (ADMIN/SUPERVISOR/VIEWER)
lines           — production line name + description (user-configurable)
parts           — part name, net_weight, unit_cost
defect_types    — name, category, description (normalized)
daily_entries   — date, line, part, produced_qty, entered_by
rejections      — daily_entry, defect_type, qty, unit_cost, total_cost, type (REJECTION/REWORK)
material_checks — date, part, expected_weight, actual_weight, variance
audit_logs      — action, entity_type, entity_id, old/new value
```

Key design decisions:
- `daily_entries` has a unique constraint on `(date, line_id, part_id)` — prevents duplicate entries
- `rejectionRate = SUM(rejections.qty) / daily_entry.producedQty × 100` — never computed if producedQty = 0
- Indexes on `date`, `lineId`, `defectTypeId` for fast analytics queries

---

## AI Features (OpenAI)

All AI features are **optional** — the app works fully without `ANTHROPIC_API_KEY`. When the key is missing, AI panels show "AI insights unavailable" instead of erroring.

| Feature | How it works |
|---|---|
| Natural language query | User asks a question → last 30 days aggregated → sent to gpt-4o as context |
| Period summary | Aggregated stats → gpt-4o generates a 3-4 sentence narrative |
| Root cause analysis | 30-day history for a defect type → gpt-4o suggests likely causes |
| Anomaly detection | Statistical (>2 std dev from rolling mean) — no AI key needed |

All AI outputs are clearly labeled as AI-generated and include a reminder to verify with the production team.

---

## Deploying to Render

1. Push this repo to GitHub.
2. In [render.com](https://render.com), create a **Web Service** pointing to your repo.
3. Build command: `npm install && npx prisma generate && npm run build`
4. Start command: `npm start`
5. Add environment variables (same as `.env.local`, but change `NEXTAUTH_URL` to your Render URL).
6. After first deploy, run the migration once via Render Shell: `npx prisma migrate deploy`
7. Then seed if needed: `npm run db:seed`

---

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run db:migrate   # Run Prisma migrations (dev)
npm run db:seed      # Seed database with sample data
npm run db:studio    # Open Prisma Studio (visual DB browser)
npm run db:push      # Push schema changes without migration (quick prototyping)
```
