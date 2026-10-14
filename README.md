# Freeflow Ventures — Support Ticket Dashboard

A production-quality, high-density Support Ticket Dashboard engineered for the **Freeflow Ventures Frontend Assignment**. Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui primitives, and Redux Toolkit.

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) (or [http://localhost:3001](http://localhost:3001) if port 3000 is occupied).

### 3. Run Test Suite
```bash
npm test
```
Executes 15 comprehensive unit tests covering all business invariants, status transitions, SLA calculations, sanitization, and concurrency collisions using Vitest.

### 4. Lint & Type Check
```bash
npm run lint
npx tsc --noEmit
```

---

## 🎯 Core Routes & Features

### 1. Main Tickets Dashboard (`/tickets`)
- **Dataset Scale**: Backed by an in-memory database seeded with **2,000+ realistic tickets** spanning diverse categories, enterprise customer tiers, and realistic SLA timestamps.
- **Top Metrics Summary**: Live counters for total tickets, open tickets, tickets in progress, SLA at-risk, SLA breached, and pending manual reviews.
- **URL-Synced Filter State**:
  - Full-text search debounced at 300ms across subject, description, and customer name.
  - Multi-select filters for Status (`open`, `in_progress`, `resolved`), Priority (`P0`, `P1`, `P2`, `P3`), Category (`technical`, `billing`, `security`, `account`, `feature_request`, `general`), Triage (`automated`, `manual_review`), and SLA status (`on_track`, `at_risk`, `late`).
  - Search and filter queries synchronize bi-directionally with browser URL parameters for shareable links and bookmarking.
- **High-Density Table View**:
  - Displays ID, Subject & Customer info, Priority badge, Status badge, Category, Assignee, SLA countdown timer, and quick navigation.
  - Optimized for desktop data density with monospace IDs and tabular numerical countdowns.
- **Responsive Mobile Layout**:
  - Smooth card-based view tailored down to **375px mobile viewports** with zero horizontal overflow.
- **Live Sync Cursor Polling**:
  - Header indicator tracks simulated live activity and background tickets arriving in real time.

### 2. Ticket Detail Workspace (`/tickets/[id]`)
- **Safe Content Rendering (Security & XSS Protection)**:
  - Customer messages and descriptions are rendered as safe plain text with whitespace preservation.
  - Zero usage of `dangerouslySetInnerHTML`.
  - Injected script tags (`<script>alert('xss')</script>`), `<img>` onerror exploits, and iframe vectors are cleanly neutralized.
  - Attachment URLs are verified against a safe protocol whitelist (blocking `javascript:`, `data:`, `vbscript:`, `file:`).
- **Status Lifecycle Enforcement**:
  - Strict state machine: `open → in_progress → resolved → open`.
  - Illegal shortcuts (e.g., `open → resolved` without work in progress) are rejected with clear error guidance.
- **Optimistic Claiming & 409 Conflict Simulation**:
  - One-click ticket claiming with instant optimistic UI update.
  - **"Simulate 409 Conflict" Button**: Dedicated button allows reviewers to simulate a simultaneous concurrent claim by another agent, demonstrating optimistic rollback and 409 toast handling on demand.
  - **"Take Over Ticket"**: Allows agents to reassign or take over a ticket previously claimed by another agent.
  - **"Release Ticket"**: Enables returning a ticket back to the unassigned queue.
- **Triage & Properties Workspace**:
  - Real-time priority and category updates.
  - **Enterprise SLA Floor**: Prohibits assigning low urgency (`P2` or `P3`) to Enterprise accounts, enforcing the business rule that enterprise tickets must remain `P0` or `P1`.

### 3. Manual Triage Queue (`/review`)
- Dedicated review workspace filtering tickets flagged with `triageDecision: 'manual_review'`.
- Displays explicit human-review reasons (e.g., high-touch account sentiment, security impact keywords, VIP billing escalation).
- Displays AI suggestions for priority and category along with model confidence score.
- Allows one-click triage resolution applying AI recommendations or manual overrides directly.

---

## 🎨 Visual Direction & Design System

- **Color Palette**:
  - **Background**: Soft Warm Ivory (`#F7F6F2` / `hsl(45, 20%, 96%)`)
  - **Surfaces**: Crisp White Cards (`#FFFFFF`) with subtle warm borders (`#E5E3DC`)
  - **Text**: Deep Charcoal (`#202522` / `hsl(150, 6%, 13%)`)
  - **Primary Brand**: Forest Green (`#246B4B` / `hsl(153, 50%, 28%)`)
  - **Warning / Review**: Restrained Warm Amber (`#D97736`)
- **Typography & Details**:
  - Tabular numerals (`tabular-nums`) on all SLA deadlines and ticket counts to eliminate layout jitter.
  - Button micro-interactions with `:active:scale-[0.98]` feedback and transitions < 200ms.
  - High WCAG AA/AAA contrast ratios on badges and typography.

---

## 🧪 Testing Coverage

The test suite in [`tests/business-rules.test.ts`](tests/business-rules.test.ts) verifies:
1. **Status Transitions**: Validates `open → in_progress → resolved → open` and rejects illegal jumps.
2. **Enterprise Priority Invariant**: Confirms enterprise tickets cannot be P2 or P3, and verifies normalization parser auto-adjusts corrupt P2/P3 records to P1.
3. **SLA Deadlines**: Checks P0 (1h), P1 (4h), P2 (24h), and P3 (72h) durations, as well as `at_risk` (<20% remaining) and `late` status classifications.
4. **Content Security**: Tests XSS plain-text sanitization and dangerous attachment URL blocking (`javascript:`, `data:`).
5. **Concurrency & Conflicts**: Validates optimistic claim rollbacks, conflicting agent assignment on 409, and cursor-based update tracking.

Run tests anytime with:
```bash
npm test
```

---

## 📁 Project Structure

```
freeflow-support-desk/
├── app/
│   ├── api/
│   │   ├── agents/route.ts          # Agent roster endpoint
│   │   ├── tickets/
│   │   │   ├── route.ts             # Paginated list, search, filter
│   │   │   ├── updates/route.ts     # Live polling cursor stream
│   │   │   └── [id]/
│   │   │       ├── route.ts         # Single ticket fetch
│   │   │       ├── claim/route.ts   # Claim & conflict handling (with force & simulation)
│   │   │       ├── unclaim/route.ts # Release ticket back to unassigned
│   │   │       ├── status/route.ts  # Status lifecycle transition
│   │   │       └── triage/route.ts  # Priority/category override
│   ├── tickets/
│   │   ├── page.tsx                 # Main table & dashboard view
│   │   └── [id]/page.tsx            # Ticket detail workspace
│   ├── review/
│   │   └── page.tsx                 # Manual triage queue
│   ├── layout.tsx                   # Root layout with Redux & Toaster
│   └── page.tsx                     # Redirect to /tickets
├── src/
│   ├── components/
│   │   ├── navigation/Header.tsx    # App header, active agent switcher, sync pulse
│   │   └── tickets/
│   │       ├── Badges.tsx           # Status, Priority, Category, Tier, SLA badges
│   │       ├── MetricsSummary.tsx   # Top KPI metrics counter cards
│   │       ├── TicketFilters.tsx    # Debounced search & URL-synced filter controls
│   │       ├── TicketTable.tsx      # Desktop table & 375px mobile card view
│   │       ├── Pagination.tsx       # Paginated page stepper
│   │       └── NewTicketsBanner.tsx # Live update alert pill
│   ├── lib/
│   │   ├── api-client.ts            # Typed client API requests
│   │   ├── sla.ts                   # SLA calculator and thresholds
│   │   └── ticket-rules.ts          # Business invariant validators & sanitizer
│   ├── server/
│   │   ├── mock-db.ts               # In-memory database with 2000+ seeded tickets
│   │   └── api-helpers.ts           # Latency & transient error simulator
│   ├── store/
│   │   ├── ticketsSlice.ts          # Redux Toolkit state, actions, reducers
│   │   ├── hooks.ts                 # Typed useDispatch and useSelector
│   │   └── index.ts                 # Redux store configuration
│   └── types/
│       └── ticket.ts                # TypeScript domain models and schemas
├── tests/
│   └── business-rules.test.ts       # 15 Vitest business invariant tests
├── DECISIONS.md                     # Architectural, UX, and technical decisions log
└── README.md
```
