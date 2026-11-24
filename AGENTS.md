# AGENTS.md — CORLIVA Finance Officer Portal

Read this before changing anything. This app is a finished, approved design. Do **not** redesign it, restyle it, swap the layout, add Tailwind, add a UI kit, or "modernise" it. Only make the change you are asked for, in the same style.

## What this is
CORLIVA is a home care platform. This repo is the **Finance Officer** web portal. The signed-in person is **Omar Haddad**, Finance Officer for the whole agency "Royality Home Care" (North Branch and South Branch). It is a clickable React prototype with built-in demo data. It shares its design system with the Agency Admin, Care Coordinator, Care Supervisor, Director of Nursing, HR Officer and Caregiver portals.

From the BRD (BILL-01 to BILL-10, PAY-01 to PAY-10, APP-05 to APP-07, BR-04, BR-05, BR-08, User Flows 6 and 7): the Finance Officer **reviews approved services, prepares invoices, records payments, reviews timesheets and exports payroll data**. They **cannot rewrite care evidence** (visit times, tasks, notes) or approve care — those belong to the Care Supervisor. CORLIVA does **not** take payments, submit insurance claims or work out tax: payments are received outside and recorded here; payroll is one CSV for the payroll provider.

## Stack
- React 19 + Vite + TypeScript. Only extra packages: `react-router-dom` and `lucide-react`. Plain web app at the top level of the repo: `index.html` (with `<div id="root">`) and entry `src/main.tsx`. No backend, no API calls, no `.env`.
- `HashRouter` (keep it — the app must work from any static host and in Figma Make)
- Icons: `lucide-react` only
- Styling: plain CSS in `src/styles.css` using CSS variables. **No Tailwind, no CSS reset libraries, no styled-components.**
- Font: Inter, from the font files in `src/fonts` (`src/fonts/inter.css`, imported in `src/main.tsx`). No Google Fonts link.
- Images live in `public/images/` and are referenced with relative paths like `./images/corliva-logo-white.svg`

## Design system (mirrors the Figma file "Corliva", page "03 · Foundations & Components")
- Page background: brand blue `--bg-page #105CBC`. The sidebar sits directly on the blue.
- Sidebar: width 236px, white text and icons, uppercase section labels (11px semibold), nav items 44px tall. The **active item is a white pill** (radius 37px) with dark text `#292D32`.
- Main content: a rounded light panel `--bg-panel #F8F6F6`, radius 24px, with a white header bar (radius 8px, border `#E5EAF1`, height 59px).
- Cards: white, 1px border `#E5EAF1`, radius 12px.
- Primary action colour `--action-primary #0E66D4`. Status colours: success `#18794A`, warning `#9A5B00`, danger `#C0322B`, each with a soft background.
- Status is always a **word plus a colour** (chips), never colour alone.
- Every token is in `:root` at the top of `src/styles.css`. Use the variables; don't hard-code new colours.

## Writing style
The client is non-technical and over 50. Use short, plain English: "Ready to bill", "Record a payment", "Send back to fix", "Pay before tax". No jargon (no "AR", "accruals", "remittance advice", "gross-to-net").

## Rules that must keep working
- **Branch filter** (sidebar box and header chip): All branches / North / South. It filters every page (`s.inBranch`) and is saved.
- **Only approved visits are billed or paid** (BR-04, APP-05). Visit billing states (`src/data/finance.ts → billState`): Waiting for approval · Sent back to fix · Ready to bill · On a draft invoice · Invoiced · Cancelled visit.
- **A visit can be on only one invoice** (BILL-04, `invoiceFor`). Cancelling an invoice (or a draft) puts its visits back in Ready to bill.
- **Billed and paid time** = approved time to the nearest 15 minutes (`approvedHours`). Each invoice line keeps the client's rate **on the day of the visit** (`rateOn`, BILL-03) and links to the visit (BILL-10).
- **Invoices**: Draft → Sent → Partly paid / Paid / Overdue, or Cancelled. Drafts can lose a line (goes back to Ready to bill) or be cancelled (reason). **Sent invoices are never edited** (BILL-08): use **Add credit** (amount + reason, `CN-…`) or **Cancel invoice** (reason, only when nothing is paid — a full credit is added). Sending sets the due date from the client's payment terms.
- **Payments** (BILL-07): money received outside CORLIVA. Record: client, day received (not in future), amount, how paid, reference, and how it is split across that client's open invoices (oldest first; must add up; can't be more than an invoice owes). A wrong payment is **reversed with a reason**, never deleted.
- **Money owed** (BILL-09): balances grouped Not due yet / 1–30 / 31–60 / 61–90 / over 90 days late; follow-up notes on invoices.
- **Clients' billing** (BILL-01): who pays, bills go to, contact, address, pay within (days), how often. Clients without billing set up can't be billed ("Set up billing"). **Change rate** needs a start date after the last billed visit and a reason; the old rate is kept.
- **Adjustments** (APP-07, BR-08): when the Care Supervisor asks to change an invoiced or paid visit, Finance **Applies** or **Declines** (reason). Applying never changes the visit record: billing gets a correction line on the next invoice (or a credit on the original if it still owes enough); pay gets a correction on the caregiver's timesheet, or — if that pay period was already exported — in a separate **corrections export**.
- **Timesheets** (PAY-01 to PAY-06): made from approved visits per two-week pay period. Show planned, recorded and approved hours apart; Regular / Weekend (+$2/h) / Overtime (over 40 h a week, × 1.5); mileage ($0.70/mile) and allowances (agreed types). Visits not approved yet are listed and **stop approval**. Actions: Approve (or tick several), Send back to fix (reason → Care Supervisor), It's fixed — check again (note), Undo approval (reason, until exported).
- **Payroll exports** (PAY-07 to PAY-09): one agreed CSV layout. Each export is recorded (batch, period, timesheets, who, when). A timesheet is never exported twice; timesheets not approved stay for a later export. Corrections to exported pay go in their own "Corrections" export. **Download a copy** is marked COPY and recorded.
- **Pay rates** (PAY-10): only Finance and the Agency Admin see pay. A new rate needs a start date after the last exported period and a reason; history is kept.
- Nothing is ever deleted. Every change is recorded in the record's history.

## Structure
```
src/
  styles.css               design tokens + all component styles (finance bits at the bottom, incl. print)
  data/seed.ts             demo data: visits (62 days back), billing set-up, invoices, payments, timesheets, exports, adjustments
  data/finance.ts          totals, invoice status, balances, aging, visit billing state, timesheet maths, CSV download
  data/store.tsx           app state (saved in sessionStorage), branch filter, toasts, history, Reset demo data
  components/ui.tsx        Button, Field, Input, Select, Chip, Modal, Tabs, StatTile, AlertBanner, EmptyState, ReasonDialog, Pager, ...
  components/Shell.tsx     sidebar (branch filter) + header (search, branch, date, alerts, profile menu)
  components/FinanceBits.tsx  DetailHead + back link, RecordPayment, CreditModal
  pages/                   Dashboard, ToBill (+ PrepareInvoice), Invoices (+ InvoiceDetail), Money (Payments, PaymentDetail, Owed),
                           Payroll (Timesheets, TimesheetDetail, Exports, ExportDetail), Adjustments, Billing (Clients' billing,
                           ClientBilling, PayRates, CaregiverPay), VisitDetail, Reports, Settings, Auth
```

## Demo data
Same clients, caregivers and visits as the other portals. Demo story: Dorothy Fields (on hold, in hospital) owes on two late invoices — 31–60 and 1–30 days; Harold Jenkins' last invoice is late; Evelyn Price's Medicaid invoices are partly paid; Margaret Hale and Edith Morris have draft invoices to check and send; Samuel Grant's last two weeks aren't billed yet; Gloria Vance (new) has no billing set up; Robert King's rate went from $30 to $32. Payroll: two periods exported (PB-0011, PB-0012); the last period has Grace, Maria and James approved, Ben and Sofia to check, Rosa sent back. Michael Brooks has asked for two adjustments (Robert King — paid and exported; Walter Brooks — invoiced). Every change is saved in **sessionStorage**. **Reset demo data** is in the profile menu and at the bottom of Settings.

## Demo sign-in
Any email and any password → **Sign in** → security code **246810** → **Verify and sign in**. Opens **My work** (signed in as Omar Haddad, Finance Officer).

## Screens (full screens, never side panels; pop-ups only for small decisions)
- **My work** (`/`) — greeting, 4 numbers (ready to bill, money owed, timesheets, adjustments), **Needs you now** (late payments, adjustments, timesheets sent back / to check / ready to export, drafts to send, visits ready to bill, billing not set up), money owed by how late, visits on their way to billing, payroll.
- **Ready to bill** (`/to-bill`) — clients with approved unbilled visits, waiting-for-approval counts; tick and "Make draft invoices", or **Check and bill** → `/to-bill/:clientId` (choose visits and corrections, rate per day, totals, not-ready list) → draft.
- **Invoices** (`/invoices`, `/invoices/:id`) — Drafts / Waiting for payment / Paid / Cancelled / All; the invoice as the client sees it (print), lines linked to visits, totals, payments, credits, follow-up notes, about, history.
- **Payments** (`/payments`, `/payments/:id`) — Received / Reversed; Record a payment; payment screen with the invoices it paid and Reverse payment.
- **Money owed** (`/owed`) — total, aging bar, who owes what by bucket (Record payment), late list to follow up.
- **Clients' billing** (`/billing`, `/clients/:id`) — set-up per client; client screen: owed, late, paid 90 days, approved not billed; tabs Invoices / Payments / Visits and billing; how care is paid, rate history, owed by how late, changes.
- **Timesheets** (`/timesheets`, `/timesheets/:id`) — pay period picker; to check / sent back / approved / exported; timesheet screen with visits, issues, mileage, allowances, pay rules, history.
- **Payroll exports** (`/exports`, `/exports/:id`) — ready to export per period, corrections to export, past exports; export screen with what was in it and copies downloaded.
- **Pay rates** (`/pay-rates`, `/pay-rates/:id`) — rates with weekend rate; caregiver screen with timesheets and rate history.
- **Adjustments** (`/adjustments`) — Waiting for you / Done / Declined; Apply (shows the effect on billing and pay) or Decline.
- **Visit** (`/visits/:id`) — view only: planned / recorded / corrected / billed times, approval, billing, pay, client.
- **Reports** (`/reports`) — approved visits not billed, invoices sent, payments received, money owed by how late, billed by who pays, timesheets, payroll exports; dates and CSV download.
- **Settings** — profile, password, Reset demo data.

## Waiting for the client (BRD open questions)
- Billing units and rounding (now: nearest 15 minutes of approved time), cancellation charges, rate-effective dates.
- Earning categories, overtime rule, mileage rate and the payroll CSV layout (now: weekend +$2/h, over 40 h a week × 1.5, $0.70/mile, the columns in `Payroll.tsx → CSV_HEAD`).
- Invoice layout and how payments are split when one payer pays several invoices.

## Other roles
- **Care Supervisor** — `sadaqat786921/Corliva-care-supervisor-portal` (approves visits; asks Finance for adjustments after invoicing).
- **Agency Admin** — `sadaqat786921/Corliva-agency-admin-portal` (sees each client's billing, view only).
- **Care Coordinator**, **HR Officer**, **Director of Nursing**, **Caregiver** — their own portals (`Corliva-care-cordinator-portal`, `Corliva-hr-officer-portal`, `Corliva-don-portal`, `corliva-caregiver-portal`).

## Run
```
npm install
npm run dev     # preview
npm run build   # must finish with no errors
```
