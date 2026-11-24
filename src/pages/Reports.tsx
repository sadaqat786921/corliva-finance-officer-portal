import { useState } from 'react'
import { Download, BarChart3 } from 'lucide-react'
import { useStore, fmtDate } from '../data/store'
import { TODAY, addDays, approvedHours, rateOn } from '../data/seed'
import { AGING, agingOf, balance, billState, creditTotal, daysLate, downloadCsv, invoiceStatus, invoiceTotal, money, paidOn, periodLabel, r2, timesheetDetail } from '../data/finance'
import { Button, Field, Input, PageHead, Select } from '../components/ui'
import { useBatchRows } from './Payroll'

type R = 'bill' | 'invoices' | 'payments' | 'owed' | 'timesheets' | 'exports' | 'payers'
const REPORTS: { id: R; name: string; about: string; dated: boolean }[] = [
  { id: 'bill', name: 'Approved visits not billed', about: 'Billing completeness — approved visits that aren’t on an invoice yet.', dated: true },
  { id: 'invoices', name: 'Invoices sent', about: 'Every invoice sent in the dates chosen, with credits, payments and what’s still owed.', dated: true },
  { id: 'payments', name: 'Payments received', about: 'Money received outside CORLIVA and the invoices it paid.', dated: true },
  { id: 'owed', name: 'Money owed by how late', about: 'Balances on sent invoices today, grouped by how late they are.', dated: false },
  { id: 'payers', name: 'Billed by who pays', about: 'How much was invoiced to each kind of payer in the dates chosen.', dated: true },
  { id: 'timesheets', name: 'Timesheets', about: 'Planned and approved hours, mileage, allowances and pay before tax, by pay period.', dated: false },
  { id: 'exports', name: 'Payroll exports', about: 'Every export sent to payroll, with who did it and when.', dated: false },
]
const d = (x?: string) => x ? fmtDate(x, { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export default function Reports() {
  const s = useStore()
  const rowsOf = useBatchRows()
  const [r, setR] = useState<R>('bill')
  const [from, setFrom] = useState(addDays(-60))
  const [to, setTo] = useState(TODAY)
  const [period, setPeriod] = useState('P1')
  const def = REPORTS.find(x => x.id === r)!
  const inDates = (x?: string) => !!x && x >= from && x <= to
  const inv = s.invoices.filter(i => s.inBranch(i.branch))

  let head: string[] = []; let rows: (string | number)[][] = []
  if (r === 'bill') {
    head = ['Client', 'Visit date', 'Caregiver', 'Approved hours', 'Rate', 'Amount', 'Who pays']
    rows = s.visits.filter(v => s.inBranch(v.branch) && inDates(v.date) && billState(v, s.invoices) === 'Ready to bill').sort((a, b) => a.date.localeCompare(b.date)).map(v => { const p = s.profile(v.clientId); const h = approvedHours(v) ?? 0; const rate = p ? rateOn(p.rates, v.date) : 0; return [s.client(v.clientId)!.name, d(v.date), s.caregiver(v.caregiverId)?.name ?? '', h, p ? money(rate) : 'Not set up', p ? money(r2(h * rate)) : '', p?.payer ?? ''] })
  } else if (r === 'invoices') {
    head = ['Invoice', 'Client', 'Bills go to', 'Sent', 'Due', 'Total', 'Credits', 'Paid', 'Still owed', 'Status']
    rows = inv.filter(i => inDates(i.issued)).sort((a, b) => a.id.localeCompare(b.id)).map(i => [i.id, s.client(i.clientId)!.name, i.billTo, d(i.issued), d(i.due), money(invoiceTotal(i)), money(creditTotal(i)), money(paidOn(i, s.payments)), money(balance(i, s.payments)), invoiceStatus(i, s.payments)])
  } else if (r === 'payments') {
    head = ['Payment', 'Received', 'Client', 'How paid', 'Reference', 'Invoices', 'Amount', 'Recorded by', 'Reversed']
    rows = s.payments.filter(p => s.inBranch(s.client(p.clientId)?.branch ?? '') && inDates(p.date)).sort((a, b) => a.date.localeCompare(b.date)).map(p => [p.id, d(p.date), s.client(p.clientId)!.name, p.method, p.ref, p.allocations.map(a => a.invoiceId).join(' '), money(p.amount), p.by, p.reversed ? `Yes: ${p.reversed.reason}` : ''])
  } else if (r === 'owed') {
    head = ['Invoice', 'Client', 'Bills go to', 'Due', 'Days late', 'How late', 'Still owed']
    rows = inv.filter(i => balance(i, s.payments) > 0).sort((a, b) => daysLate(b) - daysLate(a)).map(i => [i.id, s.client(i.clientId)!.name, i.billTo, d(i.due), daysLate(i), agingOf(i), money(balance(i, s.payments))])
  } else if (r === 'payers') {
    head = ['Who pays', 'Invoices', 'Hours', 'Invoiced', 'Paid', 'Still owed']
    rows = s.rules.payers.map(pay => { const xs = inv.filter(i => i.payer === pay && inDates(i.issued)); return [pay, xs.length, r2(xs.reduce((a, i) => a + i.lines.reduce((b, l) => b + l.hours, 0), 0)), money(r2(xs.reduce((a, i) => a + invoiceTotal(i), 0))), money(r2(xs.reduce((a, i) => a + paidOn(i, s.payments), 0))), money(r2(xs.reduce((a, i) => a + balance(i, s.payments), 0)))] })
  } else if (r === 'timesheets') {
    const p = s.period(period)
    head = ['Caregiver', 'Pay period', 'Status', 'Planned hours', 'Approved hours', 'Weekend', 'Overtime', 'Miles', 'Allowances', 'Pay before tax']
    rows = s.timesheets.filter(t => t.periodId === period && s.inBranch(s.caregiver(t.caregiverId)?.branch ?? '')).map(t => { const g = s.caregiver(t.caregiverId)!; const x = timesheetDetail(t, g, p, s.visits, s.payCorrections); return [g.name, periodLabel(p, fmtDate), t.state === 'Returned' ? 'Sent back' : t.state, r2(x.planned), x.approved, x.weekend, x.overtime, x.miles, money(x.allowancePay), money(x.gross)] })
  } else {
    head = ['Export', 'Type', 'Pay period', 'Caregivers', 'Hours', 'Pay before tax', 'By', 'When', 'File', 'Copies downloaded']
    rows = s.batches.map(b => { const x = rowsOf(b); return [b.id, b.kind, periodLabel(s.period(b.periodId), fmtDate), b.caregivers, x.hours, money(x.gross), b.by, b.at, b.file, b.downloads.length] })
  }
  const csv = () => { downloadCsv(`${def.name.toLowerCase().replace(/[^a-z]+/g, '-')}-${TODAY}.csv`, [head, ...rows]); s.toast('Report downloaded.') }
  return (
    <>
      <PageHead title="Reports" crumb="Reports" sub="Choose a report, set the dates, and download it as a spreadsheet file. Totals match the screens they come from." actions={<Button icon={Download} disabled={!rows.length} onClick={csv}>Download (CSV)</Button>} />
      <div className="grid" style={{ gridTemplateColumns: '260px minmax(0, 1fr)', alignItems: 'start' }}>
        <div className="card card-pad col" style={{ gap: 6 }}>{REPORTS.map(x => (
          <button key={x.id} className={`menu-item ${x.id === r ? 'active' : ''}`} style={{ fontWeight: x.id === r ? 600 : 400, background: x.id === r ? 'var(--bg-selected)' : undefined, borderRadius: 8 }} onClick={() => setR(x.id)}><BarChart3 />{x.name}</button>))}</div>
        <div className="card">
          <div className="card-body col" style={{ gap: 12 }}>
            <div><div className="t-h3">{def.name}</div><div className="t-small t-muted">{def.about} {s.branchName(s.branch)}.</div></div>
            <div className="row wrap" style={{ gap: 12 }}>
              {def.dated && <><div style={{ width: 180 }}><Field label="From"><Input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></Field></div><div style={{ width: 180 }}><Field label="To"><Input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></Field></div></>}
              {r === 'timesheets' && <div style={{ width: 280 }}><Field label="Pay period"><Select value={period} onChange={e => setPeriod(e.target.value)} options={s.periods.filter(p => s.timesheets.some(t => t.periodId === p.id)).map(p => ({ value: p.id, label: periodLabel(p, fmtDate) }))} /></Field></div>}
            </div>
          </div>
          <div className="table-wrap"><table className="tbl"><thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((row, k) => <tr key={k}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}{!rows.length && <tr><td colSpan={head.length} className="t-muted">Nothing for these dates.</td></tr>}</tbody></table></div>
          {r === 'owed' && <div className="card-body t-small row wrap" style={{ gap: 16 }}>{AGING.map(b => <span key={b}>{b}: <b>{money(r2(inv.filter(i => balance(i, s.payments) > 0 && agingOf(i) === b).reduce((a, i) => a + balance(i, s.payments), 0)))}</b></span>)}</div>}
        </div>
      </div>
    </>
  )
}
