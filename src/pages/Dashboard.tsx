import { useNavigate } from 'react-router-dom'
import { Receipt, Clock3, FileSpreadsheet, ArrowLeftRight, CheckCircle2, FileText, Settings2, Download, Wallet, ChevronRight } from 'lucide-react'
import { useStore, fmtDate } from '../data/store'
import { TODAY, approvedHours, rateOn } from '../data/seed'
import { AGING, agingOf, balance, billState, daysLate, invoiceStatus, invoiceTotal, money, periodLabel, r2, timesheetDetail } from '../data/finance'
import { Button, CardHead, Chip, ChipTone, PageHead, StatTile } from '../components/ui'

export default function Dashboard() {
  const s = useStore()
  const nav = useNavigate()
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const inv = s.invoices.filter(i => s.inBranch(i.branch))
  const vs = s.visits.filter(v => s.inBranch(v.branch))
  const ready = vs.filter(v => billState(v, s.invoices) === 'Ready to bill')
  const readyAmt = r2(ready.reduce((a, v) => { const p = s.profile(v.clientId); return a + (p ? (approvedHours(v) ?? 0) * rateOn(p.rates, v.date) : 0) }, 0))
  const readyClients = new Set(ready.map(v => v.clientId))
  const waiting = vs.filter(v => ['Waiting for approval', 'Sent back to fix'].includes(billState(v, s.invoices)))
  const drafts = inv.filter(i => i.state === 'Draft')
  const overdue = inv.filter(i => invoiceStatus(i, s.payments) === 'Overdue').sort((a, b) => daysLate(b) - daysLate(a))
  const owed = r2(inv.reduce((a, i) => a + balance(i, s.payments), 0))
  const late = r2(overdue.reduce((a, i) => a + balance(i, s.payments), 0))
  const sheets = s.timesheets.filter(t => s.inBranch(s.caregiver(t.caregiverId)?.branch ?? ''))
  const toCheck = sheets.filter(t => t.state === 'To check')
  const returned = sheets.filter(t => t.state === 'Returned')
  const approvedSheets = sheets.filter(t => t.state === 'Approved')
  const adjust = vs.filter(v => v.adjustment?.status === 'Sent to Finance')
  const notSetUp = s.clients.filter(c => s.inBranch(c.branch) && c.status !== 'Discharged' && !s.profile(c.id))
  const noFollowUp = overdue.filter(i => !i.notes.length)
  const p1 = s.period('P1')

  type Q = { icon: typeof Receipt; tone: ChipTone; title: string; sub: string; chip: string; action: string; to: string }
  const queue: Q[] = [
    ...overdue.map(i => ({ icon: Clock3, tone: 'danger' as const, title: `Late payment: ${s.client(i.clientId)?.name} · ${i.id}`, sub: `${money(balance(i, s.payments))} owed by ${i.billTo} · due ${fmtDate(i.due!, { day: 'numeric', month: 'short' })}${i.notes.length ? ` · last note: ${i.notes[i.notes.length - 1].text}` : ' · no follow-up yet'}`, chip: `${daysLate(i)} days late`, action: 'Follow up', to: `/invoices/${i.id}?from=/` })),
    ...adjust.map(v => ({ icon: ArrowLeftRight, tone: 'warning' as const, title: `Adjustment asked for: ${s.client(v.clientId)?.name}`, sub: `${v.adjustment!.before} → ${v.adjustment!.after} · from ${v.adjustment!.by}`, chip: 'Apply or decline', action: 'Open', to: '/adjustments' })),
    ...returned.map(t => ({ icon: FileSpreadsheet, tone: 'danger' as const, title: `Timesheet sent back: ${s.caregiver(t.caregiverId)?.name}`, sub: t.returned?.reason ?? '', chip: 'Waiting on supervisor', action: 'Open', to: `/timesheets/${t.id}?from=/` })),
    ...(toCheck.length ? [{ icon: FileSpreadsheet, tone: 'warning' as const, title: `${toCheck.length} timesheet${toCheck.length > 1 ? 's' : ''} to check`, sub: `Pay period ${periodLabel(p1, fmtDate)} · ${toCheck.map(t => s.caregiver(t.caregiverId)?.name).join(', ')}`, chip: 'Timesheets', action: 'Check', to: `/timesheets?period=${toCheck[0].periodId}` }] : []),
    ...(approvedSheets.length ? [{ icon: Download, tone: 'info' as const, title: `${approvedSheets.length} approved timesheet${approvedSheets.length > 1 ? 's' : ''} ready to export`, sub: 'Send them to the payroll provider', chip: 'Payroll', action: 'Export', to: '/exports' }] : []),
    ...drafts.map(i => ({ icon: FileText, tone: 'info' as const, title: `Draft invoice to send: ${s.client(i.clientId)?.name}`, sub: `${i.id} · ${money(invoiceTotal(i))} to ${i.billTo}`, chip: 'Draft', action: 'Check and send', to: `/invoices/${i.id}?from=/` })),
    ...(readyClients.size ? [{ icon: Receipt, tone: 'info' as const, title: `${ready.length} approved visit${ready.length > 1 ? 's' : ''} ready to bill`, sub: `${money(readyAmt)} for ${readyClients.size} client${readyClients.size > 1 ? 's' : ''}`, chip: 'Ready to bill', action: 'Bill', to: '/to-bill' }] : []),
    ...notSetUp.map(c => ({ icon: Settings2, tone: 'warning' as const, title: `Billing not set up: ${c.name}`, sub: `${c.payer ? `Coordinator noted ${c.payer}` : 'New client'} · needed before the first invoice`, chip: 'Set up', action: 'Set up', to: `/clients/${c.id}?from=/&setup=1` })),
  ]
  const buckets = AGING.map(b => r2(inv.filter(i => balance(i, s.payments) > 0 && agingOf(i) === b).reduce((a, i) => a + balance(i, s.payments), 0)))
  const max = Math.max(1, ...buckets)
  const paid30 = r2(s.payments.filter(p => !p.reversed && s.inBranch(s.client(p.clientId)?.branch ?? '') && p.date >= isoAgo(30)).reduce((a, p) => a + p.amount, 0))

  return (
    <>
      <PageHead title="My work" crumb="My work" />
      <section className="hero">
        <div className="t-display" style={{ fontSize: 24 }}>{greet}, {s.me.name.split(' ')[0]}</div>
        <div style={{ opacity: .92, marginTop: 4 }}>Billing, payments and payroll for {s.branchName(s.branch)}.</div>
        {overdue.length > 0 ? <button className="hero-note" onClick={() => nav('/owed')}><Clock3 size={15} />{money(late)} is late on {overdue.length} invoice{overdue.length > 1 ? 's' : ''}{noFollowUp.length ? ` — ${noFollowUp.length} not followed up yet` : ''}.</button>
          : <span className="hero-note"><CheckCircle2 size={15} />Nothing is late.</span>}
        <img src="./images/corliva-symbol-light.svg" alt="" aria-hidden />
      </section>
      <div className="grid g-4">
        <StatTile icon={Receipt} tone="info" label="Ready to bill" value={money(readyAmt)} foot={`${ready.length} approved visits · ${waiting.length} still with the supervisor`} chip={ready.length ? { tone: 'info', text: 'Bill' } : { tone: 'success', text: 'All billed' }} onClick={() => nav('/to-bill')} />
        <StatTile icon={Wallet} tone={late ? 'danger' : 'success'} label="Money owed" value={money(owed)} foot={`${money(late)} late · ${money(paid30)} paid in 30 days`} chip={overdue.length ? { tone: 'danger', text: `${overdue.length} late` } : undefined} onClick={() => nav('/owed')} />
        <StatTile icon={FileSpreadsheet} tone="warning" label="Timesheets" value={toCheck.length + returned.length} foot={`${toCheck.length} to check · ${returned.length} sent back · ${approvedSheets.length} ready to export`} onClick={() => nav('/timesheets')} />
        <StatTile icon={ArrowLeftRight} tone="warning" label="Adjustments" value={adjust.length} foot="Asked for by the Care Supervisor" chip={adjust.length ? { tone: 'warning', text: 'Waiting' } : { tone: 'success', text: 'None' }} onClick={() => nav('/adjustments')} />
      </div>
      <div className="grid g-main-side" style={{ alignItems: 'start' }}>
        <div className="card">
          <CardHead title="Needs you now" sub="Most urgent first. Each item stays until it’s sorted." />
          <div className="card-body">{queue.length === 0 ? <div className="row t-small" style={{ gap: 8 }}><CheckCircle2 size={16} color="var(--status-success)" />You’re all caught up.</div> : queue.map((q, k) => (
            <div key={k} className="list-row">
              <div className={`stat-icon tone-${q.tone}`} style={{ width: 34, height: 34 }}><q.icon size={16} /></div>
              <div className="grow"><div className="t-medium">{q.title}</div><div className="t-caption t-muted">{q.sub}</div></div>
              <Chip tone={q.tone}>{q.chip}</Chip>
              <Button size="sm" variant="secondary" onClick={() => nav(q.to)}>{q.action}</Button>
            </div>))}</div>
        </div>
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <CardHead title="Money owed, by how late" action={<button className="link-btn" onClick={() => nav('/owed')}>Open</button>} />
            <div className="card-body col" style={{ gap: 10 }}>{AGING.map((b, k) => (
              <div key={b}><div className="row between t-small"><span>{b}</span><span className="t-medium">{money(buckets[k])}</span></div>
                <div className="bar" style={{ marginTop: 4 }}><span style={{ width: `${(buckets[k] / max) * 100}%`, background: k === 0 ? 'var(--status-info)' : k === 1 ? 'var(--status-warning)' : 'var(--status-danger)' }} /></div></div>))}</div>
          </div>
          <div className="card">
            <CardHead title="Visits on their way to billing" />
            <div className="card-body col" style={{ gap: 8 }}>
              <Row label="With the Care Supervisor" value={waiting.length} onClick={() => nav('/to-bill')} tone="warning" />
              <Row label="Approved, not billed" value={ready.length} onClick={() => nav('/to-bill')} tone="info" />
              <Row label="On draft invoices" value={drafts.reduce((a, i) => a + i.lines.length, 0)} onClick={() => nav('/invoices?tab=Drafts')} tone="neutral" />
            </div>
          </div>
          <div className="card">
            <CardHead title="Payroll" action={<button className="link-btn" onClick={() => nav('/exports')}>Exports</button>} />
            <div className="card-body t-small col" style={{ gap: 6 }}>
              <span>Last finished pay period: <b>{periodLabel(p1, fmtDate)}</b></span>
              <span>Pay before tax: <b>{money(r2(sheets.filter(t => t.periodId === 'P1').reduce((a, t) => a + timesheetDetail(t, s.caregiver(t.caregiverId)!, p1, s.visits, s.payCorrections).gross, 0)))}</b></span>
              <span className="t-muted">This period ends {fmtDate(s.period('P0').to, { day: 'numeric', month: 'short' })}{s.period('P0').to === TODAY ? ' (today)' : ''}.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
function Row({ label, value, onClick, tone }: { label: string; value: number; onClick: () => void; tone: ChipTone }) {
  return <button className="list-row clickable-row" style={{ width: '100%', textAlign: 'left' }} onClick={onClick}><span className="grow t-small">{label}</span><Chip tone={tone}>{value}</Chip><ChevronRight size={14} /></button>
}
const isoAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
