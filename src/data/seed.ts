// Demo data for the CORLIVA Finance Officer portal.
// The signed-in person is Omar Haddad, Finance Officer for the whole agency (North and South Branch).
// Everything is relative to "today" so the demo always looks current.
// The visits, clients and caregivers are the same people as in the other portals.

export type Role =
  | 'Agency Admin'
  | 'Care Coordinator'
  | 'Care Supervisor'
  | 'HR Officer'
  | 'Finance Officer'
  | 'Caregiver'
  | 'Client / Family'

export interface Branch { id: string; name: string }
export interface User { id: string; name: string; email: string; role: Role; branch: string; status: 'Invited' | 'Active' | 'Switched off'; phone: string }
export interface Note { by: string; at: string; text: string }
export interface PayRate { rate: number; from: string; by: string; note: string }

/* ---- Clients ---- */
export interface Person { id: string; name: string; relationship: string; phone: string; email: string; emergency: boolean; representative: boolean; appAccess: 'No access' | 'Invited' | 'Active' | 'Removed' }
export interface Client {
  id: string; name: string; dob: string; branch: string; status: 'Active' | 'On hold' | 'Discharged'; coordinator: string
  services: string; since: string; phone: string; address: string; payer: string
  language: string; preferences: string; access: string; people: Person[]; fromReferral?: string
  statusReason?: string; history: Note[]
  /** What the home assessment found (copied over when the referral became a client). */
  assessment?: { date: string; by: string; needs: string; risks: string; mobility: string; hours: number | null }
}

/* ---- Caregivers (HR keeps these; Finance keeps their pay rates) ---- */
export interface Caregiver {
  id: string; name: string; branch: string; type: 'Certified aide' | 'Companion' | 'Home health aide'
  skills: string[]; days: number[]; from: string; to: string; maxHours: number
  readiness: 'Ready' | 'Warning' | 'Blocked'; issue?: string; phone: string
  /** Hourly pay, with the date each rate started. Only Finance (and the Agency Admin) see pay. */
  pay: PayRate[]
}


/* ---- Visits (recorded by the caregiver, approved by the Care Supervisor — Finance only reads them) ---- */
export type VisitStatus = 'Scheduled' | 'In progress' | 'Completed' | 'Unassigned' | 'Cancelled'
export interface Adjustment {
  id: string; reason: string; by: string; at: string; before: string; after: string
  status: 'Sent to Finance' | 'Done' | 'Declined'
  decidedBy?: string; decidedAt?: string; note?: string
}
export interface Visit {
  id: string; clientId: string; caregiverId: string | null; date: string; start: string; end: string; branch: string; service: string
  status: VisitStatus; checkIn?: string; checkOut?: string; cancelReason?: string
  approval?: 'To review' | 'Sent back' | 'Approved'
  place?: string; cgNote?: string
  original?: { checkIn?: string; checkOut?: string }
  returned?: { reason: string; by: string; at: string }
  approvedBy?: string; approvedAt?: string
  /** Asked for by the Care Supervisor after the visit was invoiced or paid: Finance applies or declines it. */
  adjustment?: Adjustment
}

/* ---- Billing set-up per client (BILL-01) ---- */
export interface BillingRate { rate: number; from: string; by: string; note: string }
export interface BillingProfile {
  clientId: string; payer: string; billTo: string; billToContact: string; billToAddress: string
  terms: number; period: 'Every 2 weeks' | 'Every month'; rates: BillingRate[]; history: Note[]
}

/* ---- Invoices: every line is linked to the approved visit it came from (BILL-03, BILL-10) ---- */
export interface InvoiceLine { id: string; kind: 'Visit' | 'Correction'; visitId: string; date: string; text: string; hours: number; rate: number }
export interface Credit { id: string; date: string; amount: number; reason: string; by: string }
export interface Invoice {
  id: string; clientId: string; branch: string; from: string; to: string
  payer: string; billTo: string; billToContact: string; terms: number
  state: 'Draft' | 'Sent' | 'Cancelled'
  created: string; createdBy: string; issued?: string; due?: string; issuedBy?: string
  lines: InvoiceLine[]; credits: Credit[]; notes: Note[]; history: Note[]
  cancelReason?: string
}
export interface Payment {
  id: string; clientId: string; date: string; amount: number; method: string; ref: string; by: string; at: string
  allocations: { invoiceId: string; amount: number }[]
  note?: string; reversed?: { reason: string; by: string; at: string }
}
/** A correction Finance has agreed, waiting to go on the client's next invoice (BILL-08). */
export interface BillCorrection { id: string; clientId: string; visitId: string; date: string; text: string; hours: number; rate: number; invoiceId?: string }

/* ---- Timesheets and payroll (PAY-01 to PAY-10) ---- */
export interface Period { id: string; from: string; to: string }
export interface Mileage { id: string; date: string; miles: number; note: string }
export interface Allowance { id: string; type: string; amount: number; note: string }
export interface PayCorrection { id: string; caregiverId: string; visitId: string; date: string; text: string; hours: number; batchId?: string }
export interface Timesheet {
  id: string; caregiverId: string; periodId: string
  state: 'To check' | 'Returned' | 'Approved' | 'Exported'
  mileage: Mileage[]; allowances: Allowance[]
  returned?: { reason: string; by: string; at: string }
  approvedBy?: string; approvedAt?: string; batchId?: string
  history: Note[]
}
export interface ExportBatch {
  id: string; kind: 'Payroll' | 'Corrections'; periodId: string; timesheetIds: string[]; correctionIds: string[]
  by: string; at: string; file: string; caregivers: number; hours: number; gross: number; downloads: Note[]
}

export interface AuditEntry { id: string; at: string; actor: string; action: string; record: string; type: string; before?: string; after?: string; reason?: string }
export interface Inbox { id: string; title: string; body: string; at: string; read: boolean; link: string; tone: 'danger' | 'warning' | 'info' | 'success' }

const pad = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) }
export const TODAY = addDays(0)
export const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
const shift = (hm: string, mins: number) => { const [h, m] = hm.split(':').map(Number); const t = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + mins)); return `${pad(Math.floor(t / 60))}:${pad(t % 60)}` }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Display stamp like "12 Nov, 10:15" for a day offset from today. */
export const stampFor = (dayOffset: number, time: string) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); return `${d.getDate()} ${MON[d.getMonth()]}, ${time}` }

export const ME = { name: 'Omar Haddad', role: 'Finance Officer' as Role, branch: 'all', email: 'omar@royalityhomecare.com', phone: '(217) 555-0105', initials: 'OH' }

export const branches: Branch[] = [{ id: 'north', name: 'North Branch' }, { id: 'south', name: 'South Branch' }]
export const users: User[] = [
  { id: 'u0', name: 'Fred Morgan', email: 'fred@royalityhomecare.com', role: 'Agency Admin', branch: 'all', status: 'Active', phone: '(217) 555-0100' },
  { id: 'u1', name: 'Aisha Rahman', email: 'aisha@royalityhomecare.com', role: 'Care Coordinator', branch: 'north', status: 'Active', phone: '(217) 555-0101' },
  { id: 'u2', name: 'Michael Brooks', email: 'michael@royalityhomecare.com', role: 'Care Supervisor', branch: 'all', status: 'Active', phone: '(217) 555-0102' },
  { id: 'u3', name: 'Lena Ortiz', email: 'lena@royalityhomecare.com', role: 'HR Officer', branch: 'north', status: 'Active', phone: '(217) 555-0103' },
  { id: 'u4', name: 'Daniel Reed', email: 'daniel@royalityhomecare.com', role: 'Care Coordinator', branch: 'south', status: 'Active', phone: '(217) 555-0104' },
  { id: 'u5', name: 'Omar Haddad', email: 'omar@royalityhomecare.com', role: 'Finance Officer', branch: 'all', status: 'Active', phone: '(217) 555-0105' },
]

/** Agreed rules (set with the agency; shown read-only in Settings). The client still has to confirm some of these. */
export const RULES = {
  billingUnitMins: 15,          // approved time is billed and paid to the nearest 15 minutes
  weekendExtra: 2,              // extra pay per hour on Saturday and Sunday
  overtimeAfter: 40,            // hours in a week (Sunday to Saturday) before overtime
  overtimeTimes: 1.5,
  mileageRate: 0.70,            // pay per mile driven between visits
  allowanceTypes: ['Phone allowance', 'Travel time', 'Training hours', 'Uniform', 'Other'],
  paymentMethods: ['Bank transfer', 'Cheque', 'Card (taken outside CORLIVA)', 'Cash', 'Insurance payment', 'Medicaid payment', 'VA payment'],
  payers: ['Private pay', 'Long-term care insurance', 'Medicaid waiver', 'Veterans benefits'],
}

/* ---- Two-week periods. P1 is the last finished one; P0 is still running. ---- */
const pEnd = (k: number) => -7 - 14 * (k - 1)
export const periods: Period[] = [0, 1, 2, 3, 4].map(k => ({ id: 'P' + k, from: addDays(pEnd(k) - 13), to: addDays(pEnd(k)) }))

export const caregivers: Caregiver[] = [
  { id: 'g1', name: 'Grace Mensah', branch: 'north', type: 'Certified aide', skills: ['Personal care', 'Medication reminders', 'Homemaking', 'Companionship'], days: [1, 2, 3, 4, 5, 6], from: '07:00', to: '15:00', maxHours: 40, readiness: 'Ready', phone: '(217) 555-0201', pay: [{ rate: 18.5, from: addDays(-400), by: 'Fred Morgan', note: 'Starting rate' }] },
  { id: 'g2', name: 'Daniel Osei', branch: 'north', type: 'Certified aide', skills: ['Personal care', 'Medication reminders', 'Respite care'], days: [1, 2, 3, 4, 5], from: '08:00', to: '18:00', maxHours: 40, readiness: 'Blocked', issue: 'First-aid certificate expired', phone: '(217) 555-0202', pay: [{ rate: 18, from: addDays(-400), by: 'Fred Morgan', note: 'Starting rate' }] },
  { id: 'g3', name: 'Maria Lopez', branch: 'north', type: 'Certified aide', skills: ['Personal care', 'Medication reminders', 'Companionship', 'Homemaking'], days: [0, 1, 2, 3, 4, 5, 6], from: '10:00', to: '19:00', maxHours: 40, readiness: 'Ready', phone: '(217) 555-0203', pay: [{ rate: 18, from: addDays(-27), by: 'Omar Haddad', note: 'Yearly pay review' }, { rate: 17.25, from: addDays(-400), by: 'Fred Morgan', note: 'Starting rate' }] },
  { id: 'g7', name: 'Hannah Lee', branch: 'north', type: 'Companion', skills: ['Companionship', 'Homemaking'], days: [1, 2, 3, 4, 5], from: '09:00', to: '17:00', maxHours: 30, readiness: 'Blocked', issue: 'Background check not verified', phone: '(217) 555-0207', pay: [{ rate: 16, from: addDays(-400), by: 'Fred Morgan', note: 'Starting rate' }] },
  { id: 'g9', name: 'Rosa Diaz', branch: 'north', type: 'Home health aide', skills: ['Personal care', 'Medication reminders', 'Respite care', 'Homemaking'], days: [0, 1, 2, 3, 4, 5, 6], from: '06:00', to: '14:00', maxHours: 40, readiness: 'Ready', phone: '(217) 555-0209', pay: [{ rate: 19.5, from: addDays(-400), by: 'Fred Morgan', note: 'Starting rate' }] },
  { id: 'g10', name: 'Ben Okafor', branch: 'north', type: 'Certified aide', skills: ['Personal care', 'Companionship', 'Respite care'], days: [1, 2, 3, 4, 5, 6], from: '09:00', to: '17:00', maxHours: 35, readiness: 'Warning', issue: 'Annual training due in 9 days', phone: '(217) 555-0210', pay: [{ rate: 18, from: addDays(-400), by: 'Fred Morgan', note: 'Starting rate' }] },
  { id: 'g11', name: 'Lily Chen', branch: 'north', type: 'Companion', skills: ['Companionship', 'Homemaking'], days: [0, 2, 4, 6], from: '12:00', to: '20:00', maxHours: 24, readiness: 'Ready', phone: '(217) 555-0211', pay: [{ rate: 16, from: addDays(-400), by: 'Fred Morgan', note: 'Starting rate' }] },
  { id: 'g5', name: 'Sofia Novak', branch: 'south', type: 'Certified aide', skills: ['Personal care', 'Homemaking'], days: [1, 2, 3, 4, 5], from: '08:00', to: '16:00', maxHours: 40, readiness: 'Ready', phone: '(217) 555-0205', pay: [{ rate: 18.5, from: addDays(-400), by: 'Fred Morgan', note: 'Starting rate' }] },
  { id: 'g6', name: 'James Carter', branch: 'south', type: 'Companion', skills: ['Companionship', 'Homemaking'], days: [0, 1, 2, 3, 4, 5, 6], from: '09:00', to: '18:00', maxHours: 35, readiness: 'Ready', phone: '(217) 555-0206', pay: [{ rate: 16.5, from: addDays(-400), by: 'Fred Morgan', note: 'Starting rate' }] },
]


const P = (id: string, name: string, relationship: string, phone: string, email: string, emergency: boolean, representative: boolean, appAccess: Person['appAccess']): Person => ({ id, name, relationship, phone, email, emergency, representative, appAccess })
export const clients: Client[] = [
  { id: 'c1', name: 'Margaret Hale', dob: '1937-05-02', branch: 'north', status: 'Active', coordinator: 'Aisha Rahman', services: 'Personal care, Medication reminders', since: 'Mar 2025', phone: '(217) 555-0311', address: '14 Elm St, Springfield, IL 62701', payer: 'Long-term care insurance', language: 'English', preferences: 'Prefers female caregivers. Likes a cup of tea after her bath.', access: 'Key safe by the front door, code given by phone. Small dog — friendly.',
    people: [P('p1', 'Susan Hale', 'Daughter', '(217) 555-0611', 'susan.hale@example.com', true, true, 'Active'), P('p2', 'Tom Hale', 'Son', '(217) 555-0612', '', true, false, 'No access')], history: [] },
  { id: 'c2', name: 'Robert King', dob: '1944-10-19', branch: 'north', status: 'Active', coordinator: 'Aisha Rahman', services: 'Companionship', since: 'Jan 2026', phone: '(217) 555-0312', address: '9 Oak Lane, Springfield, IL 62702', payer: 'Private pay', language: 'English', preferences: 'Loves baseball and short walks to the park.', access: 'Ring the bell twice. Hard of hearing.',
    people: [P('p3', 'Mark King', 'Son', '(217) 555-0613', 'mark.king@example.com', true, true, 'Active')], history: [] },
  { id: 'c5', name: 'Dorothy Fields', dob: '1935-02-11', branch: 'north', status: 'On hold', coordinator: 'Aisha Rahman', services: 'Personal care', since: 'Nov 2024', phone: '(217) 555-0315', address: '31 Maple Dr, Springfield, IL 62704', payer: 'Private pay', language: 'English', preferences: '', access: 'Son lets carers in.', statusReason: 'In hospital since 2 Nov',
    people: [P('p4', 'Jim Fields', 'Son', '(217) 555-0615', 'jim.fields@example.com', true, true, 'Invited')], history: [{ by: 'Aisha Rahman', at: '2 Nov, 09:10', text: 'Put on hold. Reason: in hospital since 2 Nov.' }] },
  { id: 'c6', name: 'Harold Jenkins', dob: '1940-08-19', branch: 'north', status: 'Active', coordinator: 'Aisha Rahman', services: 'Medication reminders', since: 'Sep 2026', phone: '(217) 555-0316', address: '88 Cedar Ave, Springfield, IL 62701', payer: 'Private pay', language: 'English', preferences: 'Afternoon visits only.', access: 'Wife at home to let carers in.',
    people: [P('p5', 'Linda Jenkins', 'Wife', '(217) 555-0418', '', true, true, 'No access')], fromReferral: 'R-1020', history: [] },
  { id: 'c9', name: 'Edith Morris', dob: '1939-12-07', branch: 'north', status: 'Active', coordinator: 'Aisha Rahman', services: 'Personal care', since: 'May 2026', phone: '(217) 555-0319', address: '40 Grove St, Springfield, IL 62702', payer: 'Long-term care insurance', language: 'English', preferences: 'Early riser. Likes porridge for breakfast.', access: 'Key under the blue pot (agreed with family).',
    people: [P('p6', 'Paul Morris', 'Son', '(217) 555-0619', 'paul.morris@example.com', true, true, 'Active')], history: [] },
  { id: 'c12', name: 'Samuel Grant', dob: '1942-03-28', branch: 'north', status: 'Active', coordinator: 'Sara Kim', services: 'Personal care', since: 'Dec 2025', phone: '(217) 555-0322', address: '27 Park Ave, Springfield, IL 62701', payer: 'Private pay', language: 'English, some Spanish', preferences: 'Uses a walking frame indoors.', access: 'Wife at home.',
    people: [P('p7', 'Ruth Grant', 'Wife', '(217) 555-0622', '', true, true, 'No access')], history: [] },
  { id: 'c13', name: 'Gloria Vance', dob: '1946-07-15', branch: 'north', status: 'Active', coordinator: 'Aisha Rahman', services: 'Personal care, Homemaking', since: 'Nov 2026', phone: '(217) 555-0323', address: '', payer: 'Medicaid waiver', language: 'English', preferences: '', access: '',
    people: [P('p8', 'Rita Vance', 'Sister', '(217) 555-0623', 'rita.vance@example.com', true, true, 'No access')], fromReferral: 'R-1010', history: [],
    assessment: { date: addDays(-6), by: 'Michael Brooks', needs: 'Help washing and dressing; light housework while her hip heals.', risks: 'Moving home to a ground-floor flat. Address to confirm.', mobility: 'Walks with a frame', hours: 10 } },
  { id: 'c3', name: 'Evelyn Price', dob: '1941-01-09', branch: 'south', status: 'Active', coordinator: 'Daniel Reed', services: 'Homemaking, Personal care', since: 'Aug 2025', phone: '(217) 555-0313', address: '72 River Rd, Springfield, IL 62703', payer: 'Medicaid waiver', language: 'English', preferences: 'Likes the radio on. Keeps a tidy kitchen.', access: 'Front door unlocked from 8am.',
    people: [P('p9', 'Carl Price', 'Nephew', '(217) 555-0624', 'carl.price@example.com', true, true, 'Active')], history: [] },
  { id: 'c14', name: 'Walter Brooks', dob: '1938-09-23', branch: 'south', status: 'Active', coordinator: 'Daniel Reed', services: 'Companionship', since: 'Jun 2026', phone: '(217) 555-0324', address: '5 Mill Lane, Springfield, IL 62703', payer: 'Veterans benefits', language: 'English', preferences: 'Enjoys card games and talking about the navy.', access: 'Daughter leaves a key with the neighbour at no. 7.',
    people: [P('p10', 'Joan Brooks', 'Daughter', '(217) 555-0625', 'joan.brooks@example.com', true, true, 'Active')], history: [] },
]


// Weekly visit pattern per client: [weekdays (0=Sun), start, end, service, regular caregiver]
const PATTERN: Record<string, [number[], string, string, string, string]> = {
  c1: [[1, 2, 3, 4, 5, 6, 0], '09:00', '11:00', 'Personal care', 'g1'],
  c2: [[1, 3, 5], '11:00', '13:00', 'Companionship', 'g3'],
  c5: [[1, 3, 5], '10:00', '12:00', 'Personal care', 'g9'],
  c6: [[1, 2, 3, 4, 5, 6, 0], '15:00', '16:00', 'Medication reminders', 'g3'],
  c9: [[1, 2, 3, 4, 5], '07:00', '08:30', 'Personal care', 'g9'],
  c12: [[2, 3, 4, 5, 6], '09:30', '12:30', 'Personal care', 'g10'],
  c3: [[1, 3, 5], '08:00', '10:00', 'Homemaking', 'g5'],
  c14: [[2, 4, 6], '14:00', '16:00', 'Companionship', 'g6'],
}
// Past visits cancelled because nobody was free (same as the other portals)
const MISSED: [number, string][] = [[-4, 'c12'], [-2, 'c2']]
const HOME = 'At the client’s home'
const REVIEW_DAYS = 5
const ON_HOLD_FROM = -22  // Dorothy Fields went into hospital

function buildVisits(): Visit[] {
  const out: Visit[] = []
  const now = nowHM()
  let n = 4000
  for (let day = -62; day <= 0; day++) {
    const d = new Date(); d.setDate(d.getDate() + day)
    for (const [cid, [days, start, end, service, cg]] of Object.entries(PATTERN)) {
      if (!days.includes(d.getDay())) continue
      if (cid === 'c5' && day >= ON_HOLD_FROM) continue
      n += 1
      const c = clients.find(x => x.id === cid)!
      const v: Visit = { id: 'v' + n, clientId: cid, caregiverId: cg, date: iso(d), start, end, branch: c.branch, service, status: 'Scheduled' }
      if (MISSED.some(([o, x]) => o === day && x === cid)) { v.status = 'Cancelled'; v.caregiverId = null; v.cancelReason = 'No caregiver available'; out.push(v); continue }
      if (day === 0 && end > now) { out.push(v); continue }
      v.status = 'Completed'; v.checkIn = shift(start, 2); v.checkOut = shift(end, 1); v.place = HOME
      if (day >= -REVIEW_DAYS) v.approval = 'To review'
      else { v.approval = 'Approved'; v.approvedBy = 'Michael Brooks'; v.approvedAt = stampFor(day + 1, '10:00') }
      out.push(v)
    }
  }
  // The same things the Care Supervisor sees on this week's visits
  const latest = (cid: string) => out.filter(v => v.clientId === cid && v.approval === 'To review' && v.date < TODAY).sort((a, b) => b.date.localeCompare(a.date))[0]
  const b = latest('c6'); if (b) b.checkOut = undefined
  const e = latest('c3'); if (e) { e.approval = 'Sent back'; e.checkOut = '17:10'; e.returned = { reason: 'Check-out at 17:10 looks wrong — the visit ends at 10:00. Please ask Sofia what time she really left and correct it.', by: 'Michael Brooks', at: stampFor(-1, '11:20') } }
  // A visit the Care Supervisor corrected before approving (original times kept)
  const fix = out.find(v => v.clientId === 'c9' && v.approval === 'Approved' && v.date >= addDays(-20))
  if (fix) { fix.original = { checkOut: '10:45' }; fix.checkOut = '08:31'; fix.cgNote = 'Forgot to check out — left at 08:30.' }
  // Adjustments the Care Supervisor asked for after the visits were invoiced
  const p2 = periods[2], p1 = periods[1]
  const a1 = out.find(v => v.clientId === 'c2' && v.approval === 'Approved' && v.date >= p2.from && v.date <= p2.to)
  if (a1) a1.adjustment = { id: 'ADJ-31', reason: 'Mark King asked Maria to stay 30 minutes longer that day. We missed it before the visit was invoiced and paid.', by: 'Michael Brooks', at: stampFor(-2, '15:05'), before: `${a1.checkIn} – ${a1.checkOut}`, after: `${a1.checkIn} – ${shift(a1.checkOut!, 30)}`, status: 'Sent to Finance' }
  const a2 = out.filter(v => v.clientId === 'c14' && v.approval === 'Approved' && v.date >= p1.from && v.date <= p1.to)[1]
  if (a2) a2.adjustment = { id: 'ADJ-32', reason: 'James left an hour early — Walter went to a family lunch. Joan (daughter) told the coordinator the next day.', by: 'Michael Brooks', at: stampFor(-1, '09:40'), before: `${a2.checkIn} – ${a2.checkOut}`, after: `${a2.checkIn} – ${shift(a2.checkOut!, -60)}`, status: 'Sent to Finance' }
  return out
}
export const visits: Visit[] = buildVisits()

/* ---- How each client's care is paid for ---- */
const PROF: Record<string, [string, number, string, string, string]> = {
  // clientId: [payer, hourly rate, bills go to, contact, address]
  c1: ['Long-term care insurance', 30, 'Lifeway Insurance (claims team)', 'claims@lifeway.example · policy LW-448120', 'PO Box 2210, Chicago, IL 60601'],
  c2: ['Private pay', 32, 'Mark King (son)', '(217) 555-0613 · mark.king@example.com', '9 Oak Lane, Springfield, IL 62702'],
  c5: ['Private pay', 32, 'Jim Fields (son)', '(217) 555-0615 · jim.fields@example.com', '31 Maple Dr, Springfield, IL 62704'],
  c6: ['Private pay', 32, 'Linda Jenkins (wife)', '(217) 555-0418', '88 Cedar Ave, Springfield, IL 62701'],
  c9: ['Long-term care insurance', 30, 'Prairie Mutual (claims)', 'claims@prairiemutual.example · policy PM-30217', '400 Main St, Peoria, IL 61602'],
  c12: ['Private pay', 32, 'Ruth Grant (wife)', '(217) 555-0622', '27 Park Ave, Springfield, IL 62701'],
  c3: ['Medicaid waiver', 26, 'Illinois Medicaid waiver program', 'Waiver ID IL-WV-20931', 'Illinois HFS, 201 S Grand Ave E, Springfield, IL 62763'],
  c14: ['Veterans benefits', 30, 'VA Community Care', 'Authorization VA-77310', 'VA Community Care, PO Box 30780, Tampa, FL 33630'],
}
export const billingProfiles: BillingProfile[] = Object.entries(PROF).map(([clientId, [payer, rate, billTo, billToContact, billToAddress]]) => ({
  clientId, payer, billTo, billToContact, billToAddress, terms: payer === 'Private pay' ? 14 : 30, period: 'Every 2 weeks' as const,
  // Robert King's rate went up from $30 to $32 — older invoice lines keep $30
  rates: clientId === 'c2' ? [{ rate: 32, from: addDays(-40), by: 'Omar Haddad', note: 'New yearly rate agreed with Mark King' }, { rate: 30, from: addDays(-300), by: 'Omar Haddad', note: 'First rate' }]
    : [{ rate, from: addDays(-500), by: 'Omar Haddad', note: 'First rate' }],
  history: [],
}))

/* ---- Rounding, rates and hours ---- */
const m = (hm: string) => { const [h, mm] = hm.split(':').map(Number); return h * 60 + mm }
/** Approved time to the nearest 15 minutes, in hours. Null if the visit has no check-out. */
export const approvedHours = (v: Visit) => v.checkIn && v.checkOut ? Math.round((m(v.checkOut) - m(v.checkIn)) / RULES.billingUnitMins) * RULES.billingUnitMins / 60 : null
export const plannedHours = (v: Visit) => (m(v.end) - m(v.start)) / 60
export const rateOn = (rates: { rate: number; from: string }[], date: string) => [...rates].sort((a, b) => b.from.localeCompare(a.from)).find(r => r.from <= date)?.rate ?? rates[rates.length - 1]?.rate ?? 0

/* ---- Invoices, payments and credits that already happened ---- */
const METHOD: Record<string, string> = { 'Private pay': 'Bank transfer', 'Long-term care insurance': 'Insurance payment', 'Medicaid waiver': 'Medicaid payment', 'Veterans benefits': 'VA payment' }
function buildBilling() {
  const invoices: Invoice[] = []; const payments: Payment[] = []
  let inv = 2000, pay = 900, line = 0
  for (const k of [4, 3, 2, 1]) {
    const p = periods[k]
    for (const prof of billingProfiles) {
      const cid = prof.clientId
      if (k === 1 && cid === 'c12') continue            // Samuel Grant: not invoiced yet (ready to bill)
      const vs = visits.filter(v => v.clientId === cid && v.approval === 'Approved' && v.date >= p.from && v.date <= p.to)
      if (!vs.length) continue
      const c = clients.find(x => x.id === cid)!
      const draft = k === 1 && (cid === 'c1' || cid === 'c9')
      const issued = addDays(pEnd(k) + 1)
      const id = 'INV-' + (++inv)
      const lines: InvoiceLine[] = vs.map(v => ({ id: 'L' + (++line), kind: 'Visit', visitId: v.id, date: v.date, text: v.service, hours: approvedHours(v)!, rate: rateOn(prof.rates, v.date) }))
      const i: Invoice = { id, clientId: cid, branch: c.branch, from: p.from, to: p.to, payer: prof.payer, billTo: prof.billTo, billToContact: prof.billToContact, terms: prof.terms,
        state: draft ? 'Draft' : 'Sent', created: issued, createdBy: 'Omar Haddad', lines, credits: [], notes: [], history: [{ by: 'Omar Haddad', at: stampFor(pEnd(k) + 1, '09:30'), text: draft ? 'Draft made from approved visits.' : 'Made from approved visits and sent.' }] }
      if (!draft) { i.issued = issued; i.due = addDays(pEnd(k) + 1 + prof.terms); i.issuedBy = 'Omar Haddad' }
      invoices.push(i)
      if (draft) continue
      const total = Math.round(lines.reduce((a, l) => a + l.hours * l.rate, 0) * 100) / 100
      // Who has paid what: a realistic mix of paid, partly paid, overdue and not due yet
      let paid = 0
      if (k >= 3) paid = cid === 'c5' ? 0 : cid === 'c3' && k === 3 ? Math.round(total * 0.6) : total
      else if (k === 2) paid = cid === 'c3' ? Math.round(total * 0.5) : cid === 'c6' || cid === 'c5' || cid === 'c1' || cid === 'c9' || cid === 'c14' ? 0 : total
      if (paid > 0) {
        const method = METHOD[prof.payer]
        const when = pEnd(k) + 1 + Math.min(prof.terms - 2, 9)
        payments.push({ id: 'PAY-' + (++pay), clientId: cid, date: addDays(when), amount: paid, method, ref: method === 'Bank transfer' ? 'TRF-' + (5000 + pay) : 'REM-' + (8000 + pay), by: 'Omar Haddad', at: stampFor(when, '11:00'), allocations: [{ invoiceId: id, amount: paid }] })
      }
    }
  }
  // Follow-up notes on the overdue ones
  const late = invoices.find(i => i.clientId === 'c5' && i.from === periods[3].from)
  if (late) late.notes.push({ by: 'Omar Haddad', at: stampFor(-10, '14:20'), text: 'Called Jim Fields. Dorothy is in hospital; he will pay when he is back from visiting her.' })
  return { invoices, payments }
}
const built = buildBilling()
export const invoices: Invoice[] = built.invoices
export const payments: Payment[] = built.payments
export const billCorrections: BillCorrection[] = []

/* ---- Timesheets: P2 and P3 exported; P1 being checked now ---- */
export const timesheets: Timesheet[] = []
export const exportBatches: ExportBatch[] = []
export const payCorrections: PayCorrection[] = []
;(function buildPayroll() {
  const working = caregivers.filter(g => visits.some(v => v.caregiverId === g.id && v.approval === 'Approved'))
  for (const k of [3, 2, 1]) {
    const p = periods[k]
    const ids: string[] = []
    for (const g of working) {
      if (!visits.some(v => v.caregiverId === g.id && v.approval === 'Approved' && v.date >= p.from && v.date <= p.to)) continue
      const t: Timesheet = { id: `TS-${p.id}-${g.id}`, caregiverId: g.id, periodId: p.id, state: 'To check', mileage: [], allowances: [], history: [] }
      if (g.id === 'g5' || g.id === 'g9') t.mileage.push({ id: 'mi' + g.id + k, date: p.to, miles: g.id === 'g5' ? 46 : 62, note: 'Mileage claim from the caregiver' })
      if (k >= 2) { t.state = 'Exported'; t.approvedBy = 'Omar Haddad'; t.approvedAt = stampFor(pEnd(k) + 2, '10:00'); t.batchId = k === 3 ? 'PB-0011' : 'PB-0012' }
      else if (['g1', 'g3', 'g6'].includes(g.id)) { t.state = 'Approved'; t.approvedBy = 'Omar Haddad'; t.approvedAt = stampFor(-4, '16:10') }
      else if (g.id === 'g9') { t.state = 'Returned'; t.returned = { reason: 'Rosa says she also covered Edith Morris on a Saturday, but there is no visit record. Please check and add the visit if it happened.', by: 'Omar Haddad', at: stampFor(-3, '11:45') } }
      if (g.id === 'g10' && k === 1) t.allowances.push({ id: 'al1', type: 'Training hours', amount: 36, note: 'Moving and handling refresher (2 hours)' })
      t.history.push({ by: 'Omar Haddad', at: stampFor(pEnd(k) + 1, '09:00'), text: 'Timesheet made from approved visits.' })
      if (t.state === 'Returned') t.history.push({ by: 'Omar Haddad', at: t.returned!.at, text: `Sent back to Michael Brooks: ${t.returned!.reason}` })
      timesheets.push(t); ids.push(t.id)
    }
    if (k >= 2) exportBatches.unshift({ id: k === 3 ? 'PB-0011' : 'PB-0012', kind: 'Payroll', periodId: p.id, timesheetIds: ids, correctionIds: [], by: 'Omar Haddad', at: stampFor(pEnd(k) + 2, '10:30'), file: `payroll-${p.from}-to-${p.to}.csv`, caregivers: ids.length, hours: 0, gross: 0, downloads: [] })
  }
})()

export const audit: AuditEntry[] = []

export const inbox: Inbox[] = [
  { id: 'n1', title: 'Adjustment asked for: Robert King', body: 'From Michael Brooks — visit already invoiced and paid', at: '2 days ago', read: false, link: '/adjustments', tone: 'warning' },
  { id: 'n2', title: 'Adjustment asked for: Walter Brooks', body: 'From Michael Brooks — visit already invoiced', at: 'Yesterday', read: false, link: '/adjustments', tone: 'warning' },
  { id: 'n3', title: 'Visits approved — ready to bill', body: 'Michael Brooks approved last week’s visits', at: 'Today', read: false, link: '/to-bill', tone: 'info' },
  { id: 'n4', title: 'Gloria Vance starts care soon', body: 'Billing is not set up yet', at: 'Yesterday', read: true, link: '/billing', tone: 'info' },
]
