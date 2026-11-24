import { BillCorrection, Caregiver, Invoice, PayCorrection, Payment, Period, RULES, TODAY, Timesheet, Visit, approvedHours, rateOn } from './seed'

export const money = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const r2 = (n: number) => Math.round(n * 100) / 100
export const hoursText = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(2).replace(/0$/, '')} h`

/* ---------------- Invoices ---------------- */
export type InvoiceStatus = 'Draft' | 'Sent' | 'Partly paid' | 'Paid' | 'Overdue' | 'Cancelled'
export const lineAmount = (l: { hours: number; rate: number }) => r2(l.hours * l.rate)
export const invoiceTotal = (i: Invoice) => r2(i.lines.reduce((a, l) => a + lineAmount(l), 0))
export const creditTotal = (i: Invoice) => r2(i.credits.reduce((a, c) => a + c.amount, 0))
export const livePayments = (pays: Payment[]) => pays.filter(p => !p.reversed)
export const paidOn = (i: Invoice, pays: Payment[]) => r2(livePayments(pays).reduce((a, p) => a + p.allocations.filter(x => x.invoiceId === i.id).reduce((b, x) => b + x.amount, 0), 0))
export const balance = (i: Invoice, pays: Payment[]) => i.state !== 'Sent' ? 0 : r2(invoiceTotal(i) - creditTotal(i) - paidOn(i, pays))
export function invoiceStatus(i: Invoice, pays: Payment[]): InvoiceStatus {
  if (i.state === 'Draft') return 'Draft'
  if (i.state === 'Cancelled') return 'Cancelled'
  const bal = balance(i, pays)
  if (bal <= 0.005) return 'Paid'
  if (i.due && i.due < TODAY) return 'Overdue'
  return paidOn(i, pays) > 0 || creditTotal(i) > 0 ? 'Partly paid' : 'Sent'
}
export const statusTone = (s: InvoiceStatus) => s === 'Paid' ? 'success' : s === 'Overdue' ? 'danger' : s === 'Partly paid' ? 'warning' : s === 'Sent' ? 'info' : 'neutral'
const dayMs = 86400000
const toDate = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).getTime() }
export const daysBetween = (a: string, b: string) => Math.round((toDate(b) - toDate(a)) / dayMs)
export const daysLate = (i: Invoice) => i.due ? Math.max(0, daysBetween(i.due, TODAY)) : 0

/** Money still owed, grouped by how late it is (BILL-09). */
export const AGING = ['Not due yet', '1–30 days late', '31–60 days late', '61–90 days late', 'Over 90 days late'] as const
export type AgingBucket = typeof AGING[number]
export const agingOf = (i: Invoice): AgingBucket => { const d = daysLate(i); return d === 0 ? 'Not due yet' : d <= 30 ? '1–30 days late' : d <= 60 ? '31–60 days late' : d <= 90 ? '61–90 days late' : 'Over 90 days late' }

/* ---------------- Visits from a billing point of view ---------------- */
export type BillState = 'Waiting for approval' | 'Sent back to fix' | 'Ready to bill' | 'On a draft invoice' | 'Invoiced' | 'Cancelled visit' | 'Not finished'
/** The invoice (not cancelled) a visit is on. A visit can only be on one — this stops it being billed twice (BILL-04). */
export const invoiceFor = (v: Visit, invs: Invoice[]) => invs.find(i => i.state !== 'Cancelled' && i.lines.some(l => l.kind === 'Visit' && l.visitId === v.id))
export function billState(v: Visit, invs: Invoice[]): BillState {
  if (v.status === 'Cancelled') return 'Cancelled visit'
  if (v.status !== 'Completed') return 'Not finished'
  if (v.approval === 'Sent back') return 'Sent back to fix'
  if (v.approval !== 'Approved') return 'Waiting for approval'
  const i = invoiceFor(v, invs)
  return !i ? 'Ready to bill' : i.state === 'Draft' ? 'On a draft invoice' : 'Invoiced'
}
export const billTone = (s: BillState) => s === 'Ready to bill' ? 'info' : s === 'Invoiced' ? 'success' : s === 'On a draft invoice' ? 'neutral' : s === 'Sent back to fix' ? 'danger' : s === 'Waiting for approval' ? 'warning' : 'neutral'
/** Approved visits not on any invoice yet, plus agreed corrections — for one client. */
export const readyFor = (clientId: string, visits: Visit[], invs: Invoice[], corr: BillCorrection[]) => ({
  visits: visits.filter(v => v.clientId === clientId && billState(v, invs) === 'Ready to bill').sort((a, b) => a.date.localeCompare(b.date)),
  corrections: corr.filter(c => c.clientId === clientId && !c.invoiceId),
})

/* ---------------- Timesheets ---------------- */
const isWeekend = (d: string) => { const x = new Date(toDate(d)).getDay(); return x === 0 || x === 6 }
const weekOf = (d: string) => { const t = new Date(toDate(d)); t.setDate(t.getDate() - t.getDay()); return t.getTime() }
export interface PayLine { visitId: string; date: string; clientId: string; planned: number; recorded: number | null; approved: number; kind: 'Regular' | 'Weekend' | 'Overtime'; rate: number; amount: number; correction?: string }
export interface Issue { visitId: string; date: string; clientId: string; text: string }

/** Everything on a caregiver's timesheet for a period, worked out from approved visits (PAY-01 to PAY-04). */
export function timesheetDetail(t: Timesheet, g: Caregiver, p: Period, visits: Visit[], corrections: PayCorrection[]) {
  const mine = visits.filter(v => v.caregiverId === g.id && v.date >= p.from && v.date <= p.to && v.status === 'Completed').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  const issues: Issue[] = []
  const lines: PayLine[] = []
  const weekHours = new Map<number, number>()
  for (const v of mine) {
    if (v.approval !== 'Approved') { issues.push({ visitId: v.id, date: v.date, clientId: v.clientId, text: v.approval === 'Sent back' ? 'Sent back to the caregiver to fix — not approved yet' : !v.checkOut ? 'No check-out — waiting for the Care Supervisor' : 'Waiting for the Care Supervisor to approve' }); continue }
    const h = approvedHours(v) ?? 0
    const base = rateOn(g.pay, v.date)
    const wk = weekOf(v.date); const before = weekHours.get(wk) ?? 0; weekHours.set(wk, before + h)
    const over = Math.max(0, before + h - RULES.overtimeAfter) - Math.max(0, before - RULES.overtimeAfter)
    const normal = h - over
    const rec = v.checkIn && v.checkOut ? (Number(v.checkOut.slice(0, 2)) * 60 + Number(v.checkOut.slice(3)) - Number(v.checkIn.slice(0, 2)) * 60 - Number(v.checkIn.slice(3))) / 60 : null
    const planned = (Number(v.end.slice(0, 2)) * 60 + Number(v.end.slice(3)) - Number(v.start.slice(0, 2)) * 60 - Number(v.start.slice(3))) / 60
    if (normal > 0) { const wkd = isWeekend(v.date); const rate = base + (wkd ? RULES.weekendExtra : 0); lines.push({ visitId: v.id, date: v.date, clientId: v.clientId, planned, recorded: rec, approved: normal, kind: wkd ? 'Weekend' : 'Regular', rate, amount: r2(normal * rate) }) }
    if (over > 0) { const rate = r2(base * RULES.overtimeTimes); lines.push({ visitId: v.id, date: v.date, clientId: v.clientId, planned, recorded: rec, approved: over, kind: 'Overtime', rate, amount: r2(over * rate) }) }
  }
  // Agreed corrections for visits on this timesheet (once exported: only the ones exported with it)
  for (const c of corrections.filter(c => c.caregiverId === g.id && c.date >= p.from && c.date <= p.to && (t.state === 'Exported' ? !!t.batchId && c.batchId === t.batchId : !c.batchId))) {
    const rate = rateOn(g.pay, c.date) + (isWeekend(c.date) ? RULES.weekendExtra : 0)
    const v = visits.find(x => x.id === c.visitId)
    lines.push({ visitId: c.visitId, date: c.date, clientId: v?.clientId ?? '', planned: 0, recorded: null, approved: c.hours, kind: isWeekend(c.date) ? 'Weekend' : 'Regular', rate, amount: r2(c.hours * rate), correction: c.text })
  }
  const sum = (k: PayLine['kind']) => lines.filter(l => l.kind === k).reduce((a, l) => a + l.approved, 0)
  const miles = t.mileage.reduce((a, x) => a + x.miles, 0)
  const mileagePay = r2(miles * RULES.mileageRate)
  const allowancePay = r2(t.allowances.reduce((a, x) => a + x.amount, 0))
  const hoursPay = r2(lines.reduce((a, l) => a + l.amount, 0))
  return {
    lines, issues,
    planned: mine.reduce((a, v) => a + (Number(v.end.slice(0, 2)) * 60 + Number(v.end.slice(3)) - Number(v.start.slice(0, 2)) * 60 - Number(v.start.slice(3))) / 60, 0),
    regular: sum('Regular'), weekend: sum('Weekend'), overtime: sum('Overtime'), approved: sum('Regular') + sum('Weekend') + sum('Overtime'),
    miles, mileagePay, allowancePay, hoursPay, gross: r2(hoursPay + mileagePay + allowancePay),
  }
}
export const tsTone = (s: Timesheet['state']) => s === 'Approved' ? 'success' : s === 'Exported' ? 'neutral' : s === 'Returned' ? 'danger' : 'warning'
export const periodLabel = (p: Period, fmt: (d: string, o?: Intl.DateTimeFormatOptions) => string) => `${fmt(p.from, { day: 'numeric', month: 'short' })} – ${fmt(p.to, { day: 'numeric', month: 'short', year: 'numeric' })}`

/* ---------------- CSV ---------------- */
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const text = rows.map(r => r.map(c => { const s = String(c ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }).join(',')).join('\n')
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch { /* preview may block downloads */ }
}
