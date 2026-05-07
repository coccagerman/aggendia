# turnosapp

turnosapp is a full-stack appointment scheduling platform for service businesses. It combines a public booking experience with a private operations dashboard, built around an explicit domain model for services, resources, availability, appointments, and notifications.

This repository is intentionally opinionated from an engineering standpoint: strong separation of concerns, tenant isolation, explicit domain rules, typed contracts, and a test strategy that supports safe iteration.

## Technical Highlights

- Full-stack Next.js application using the App Router for both product UI and server endpoints.
- Clean architecture split across transport, domain, and data layers.
- Multi-tenant design with business-scoped access and validation.
- Explicit service-to-resource mapping instead of implicit scheduling assumptions.
- UTC persistence with business-local timezone rendering and scheduling rules.
- Strong booking consistency with domain validation plus database-backed safeguards.
- Asynchronous notification workflow for confirmation and reminder delivery.
- Typed validation and error contracts designed for predictable API behavior.

## Product Scope

The product addresses a common operational problem for small and medium-sized businesses: appointment scheduling managed manually through chat, calls, or spreadsheets.

turnosapp provides:

- A public booking page for customers.
- A private dashboard for business operators.
- Service configuration with duration and slot interval rules.
- Resource management for people or assets with independent schedules.
- Weekly availability and one-off blocking windows.
- Appointment lifecycle operations: create, cancel, reschedule, complete.
- Automated email and WhatsApp notifications.

## User Flows

### Business workflow

1. Sign up and complete onboarding.
2. Create a business and configure the resource label used in the UI.
3. Create resources such as staff members, rooms, courts, or equipment.
4. Create services with duration, slot interval, pricing, and booking constraints.
5. Assign which resources can deliver each service.
6. Configure recurring availability and point-in-time blocks.
7. Share the public booking URL.
8. Manage the operational agenda from the dashboard.

### Customer workflow

1. Open the business public page.
2. Select an active service.
3. Select a valid resource when more than one resource supports that service.
4. Browse real availability filtered by service, resource, existing bookings, and booking rules.
5. Confirm the booking with minimal customer data.
6. Receive confirmation and reminders through the configured channels.

## Domain Model

### Service

A service is what the customer books. It defines:

- Appointment duration.
- Slot interval.
- Optional pricing.
- Forward-looking booking constraints.

### Resource

A resource is the schedulable entity that fulfills the service. It may represent a person or a physical asset, and it owns its own schedule.

### Service-resource mapping

Services and resources are related through an explicit many-to-many mapping. A service is only bookable when it is active and has at least one active assigned resource. This makes availability calculation and scheduling decisions explicit instead of inferred.

## Architecture

The codebase follows a clear transport/domain/data split to keep business rules independent from framework and persistence concerns.

### Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma
- Postgres on Supabase
- Supabase Auth
- Zod
- Vitest
- Playwright

### Layer responsibilities

- `src/app`
  Next.js routes, pages, layouts, and route handlers.

- `src/domain`
  Pure business rules, scheduling logic, policies, and domain-level invariants.

- `src/data`
  Repository implementations and persistence concerns.

- `src/lib`
  Shared infrastructure helpers and cross-cutting utilities.

- `tests`
  Unit and integration coverage for domain and server behavior.

- `e2e`
  End-to-end coverage for critical user journeys.

This separation is one of the strongest engineering qualities of the project: route handlers authenticate and validate, domain services make decisions, and repositories persist state. The domain layer is not coupled to Next.js or Prisma.

## Engineering Principles

- Strict tenant isolation by `business_id`.
- Domain-first scheduling rules.
- Consistent API contracts: `{ data: ... }` for success and `{ error: { code, message, details? } }` for failures.
- UTC storage with timezone-aware business behavior.
- Soft deletion where historical integrity matters.
- Strong anti-double-booking guarantees.
- Asynchronous side effects for external notification delivery.
- Minimal, explicit boundaries between UI, domain logic, and persistence.

## Repository Structure

```text
src/
  app/           # public pages, dashboard, and API routes
  components/    # reusable UI components
  data/          # repositories and Prisma access
  domain/        # business rules and scheduling logic
  lib/           # auth, HTTP, and shared utilities
tests/           # unit and integration suites
e2e/             # Playwright flows
prisma/          # Prisma schema and migrations
scripts/         # operational and testing scripts
```

## Local Development

### Requirements

- Node.js compatible with Next.js 16.
- Yarn classic (`1.22.x`).
- Project environment variables.
- Database and provider configuration when testing integrations.

### Install dependencies

```bash
yarn install
```

### Start the development server

```bash
yarn dev
```

### Start against the test environment

```bash
yarn dev:test
```

## Scripts

```bash
yarn dev              # start local development
yarn build            # production build
yarn start            # run the production build
yarn lint             # eslint
yarn tsc --noEmit     # type-check only
yarn test:setup       # prepare the test environment
yarn test             # run Vitest
yarn test:watch       # run Vitest in watch mode
yarn test:coverage    # coverage report
yarn test:reset-db    # reset the test database
yarn e2e              # run Playwright
```

## Testing Strategy

- Unit tests cover domain rules and policy decisions.
- Integration tests cover contracts, auth, multi-tenant behavior, and persistence.
- End-to-end tests cover realistic user flows across the public and private surfaces.

Recommended local validation sequence:

```bash
yarn test:setup && yarn test && yarn tsc --noEmit && yarn lint
```

If the change affects database state or integration scenarios:

```bash
yarn test:reset-db
```

## Why This Project Is Technically Interesting

This project is a strong representation of product-minded backend and full-stack engineering because it combines:

- Domain modeling that reflects real operational constraints.
- Clear architectural boundaries instead of framework-driven sprawl.
- Multi-tenant security requirements.
- Scheduling logic with time, availability, overlap, and state transitions.
- External integrations without leaking infrastructure concerns into the core domain.
- Testable business logic and explicit contracts.

In practice, that means the repository is not just a CRUD dashboard. It is a deliberately structured application with real scheduling rules, business constraints, and operational workflows.

## Operational Notes

- This repository uses Yarn classic as its package manager.
- Local agent folders, test reports, and generated artifacts are ignored in git to keep the repository clean.
- If those files were previously tracked, they must be removed from the git index once before `.gitignore` takes effect.
