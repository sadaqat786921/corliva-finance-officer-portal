import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Receipt, FilePlus2, Clock, Settings2, CheckCircle2, Info } from 'lucide-react'
import { useStore, fmtDate, stampNow } from '../data/store'
import { Invoice, InvoiceLine, TODAY, Visit, approvedHours, plannedHours, rateOn } from '../data/seed'
import { billState, hoursText, invoiceFor, lineAmount, money, r2, readyFor } from '../data/finance'
import { AlertBanner, Button, CardHead, Chip, ConfirmDialog, EmptyState, PageHead } from '../components/ui'
import { DetailHead, useFrom } from '../components/FinanceBits'

const short = (d: string) => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })

/** Makes a draft invoice from the chosen approved visits and corrections, using the rate in force on each visit's day (BILL-02, 03, 05). */
export function useMakeDraft() {
  const s = useStore()
  return (clientId: string, visitIds: string[], correctionIds: string[]) => {
    const prof = s.profile(clientId)!; const c = s.client(clientId)!
    // Never put a visit on two invoices (BILL-04)
    const vs = s.visits.filter(v => visitIds.includes(v.id) && billState(v, s.invoices) === 'Ready to bill').sort((a, b) => a.date.localeCompare(b.date))
    const cs = s.billCorrections.filter(x => correctionIds.includes(x.id) && !x.invoiceId)
    if (!vs.length && !cs.length) return null
    let n = Math.max(0, ...s.invoices.flatMap(i => i.lines.map(l => Number(l.id.slice(1)) || 0)))
    const lines: InvoiceLine[] = [
      ...vs.map(v => ({ id: 'L' + (++n), kind: 'Visit' as const, visitId: v.id, date: v.date, text: v.service, hours: approvedHours(v)!, rate: rateOn(prof.rates, v.date) })),
      ...cs.map(x => ({ id: 'L' + (++n), kind: 'Correction' as const, visitId: x.visitId, date: x.date, text: x.text, hours: x.hours, rate: x.rate })),
    ]
    const dates = (vs.length ? vs.map(v => v.date) : lines.map(l => l.date)).sort()
    const id = 'INV-' + (Math.max(...s.invoices.map(i => Number(i.id.slice(4)))) + 1)
    const inv: Invoice = { id, clientId, branch: c.branch, from: dates[0], to: dates[dates.length - 1], payer: prof.payer, billTo: prof.billTo, billToContact: prof.billToContact, terms: prof.terms,
      state: 'Draft', created: TODAY, createdBy: s.me.name, lines, credits: [], notes: [], history: [{ by: s.me.name, at: stampNow(), text: `Draft made from ${vs.length} approved visit${vs.length === 1 ? '' : 's'}${cs.length ? ` and ${cs.length} correction${cs.length > 1 ? 's' : ''}` : ''}.` }] }
    s.setInvoices(x => [...x, inv])
    if (cs.length) s.setBillCorrections(x => x.map(y => correctionIds.includes(y.id) ? { ...y, invoiceId: id } : y))
    s.log({ type: 'Invoice', action: 'Made a draft invoice', record: id, after: money(lines.reduce((a, l) => a + lineAmount(l), 0)) })
    return id
  }
}

export default function ToBill() {
  const s = useStore()
  const nav = useNavigate()
  const make = useMakeDraft()
  const [picked, setPicked] = useState<string[]>([])
  const [confirm, setConfirm] = useState(false)
  const rows = useMemo(() => s.clients.filter(c => s.inBranch(c.branch)).map(c => {
    const r = readyFor(c.id, s.visits, s.invoices, s.billCorrections)
    const prof = s.profile(c.id)
    const amount = prof ? r2(r.visits.reduce((a, v) => a + (approvedHours(v) ?? 0) * rateOn(prof.rates, v.date), 0) + r.corrections.reduce((a, x) => a + x.hours * x.rate, 0)) : 0
    const waiting = s.visits.filter(v => v.clientId === c.id && ['Waiting for approval', 'Sent back to fix'].includes(billState(v, s.invoices))).length
    return { c, prof, ...r, amount, waiting, hours: r.visits.reduce((a, v) => a + (approvedHours(v) ?? 0), 0) }
  }).filter(x => x.visits.length || x.corrections.length || x.waiting), [s.clients, s.visits, s.invoices, s.billCorrections, s.profiles, s.branch])
  const ready = rows.filter(x => (x.visits.length || x.corrections.length) && x.prof)
  const total = r2(ready.reduce((a, x) => a + x.amount, 0))
  const makeAll = () => {
    const made = picked.map(cid => { const x = ready.find(r => r.c.id === cid)!; return make(cid, x.visits.map(v => v.id), x.corrections.map(c => c.id)) }).filter(Boolean)
    s.toast(`${made.length} draft invoice${made.length > 1 ? 's' : ''} made. Check them, then send.`); setPicked([]); setConfirm(false); nav('/invoices?tab=Drafts')
  }
  return (
    <>
      <PageHead title="Ready to bill" crumb="Ready to bill" sub="Visits the Care Supervisor has approved that aren’t on an invoice yet. Only approved visits can be billed, and each visit can only be billed once."
        actions={<Button icon={FilePlus2} disabled={!picked.length} onClick={() => setConfirm(true)}>Make draft invoices{picked.length ? ` (${picked.length})` : ''}</Button>} />
      <div className="grid g-3">
        <div className="card card-pad"><div className="t-caption t-muted">Ready to bill</div><div className="t-h2" style={{ marginTop: 4 }}>{money(total)}</div><div className="t-small t-muted">{ready.reduce((a, x) => a + x.visits.length, 0)} approved visits · {ready.length} clients</div></div>
        <div className="card card-pad"><div className="t-caption t-muted">Still with the Care Supervisor</div><div className="t-h2" style={{ marginTop: 4 }}>{rows.reduce((a, x) => a + x.waiting, 0)} visits</div><div className="t-small t-muted">Can be billed once approved</div></div>
        <div className="card card-pad"><div className="t-caption t-muted">How visits are billed</div><div className="t-small" style={{ marginTop: 6 }}>Approved time, to the nearest {s.rules.billingUnitMins} minutes, at the client’s rate on the day of the visit.</div></div>
      </div>
      <div className="card">
        {rows.length === 0 ? <EmptyState icon={CheckCircle2} title="Everything approved is billed" text="New visits show here once the Care Supervisor approves them." /> :
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th style={{ width: 36 }}><input type="checkbox" aria-label="Tick all" checked={picked.length > 0 && picked.length === ready.length} onChange={e => setPicked(e.target.checked ? ready.map(x => x.c.id) : [])} /></th><th>Client</th><th>Pays</th><th>Approved, not billed</th><th>Hours</th><th style={{ textAlign: 'right' }}>Amount</th><th>Waiting for approval</th><th /></tr></thead>
            <tbody>{rows.map(x => (
              <tr key={x.c.id}>
                <td><input type="checkbox" aria-label={`Pick ${x.c.name}`} disabled={!x.prof || !(x.visits.length || x.corrections.length)} checked={picked.includes(x.c.id)} onChange={e => setPicked(p => e.target.checked ? [...p, x.c.id] : p.filter(y => y !== x.c.id))} /></td>
                <td><Link to={`/clients/${x.c.id}?from=/to-bill`} className="t-medium" style={{ color: 'var(--text-primary)' }}>{x.c.name}</Link><div className="t-caption t-muted">{s.branchName(x.c.branch)}</div></td>
                <td>{x.prof ? <><div className="t-small">{x.prof.payer}</div><div className="t-caption t-muted">{x.prof.billTo}</div></> : <Chip tone="danger">Billing not set up</Chip>}</td>
                <td>{x.visits.length ? `${x.visits.length} visit${x.visits.length > 1 ? 's' : ''} · ${short(x.visits[0].date)}${x.visits.length > 1 ? ` – ${short(x.visits[x.visits.length - 1].date)}` : ''}` : '—'}{x.corrections.length > 0 && <div className="t-caption" style={{ color: 'var(--status-warning)' }}>+ {x.corrections.length} correction{x.corrections.length > 1 ? 's' : ''}</div>}</td>
                <td>{hoursText(x.hours)}</td>
                <td style={{ textAlign: 'right' }} className="t-medium">{x.prof ? money(x.amount) : '—'}</td>
                <td>{x.waiting ? <Chip tone="warning">{x.waiting} waiting</Chip> : <span className="t-muted">—</span>}</td>
                <td style={{ textAlign: 'right' }}>{x.prof ? (x.visits.length || x.corrections.length) ? <Button size="sm" variant="secondary" onClick={() => nav(`/to-bill/${x.c.id}`)}>Check and bill</Button> : null : <Button size="sm" icon={Settings2} onClick={() => nav(`/clients/${x.c.id}?from=/to-bill&setup=1`)}>Set up billing</Button>}</td>
              </tr>))}</tbody>
          </table></div>}
      </div>
      {confirm && <ConfirmDialog title={`Make ${picked.length} draft invoice${picked.length > 1 ? 's' : ''}?`} text={`Each client gets one draft with all their approved visits that aren’t billed yet (${money(r2(ready.filter(x => picked.includes(x.c.id)).reduce((a, x) => a + x.amount, 0)))} in total). Nothing is sent until you check each draft and press Send.`} confirm="Make drafts" onClose={() => setConfirm(false)} onConfirm={makeAll} />}
    </>
  )
}

/** Check one client's approved visits, choose what goes on the invoice, then make the draft (User Flow 6, steps 1–4). */
export function PrepareInvoice() {
  const { clientId = '' } = useParams()
  const s = useStore()
  const nav = useNavigate()
  const back = useFrom('/to-bill', 'Ready to bill')
  const make = useMakeDraft()
  const c = s.client(clientId); const prof = s.profile(clientId)
  const r = readyFor(clientId, s.visits, s.invoices, s.billCorrections)
  const [vIds, setVIds] = useState<string[]>(r.visits.map(v => v.id))
  const [cIds, setCIds] = useState<string[]>(r.corrections.map(x => x.id))
  if (!c || !s.inBranch(c.branch)) return <div className="card"><EmptyState icon={Receipt} tone="neutral" title="We can’t find this client" text="They may be in a branch you’ve filtered out." action={<Button onClick={() => nav('/to-bill')}>Back to Ready to bill</Button>} /></div>
  if (!prof) return <div className="card"><EmptyState icon={Settings2} tone="warning" title="Billing isn’t set up for this client" text="Add who pays, the rate and the payment terms first." action={<Button onClick={() => nav(`/clients/${c.id}?setup=1`)}>Set up billing</Button>} /></div>
  const waiting = s.visits.filter(v => v.clientId === c.id && ['Waiting for approval', 'Sent back to fix'].includes(billState(v, s.invoices))).sort((a, b) => a.date.localeCompare(b.date))
  const chosen = r.visits.filter(v => vIds.includes(v.id))
  const corr = r.corrections.filter(x => cIds.includes(x.id))
  const total = r2(chosen.reduce((a, v) => a + (approvedHours(v) ?? 0) * rateOn(prof.rates, v.date), 0) + corr.reduce((a, x) => a + x.hours * x.rate, 0))
  const go = () => { const id = make(c.id, vIds, cIds); if (id) { s.toast(`Draft ${id} made. Check it, then send.`); nav(`/invoices/${id}?from=/to-bill`) } }
  const rateChanges = new Set(chosen.map(v => rateOn(prof.rates, v.date))).size > 1
  return (
    <>
      <DetailHead back={back} title={`Bill ${c.name}`} crumb={c.name} sub={`${prof.payer} · bills go to ${prof.billTo} · pay within ${prof.terms} days`}
        actions={<><Button variant="secondary" onClick={() => nav(`/clients/${c.id}?from=/to-bill/${c.id}`)}>Billing set-up</Button><Button icon={FilePlus2} disabled={!chosen.length && !corr.length} onClick={go}>Make draft invoice · {money(total)}</Button></>} />
      {rateChanges && <AlertBanner tone="info" title="The rate changed during these visits">Each visit uses the rate that applied on its day. You’ll see both rates on the invoice.</AlertBanner>}
      <div className="grid g-main-side" style={{ alignItems: 'start' }}>
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <CardHead title="Approved visits not billed yet" sub="Untick any you want to leave for a later invoice." />
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th style={{ width: 36 }}><input type="checkbox" aria-label="Tick all" checked={vIds.length === r.visits.length && r.visits.length > 0} onChange={e => setVIds(e.target.checked ? r.visits.map(v => v.id) : [])} /></th><th>Date</th><th>Service</th><th>Caregiver</th><th>Planned</th><th>Approved</th><th>Rate</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>{r.visits.map(v => { const h = approvedHours(v) ?? 0; const rate = rateOn(prof.rates, v.date); return (
                <tr key={v.id}><td><input type="checkbox" aria-label={`Pick visit ${short(v.date)}`} checked={vIds.includes(v.id)} onChange={e => setVIds(p => e.target.checked ? [...p, v.id] : p.filter(y => y !== v.id))} /></td>
                  <td><Link to={`/visits/${v.id}?from=/to-bill/${c.id}`}>{short(v.date)}</Link><div className="t-caption t-muted">{v.checkIn}–{v.checkOut}</div></td><td>{v.service}</td><td>{s.caregiver(v.caregiverId)?.name}</td>
                  <td>{hoursText(plannedHours(v))}</td><td className="t-medium">{hoursText(h)}{v.original && <div className="t-caption t-muted">Corrected by supervisor</div>}</td><td>{money(rate)}</td><td style={{ textAlign: 'right' }}>{money(r2(h * rate))}</td></tr>) })}
                {r.visits.length === 0 && <tr><td colSpan={8} className="t-muted">No approved visits waiting.</td></tr>}</tbody>
            </table></div>
          </div>
          {r.corrections.length > 0 && <div className="card">
            <CardHead title="Agreed corrections" sub="From adjustments asked for by the Care Supervisor after a visit was invoiced." />
            <div className="card-body">{r.corrections.map(x => (
              <label key={x.id} className="list-row" style={{ cursor: 'pointer' }}><input type="checkbox" checked={cIds.includes(x.id)} onChange={e => setCIds(p => e.target.checked ? [...p, x.id] : p.filter(y => y !== x.id))} />
                <div className="grow"><div className="t-small t-medium">{x.text}</div><div className="t-caption t-muted">Visit on {short(x.date)} · {x.hours > 0 ? '+' : ''}{hoursText(x.hours)} × {money(x.rate)}</div></div>
                <span className="t-medium" style={{ color: x.hours < 0 ? 'var(--status-success)' : undefined }}>{money(r2(x.hours * x.rate))}</span></label>))}</div>
          </div>}
        </div>
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <CardHead title="This draft" />
            <div className="card-body"><dl className="kv" style={{ gridTemplateColumns: '120px 1fr' }}>
              <dt>Visits</dt><dd>{chosen.length}</dd><dt>Hours</dt><dd>{hoursText(chosen.reduce((a, v) => a + (approvedHours(v) ?? 0), 0))}</dd>
              {corr.length > 0 && <><dt>Corrections</dt><dd>{corr.length}</dd></>}
              <dt>Total</dt><dd className="t-h3">{money(total)}</dd>
              <dt>Bills go to</dt><dd>{prof.billTo}<div className="t-caption t-muted">{prof.billToContact}</div></dd>
            </dl>
            <div className="hint row" style={{ gap: 6, marginTop: 12 }}><Info size={13} />A draft can still be changed. Nothing is sent until you press Send on the invoice.</div></div>
          </div>
          <div className="card">
            <CardHead title="Not ready yet" sub="These can be billed once the Care Supervisor approves them." />
            <div className="card-body">{waiting.length === 0 ? <div className="t-small t-muted">Nothing waiting.</div> : waiting.map(v => (
              <Link key={v.id} to={`/visits/${v.id}?from=/to-bill/${c.id}`} className="list-row" style={{ color: 'var(--text-primary)' }}><Clock size={15} color="var(--text-muted)" /><div className="grow"><div className="t-small t-medium">{short(v.date)} · {v.start}–{v.end}</div><div className="t-caption t-muted">{s.caregiver(v.caregiverId)?.name}</div></div><Chip tone={billState(v, s.invoices) === 'Sent back to fix' ? 'danger' : 'warning'}>{billState(v, s.invoices) === 'Sent back to fix' ? 'Being fixed' : 'Waiting'}</Chip></Link>))}</div>
          </div>
        </div>
      </div>
    </>
  )
}

export const visitInvoiceLink = (v: Visit, invs: Invoice[]) => invoiceFor(v, invs)
