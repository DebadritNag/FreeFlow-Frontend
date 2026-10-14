# Freeflow — Support Operations Desk

A high-density, enterprise support operations console for triaging tickets, enforcing SLAs, and resolving an AI-flagged manual review queue. Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui primitives, and Redux Toolkit, finished in a calm warm-ivory and forest-green light theme.

---

## Quick start

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is taken, Next.js will pick the next free port and print the URL. The root route (`/`) redirects to `/tickets`.

Run the test suite (Vitest):

```bash
npm run test
```

Lint and type-check:

```bash
npm run lint
npx tsc --noEmit
```

Create a production build:

```bash
npm run build
```

---

## Tech stack

- **Framework**: Next.js 16 (App Router) with React 19
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS v4 with CSS-variable design tokens; shadcn/ui (`base-nova`) primitives
- **State**: Redux Toolkit + react-redux
- **Icons**: lucide-react
- **Toasts**: sonner
- **Testing**: Vitest

Data is served by an in-memory mock database (seeded with 2,000+ realistic tickets) through Next.js route handlers, so the app runs end-to-end with no external services, database, or API keys.

---

## Application shell

Every page shares one consistent shell:

- **Left sidebar (~276px)** — brand block, navigation, a promotional card, and the active-agent profile. Navigation items: **Dashboard** (`/tickets`), **Support Operations** (`/review`), and **Reports**. The active item is derived from the current route; a ticket detail route highlights Support Operations. Below the `lg` breakpoint the sidebar collapses into a mobile drawer. The promotional card ("Better support. Happier customers.") uses `public/bg-customer.png` as its background with a subtle ivory overlay for legibility.
- **Top header (~72px)** — global search with a `⌘ K` hint, a live "Synced" indicator, a notification bell, and the active-agent profile.
- **Main workspace** — the warm-ivory canvas that scrolls under the fixed sidebar and header.

---

## Routes & features

### Tickets dashboard — `/tickets`

- **Scale**: in-memory database seeded with 2,000+ realistic tickets across categories, customer tiers, and SLA timestamps.
- **KPI cards**: live counters for Open Backlog, In Progress, SLA Risk & Overdue (with breached count), and the Manual Triage Queue, each with a sparkline. The SLA card carries a distinct amber warning treatment.
- **URL-synced filters**: a 300ms-debounced full-text search plus dropdown filters for Status, Priority, Category, SLA Status, and Triage Decision, with a Clear Filters action. Filter and search state synchronizes with the browser URL for shareable, bookmarkable links.
- **Data table**: ID, Subject & Customer (two lines), Priority, Status, Category, Assignee, SLA countdown, and a row action, with select-all and per-row selection. Monospace IDs and tabular SLA countdowns keep the layout from jittering.
- **Responsive**: a card-based layout down to 375px with no horizontal overflow.
- **Live sync**: cursor-based background polling surfaces newly arriving tickets.

### Ticket detail workspace — `/tickets/[id]`

- **Summary card**: ID, priority/status/category/tier badges, title, timestamps, and the claim actions.
- **Safe content rendering**: customer messages render as plain text with whitespace preserved — no `dangerouslySetInnerHTML`. Attachment URLs are checked against a safe-protocol allowlist; unsafe vectors (`javascript:`, `data:`, `vbscript:`, `file:`) render as a blocked badge instead of a link.
- **Downloadable attachments**: safe attachments link to a real static asset (`public/attachments/`) and download with the attachment's filename.
- **Status lifecycle**: a strict state machine, `open → in_progress → resolved → open`; illegal transitions are rejected with clear guidance.
- **Claim flow**: one-click optimistic claiming, plus **Take Over** and **Release**. A **Simulate 409 Conflict** action demonstrates optimistic rollback and conflict toast handling on demand.
- **Triage & Properties**: real-time priority and category updates with an enterprise SLA floor — enterprise accounts cannot be set below `P1`.
- **Right rail**: Status Lifecycle, Service Level Agreement (live, derived SLA status), Ticket Ownership, and Customer Details.

### Manual Triage Review Queue — `/review`

- Review workspace filtering tickets flagged `triageDecision: 'manual_review'`.
- Each card shows the human-review reason, the AI-suggested priority and category with a confidence score, and Approve Priority / Approve Category controls.
- **Approve & Route** applies the decision and releases the ticket to the general support pool, enforcing the same enterprise priority rule.

---

## Design system

A single warm, light theme — defined as CSS variables in `app/globals.css` and consumed through Tailwind token classes (`bg-background`, `bg-card`, `text-foreground`, `bg-primary`, etc.). The app is light-only: `color-scheme: light` is declared and the `.dark` selector is intentionally pinned to the light palette so the UI never renders a dark variant.

| Token | Hex | Usage |
|---|---|---|
| Canvas | `#F7F6F2` | Main workspace and sidebar background |
| Surface | `#FFFFFF` | Header, cards, panels |
| Text | `#202522` | Headings and primary text |
| Secondary text | `#68736D` | Muted labels and metadata |
| Primary | `#246B4B` | Primary actions, active navigation, positive status |
| Warning | `#D97736` | SLA risk, caution, and the simulate-conflict action |
| Critical | `#C83F36` | Breached SLAs and genuinely critical states |
| Border | `#E6E5DF` | Subtle card and control borders |

Details: tabular numerals on SLA deadlines and counts, restrained hover transitions under ~200ms, lucide outline icons (no emoji), and WCAG-conscious contrast on text and badges.

---

## Testing

The suite in [`tests/business-rules.test.ts`](tests/business-rules.test.ts) covers the core business invariants:

1. **Status transitions** — validates `open → in_progress → resolved → open` and rejects illegal jumps.
2. **Enterprise priority invariant** — enterprise tickets cannot be `P2`/`P3`; the normalizer auto-corrects corrupt records to `P1`.
3. **SLA deadlines** — `P0` (1h), `P1` (4h), `P2` (24h), `P3` (72h), plus `at_risk` (<20% remaining) and `late` classification.
4. **Content security** — XSS plain-text handling and dangerous attachment-URL blocking.
5. **Concurrency & conflicts** — optimistic claim rollback, conflicting-agent assignment on 409, and cursor-based update tracking.

```bash
npm run test
```

---

## Project structure

```
freeflow-support-desk/
├── app/
│   ├── api/
│   │   ├── agents/route.ts              # Agent roster endpoint
│   │   └── tickets/
│   │       ├── route.ts                 # Paginated list, search, filter
│   │       ├── updates/route.ts         # Live polling cursor stream
│   │       └── [id]/
│   │           ├── route.ts             # Single ticket fetch
│   │           ├── claim/route.ts       # Claim, force take-over, 409 simulation
│   │           ├── unclaim/route.ts     # Release ticket to the unassigned pool
│   │           ├── status/route.ts      # Status lifecycle transition
│   │           └── triage/route.ts      # Priority/category override
│   ├── tickets/
│   │   ├── page.tsx                      # Dashboard: KPIs, filters, table
│   │   └── [id]/page.tsx                 # Ticket detail workspace
│   ├── review/page.tsx                   # Manual triage review queue
│   ├── layout.tsx                        # Root layout: Redux provider + Toaster
│   ├── page.tsx                          # Redirects to /tickets
│   └── globals.css                       # Theme tokens (light-only) & base styles
├── src/
│   ├── components/
│   │   ├── navigation/
│   │   │   ├── Sidebar.tsx                # App sidebar: brand, nav, promo, profile
│   │   │   └── Header.tsx                 # Top header: search, sync, profile
│   │   └── tickets/
│   │       ├── Badges.tsx                 # Status, Priority, Category, Tier, SLA badges
│   │       ├── MetricsSummary.tsx         # KPI cards with sparklines
│   │       ├── TicketFilters.tsx          # Debounced search & URL-synced filters
│   │       ├── TicketTable.tsx            # Desktop table & mobile card view
│   │       ├── Pagination.tsx             # Page stepper
│   │       └── NewTicketsBanner.tsx       # Live update alert pill
│   ├── lib/
│   │   ├── api-client.ts                  # Typed client API requests
│   │   ├── sla.ts                         # SLA calculator and thresholds
│   │   └── ticket-rules.ts               # Business invariants, validators, sanitizer
│   ├── server/
│   │   ├── mock-db.ts                     # In-memory DB (2,000+ seeded tickets)
│   │   └── api-helpers.ts                 # Latency & transient-error simulation
│   ├── store/
│   │   ├── ticketsSlice.ts               # Redux Toolkit state, actions, reducers
│   │   ├── hooks.ts                       # Typed useAppDispatch / useAppSelector
│   │   ├── index.ts                       # Store configuration
│   │   └── StoreProvider.tsx             # Client store provider
│   └── types/
│       └── ticket.ts                      # Domain models and types
├── public/
│   ├── bg-customer.png                    # Sidebar promo card background
│   └── attachments/                       # Static downloadable attachment assets
├── tests/
│   └── business-rules.test.ts             # Vitest business-invariant tests
├── DECISIONS.md                           # Architecture, UX, and technical decisions
└── README.md
```

---

## Notes

- All data is in-memory and resets on server restart; there are no external dependencies or secrets to configure.
- The mock API simulates realistic latency and occasional transient errors to exercise loading, error, and retry states.
- See [`DECISIONS.md`](DECISIONS.md) for the architectural and UX rationale behind the implementation.
