import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeftRight, CheckCircle2, XCircle, Info } from 'lucide-react'
import { useStore, fmtDate, stampNow } from '../data/store'
import { RULES, Visit, approvedHours } from '../data/seed'
import { balance, hoursText, invoiceFor, money, r2 } from '../data/finance'
import { Button, Chip, EmptyState, Modal, PageHead, ReasonDialog, Tabs, AlertBanner } from '../components/ui'

type Tab = 'Waiting for you' | 'Done' | 'Declined'
const long = (d: string) => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const hoursOf = (range: string) => { const [a, b] = range.split('–').map(x => x.trim()); const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)); return Math.round((m(b) - m(a)) / RULES.billingUnitMins) * RULES.billingUnitMins / 60 }

/** What applying an adjustment means for billing and pay. Finance never changes the visit record itself. */
function useEffects() {
  const s = useStore()
  return (v: Visit) => {
    const a = v.adjustment!
    const before = approvedHours(v) ?? hoursOf(a.before)
    const diff = r2(hoursOf(a.after) - before)
    const inv = invoiceFor(v, s.invoices)
    const line = inv?.lines.find(l => l.visitId === v.id && l.kind === 'Visit')
    const rate = line?.rate ?? 0
    const ts = s.timesheets.find(t => t.caregiverId === v.caregiverId && s.period(t.periodId).from <= v.date && s.period(t.periodId).to >= v.date)
    return { diff, inv, rate, amount: r2(diff * rate), ts, canCredit: !!inv && inv.state === 'Sent' && diff < 0 && balance(inv, s.payments) >= Math.abs(r2(diff * rate)) }
  }
}

export default function Adjustments() {
  const s = useStore()
  const effects = useEffects()
  const [params, setParams] = useSearchParams()
  const tab = ((['Waiting for you', 'Done', 'Declined'] as Tab[]).find(t => t === params.get('tab')) ?? 'Waiting for you') as Tab
  const [applying, setApplying] = useState<Visit | null>(null)
  const [declining, setDeclining] = useState<Visit | null>(null)
  const all = s.visits.filter(v => v.adjustment && s.inBranch(v.branch))
  const status = (t: Tab) => t === 'Waiting for you' ? 'Sent to Finance' : t
  const rows = all.filter(v => v.adjustment!.status === status(tab))
  const decline = (v: Visit, reason: string) => {
    s.setVisits(x => x.map(y => y.id === v.id ? { ...y, adjustment: { ...y.adjustment!, status: 'Declined', decidedBy: s.me.name, decidedAt: stampNow(), note: reason } } : y))
    s.log({ type: 'Adjustment', action: 'Declined an adjustment', record: `Visit #${v.id.slice(1)}`, reason })
    s.toast('Declined. Michael Brooks has been told why.'); setDeclining(null)
  }
  return (
    <>
      <PageHead title="Adjustments" crumb="Adjustments" sub="When a visit was already invoiced or paid, the Care Supervisor can’t change it. They ask you here instead. Applying one adds a correction to the next invoice (or a credit) and to the caregiver’s pay — the original invoice and export stay as they were." />
      <div className="card">
        <Tabs tabs={(['Waiting for you', 'Done', 'Declined'] as Tab[]).map(t => ({ id: t, label: t, count: all.filter(v => v.adjustment!.status === status(t)).length }))} value={tab} onChange={t => setParams({ tab: t }, { replace: true })} />
        <div className="card-body">
          {rows.length === 0 ? <EmptyState icon={CheckCircle2} title="Nothing here" text={tab === 'Waiting for you' ? 'No adjustments waiting.' : 'None yet.'} /> : rows.map(v => {
            const a = v.adjustment!; const e = effects(v); const c = s.client(v.clientId)!; const g = s.caregiver(v.caregiverId)
            return (
              <div key={v.id} className="list-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <ArrowLeftRight size={18} color="var(--status-warning)" style={{ marginTop: 2 }} />
                <div className="grow" style={{ minWidth: 260 }}>
                  <div className="row wrap" style={{ gap: 8 }}><span className="t-medium">{c.name} · <Link to={`/visits/${v.id}?from=/adjustments`}>visit {long(v.date)}</Link></span><Chip tone={e.diff > 0 ? 'info' : 'warning'}>{e.diff > 0 ? '+' : ''}{hoursText(e.diff)}</Chip></div>
                  <div className="t-small" style={{ marginTop: 4 }}>“{a.reason}”</div>
                  <div className="t-caption t-muted" style={{ marginTop: 4 }}>Asked by {a.by}, {a.at} · caregiver {g?.name}</div>
                  <div className="row wrap t-small" style={{ gap: 18, marginTop: 8 }}>
                    <span>Times: <s className="t-muted">{a.before}</s> → <b>{a.after}</b></span>
                    <span>Invoice: {e.inv ? <Link to={`/invoices/${e.inv.id}?from=/adjustments`}>{e.inv.id}</Link> : 'not billed'}{e.inv && <> · {e.amount >= 0 ? '+' : ''}{money(e.amount)}</>}</span>
                    <span>Pay: {e.ts ? <Link to={`/timesheets/${e.ts.id}?from=/adjustments`}>{e.ts.state === 'Exported' ? `exported (${e.ts.batchId})` : `timesheet ${e.ts.state.toLowerCase()}`}</Link> : 'no timesheet yet'}</span>
                  </div>
                  {a.status !== 'Sent to Finance' && <div className="t-caption" style={{ marginTop: 8, color: a.status === 'Done' ? 'var(--status-success)' : 'var(--status-danger)' }}>{a.status} by {a.decidedBy}, {a.decidedAt}: {a.note}</div>}
                </div>
                {a.status === 'Sent to Finance' && <div className="row" style={{ gap: 8 }}><Button size="sm" variant="secondary" icon={XCircle} onClick={() => setDeclining(v)}>Decline</Button><Button size="sm" icon={CheckCircle2} onClick={() => setApplying(v)}>Apply</Button></div>}
              </div>)
          })}
        </div>
      </div>
      {applying && <ApplyModal v={applying} onClose={() => setApplying(null)} />}
      {declining && <ReasonDialog title="Decline this adjustment?" text="Michael Brooks is told why. Nothing changes on the invoice or pay." confirm="Decline" danger onClose={() => setDeclining(null)} onConfirm={r => decline(declining, r)} />}
    </>
  )
}

function ApplyModal({ v, onClose }: { v: Visit; onClose: () => void }) {
  const s = useStore()
  const e = useEffects()(v)
  const [how, setHow] = useState<'next' | 'credit'>(e.canCredit ? 'credit' : 'next')
  const c = s.client(v.clientId)!; const g = s.caregiver(v.caregiverId)!
  const exported = e.ts?.state === 'Exported'
  const apply = () => {
    const notes: string[] = []
    if (e.inv && e.diff !== 0) {
      if (how === 'credit' && e.canCredit) {
        const id = 'CN-' + (300 + s.invoices.reduce((a, i) => a + i.credits.length, 0) + 1)
        s.setInvoices(x => x.map(i => i.id === e.inv!.id ? { ...i, credits: [...i.credits, { id, date: new Date().toISOString().slice(0, 10), amount: Math.abs(e.amount), reason: `Adjustment for visit on ${long(v.date)}: ${v.adjustment!.reason}`, by: s.me.name }], history: [...i.history, { by: s.me.name, at: stampNow(), text: `Credit ${id} for ${money(Math.abs(e.amount))} (adjustment).` }] } : i))
        notes.push(`credit ${id} on ${e.inv.id}`)
      } else {
        s.setBillCorrections(x => [...x, { id: 'BC' + Date.now(), clientId: c.id, visitId: v.id, date: v.date, text: `Correction to ${e.inv!.id}: visit on ${fmtDate(v.date, { day: 'numeric', month: 'short' })} (${v.adjustment!.before} → ${v.adjustment!.after})`, hours: e.diff, rate: e.rate }])
        notes.push(`correction on ${c.name}’s next invoice`)
      }
    }
    if (e.ts && e.diff !== 0) {
      s.setPayCorrections(x => [...x, { id: 'PC' + Date.now(), caregiverId: g.id, visitId: v.id, date: v.date, text: `Visit on ${fmtDate(v.date, { day: 'numeric', month: 'short' })} for ${c.name} (${v.adjustment!.before} → ${v.adjustment!.after})`, hours: e.diff }])
      if (e.ts.state === 'Approved') s.setTimesheets(x => x.map(t => t.id === e.ts!.id ? { ...t, state: 'To check', approvedBy: undefined, approvedAt: undefined, history: [...t.history, { by: s.me.name, at: stampNow(), text: 'Back to check — an adjustment was added.' }] } : t))
      notes.push(exported ? 'pay correction waiting to export' : `pay correction on ${g.name}’s timesheet`)
    }
    const note = notes.length ? `Applied: ${notes.join(' and ')}.` : 'Applied. Nothing to change in billing or pay.'
    s.setVisits(x => x.map(y => y.id === v.id ? { ...y, adjustment: { ...y.adjustment!, status: 'Done', decidedBy: s.me.name, decidedAt: stampNow(), note } } : y))
    s.log({ type: 'Adjustment', action: 'Applied an adjustment', record: `Visit #${v.id.slice(1)}`, after: note })
    s.toast(note); onClose()
  }
  return (
    <Modal wide title="Apply this adjustment?" sub={`${c.name} · ${long(v.date)} · ${v.adjustment!.before} → ${v.adjustment!.after}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={CheckCircle2} onClick={apply}>Apply adjustment</Button></>}>
      <AlertBanner tone="info" title="The visit record isn’t changed">What the caregiver recorded and the Care Supervisor approved stays as it is. The change is added as a correction, with this reason, so everyone can see why the totals moved.</AlertBanner>
      <div className="col" style={{ gap: 10 }}>
        <div className="t-small t-medium">Billing</div>
        {!e.inv ? <div className="t-small t-muted">Not billed yet — nothing to correct.</div> : <>
          <div className="t-small">{e.diff > 0 ? 'Extra' : 'Less'} {hoursText(Math.abs(e.diff))} × {money(e.rate)} = <b>{money(Math.abs(e.amount))}</b> {e.diff > 0 ? 'to charge' : 'to give back'} ({e.inv.id} stays as it was).</div>
          {e.canCredit && <label className="row t-small" style={{ gap: 8 }}><input type="radio" checked={how === 'credit'} onChange={() => setHow('credit')} />Add a credit to {e.inv.id} now (it still has {money(balance(e.inv, s.payments))} owed)</label>}
          <label className="row t-small" style={{ gap: 8 }}><input type="radio" checked={how === 'next' || !e.canCredit} onChange={() => setHow('next')} />Put a correction line on {c.name}’s next invoice</label>
        </>}
        <div className="t-small t-medium" style={{ marginTop: 6 }}>Pay</div>
        {!e.ts ? <div className="t-small t-muted">No timesheet yet — it will be paid from the approved visit.</div> :
          <div className="t-small row" style={{ gap: 6 }}><Info size={14} />{e.diff > 0 ? '+' : ''}{hoursText(e.diff)} for {g.name}. {exported ? `Their pay for that period was already exported (${e.ts.batchId}), so this goes in the next corrections export.` : `It’s added to their timesheet${e.ts.state === 'Approved' ? ', which goes back to To check' : ''}.`}</div>}
      </div>
    </Modal>
  )
}
