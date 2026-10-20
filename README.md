# Bindu

Bindu (formerly Hemora) is a privacy-first blood donation network built with React, TypeScript, Vite, and Supabase. It includes the public matching experience, member workflows, a responsive PWA, and a lazy-loaded operations dashboard in one application.

## What is included

- Donor discovery with blood group, district, area, and availability filters
- Blood request listing, request detail, validated two-step creation, and response flow
- Passwordless Supabase Auth integration with a no-credentials interactive demo fallback
- Member dashboard, availability controls, notification center, donation history, profile, consent, and privacy settings
- Admin overview, request management, donor review, moderation, verification, analytics, and audit-log surfaces
- PostgreSQL schema for identity, donor operations, requests, communication, moderation, analytics, and immutable auditing
- Permission-based RLS, MFA-gated admin RPC, protected verification storage, and explicit Data API grants
- Supabase Cron jobs for expiration, availability reset, metrics snapshots, and notification cleanup
- JWT-protected Edge Function scaffold for privacy-safe matching notifications
- Installable PWA (`public/sw.js`) with conservative caching that excludes authenticated and admin routes
- Optional PostHog event allow-list, Turnstile CAPTCHA, Web Push (VAPID), and Sentry monitoring with PII disabled
- Role-gated admin shell with live operational metrics, moderation, verification, analytics, audit log, and idle logout
- Contact-unlock consent, data export, account deletion requests, offline availability queue, and rate-limited mutations

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without Supabase environment variables, the interface runs against realistic in-memory demo data. To connect a Supabase project, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`.

For the local Supabase stack (Docker required):

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

## Seed data and super admin

The full relational seed uses the supported Auth Admin API so user IDs and all
foreign keys remain valid. Put these server-only values in `.env.local`:

```bash
SUPABASE_SECRET_KEY=your-secret-or-service-role-key
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=use-a-long-unique-password
```

Then run:

```bash
npm run seed
```

The runner creates or updates the super-admin Auth user, stores authorization
in `user_roles`, creates demo members and donors, fills every public application
table in dependency order, and uploads a verification fixture. It is idempotent.
Never deploy these server-only variables to the Vite client, and never prefix
them with `VITE_`.

## Verification

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

CI runs typecheck, unit tests, and production build on every push and pull request.

## Production setup

1. Create or choose a Supabase project.
2. Link this checkout with `npx supabase link --project-ref <ref>`.
3. Review and push migrations with `npx supabase db push`.
4. Deploy the `notify-match` Edge Function with JWT verification enabled.
5. Configure Auth redirect URLs, an email provider, CAPTCHA, and MFA for every administrative account.
6. Configure Netlify with the Vite environment variables from `.env.example`.
7. Run Supabase security and performance advisors, the RLS tests, and the production launch checklist before handling real user data.

Do not place a Supabase service-role or secret key in any `VITE_` variable. The browser must use a publishable key and rely on RLS. Verification uploads should be stripped of metadata before upload; the schema enforces MIME and size constraints, while production code should also inspect file signatures.

## Architecture notes

- Sensitive contact details live in `donor_private_contacts`, separate from searchable donor profiles.
- Administrative status changes go through `admin_set_request_status`, which checks permissions, requires AAL2, performs a transaction, and appends an audit record.
- Admin screens are code-split from public routes. Database permissions remain authoritative; UI route visibility is not security.
- Product analytics accepts only an explicit anonymized event allow-list. It drops property names associated with names, emails, phone numbers, addresses, blood groups, hospitals, notes, or descriptions.
- Operational analytics are stored as aggregate snapshots in Supabase and exposed only through analyst permissions.
