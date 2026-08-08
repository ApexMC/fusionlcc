# Limitless Cheer & Gymnastics

Next.js 16 application for public class information, family accounts, enrollment management, staff operations, and Stripe subscription billing.

## Local development

Requirements: Node.js 20 or later, npm, a Supabase project, Stripe test credentials, and an SMTP account.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Populate `.env.local` from `.env.example`. The Supabase service-role key, Stripe secret, webhook secret, and SMTP password are server-only and must never use a `NEXT_PUBLIC_` prefix.

Add `http://localhost:3000/auth/callback` and the production `/auth/callback` URL to the Supabase authentication redirect allow list so password-reset links can complete the PKCE exchange.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Run all five checks before deployment. The production build downloads Google fonts, so CI needs outbound access to `fonts.googleapis.com` and `fonts.gstatic.com`.

## Stripe webhooks

Configure Stripe to send these events to `/api/stripe/webhook`:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Use Stripe test mode locally and set `STRIPE_WEBHOOK_SECRET` to the signing secret for the active endpoint.

## Supabase data contract

The application currently expects these tables: `organization_members`, `Parents`, `Athletes`, `Classes`, `ClassSchedules`, `ScheduleSeasons`, `Enrollments`, `CheerTeams`, `CheerSchedules`, `CheerEnrollments`, `ClassSessions`, `CheerSessions`, `ClassSessionAttendance`, `CoachTimeClockEntries`, and `DeadPeriods`.

The service-role client bypasses Row Level Security and is restricted to server-only modules. Browser writes should remain protected by RLS; new privileged mutations belong in authenticated Server Actions.

Before changing the production schema, capture the current Supabase schema under `supabase/migrations/` with the Supabase CLI and review it with the related application change. Database uniqueness constraints should back up application checks for enrollment and active time-clock records.

## Contact endpoint

`/api/contact` validates and caps request bodies and applies a per-instance IP rate limit. For horizontally scaled production deployments, place a shared platform/WAF rate limit in front of this endpoint so limits apply across all instances.
