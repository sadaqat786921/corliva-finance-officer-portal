import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, Lock } from 'lucide-react'
import { useStore, fmtDate } from '../data/store'
import { approvedHours, plannedHours, rateOn } from '../data/seed'
import { billState, billTone, hoursText, invoiceFor, invoiceStatus, lineAmount, money, statusTone, tsTone } from '../data/finance'
import { AlertBanner, Button, CardHead, Chip, EmptyState } from '../components/ui'
import { DetailHead, useFrom } from '../components/FinanceBits'

const m = (t?: string) => t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : 0

/** Finance can see a visit but never change it — only the Care Supervisor corrects visit records. */
export default function VisitDetail() {
  const { id = '' } = useParams()
  const s = useStore()
  const nav = useNavigate()
  const back = useFrom('/to-bill', 'Ready to bill')
  const v = s.visits.find(x => x.id === id)
  if (!v || !s.inBranch(v.branch)) return <div className="card"><EmptyState icon={CalendarDays} tone="neutral" title="We can’t find this visit" text="It may be in a branch you’ve filtered out." action={<Button onClick={() => nav('/to-bill')}>Open Ready to bill</Button>} /></div>
  const c = s.client(v.clientId)!; const g = s.caregiver(v.caregiverId)
  const b = billState(v, s.invoices)
  const inv = invoiceFor(v, s.invoices)
  const line = inv?.lines.find(l => l.visitId === v.id && l.kind === 'Visit')
  const corrections = s.invoices.flatMap(i => i.lines.filter(l => l.kind === 'Correction' && l.visitId === v.id).map(l => ({ i, l })))
  const ts = g && s.timesheets.find(t => t.caregiverId === g.id && s.period(t.periodId).from <= v.date && s.period(t.periodId).to >= v.date)
  const prof = s.profile(c.id)
  const here = `/visits/${v.id}`
  const recorded = v.checkIn && v.checkOut ? (m(v.checkOut) - m(v.checkIn)) / 60 : null
  return (
    <>
      <DetailHead back={back} title={`${c.name} · Visit #${v.id.slice(1)}`} crumb={`Visit #${v.id.slice(1)}`} chips={<>{v.approval && <Chip tone={v.approval === 'Approved' ? 'success' : v.approval === 'Sent back' ? 'danger' : 'warning'}>{v.approval === 'To review' ? 'Waiting for approval' : v.approval === 'Sent back' ? 'Sent back to fix' : 'Approved'}</Chip>}<Chip tone={billTone(b)}>{b}</Chip></>}
        sub={`${fmtDate(v.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · planned ${v.start}–${v.end} · ${v.service} · ${s.branchName(v.branch)}`} />
      <div className="row t-small t-muted" style={{ gap: 6 }}><Lock size={13} />View only. Visit records are checked and corrected by the Care Supervisor. If an invoiced or paid visit is wrong, they send you an adjustment.</div>
      {v.status === 'Cancelled' && <AlertBanner tone="warning" title="This visit was cancelled">{v.cancelReason}. It isn’t billed or paid.</AlertBanner>}
      {v.approval === 'Sent back' && v.returned && <AlertBanner tone="danger" title="Sent back to the caregiver to fix">{v.returned.reason} — {v.returned.by}, {v.returned.at}. It can be billed once it’s approved.</AlertBanner>}
      {v.adjustment && <AlertBanner tone={v.adjustment.status === 'Sent to Finance' ? 'warning' : 'info'} title={`Adjustment: ${v.adjustment.status === 'Sent to Finance' ? 'waiting for you' : v.adjustment.status.toLowerCase()}`} action={<Button size="sm" variant="secondary" onClick={() => nav('/adjustments')}>Open Adjustments</Button>}>{v.adjustment.before} → {v.adjustment.after}. “{v.adjustment.reason}” — {v.adjustment.by}.{v.adjustment.note ? ` ${v.adjustment.note}` : ''}</AlertBanner>}
      <div className="grid g-main-side" style={{ alignItems: 'start' }}>
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <CardHead title="Times" sub="Planned, recorded and approved are kept apart." />
            <div className="table-wrap"><table className="tbl"><thead><tr><th /><th>Start</th><th>Finish</th><th className="num">Hours</th></tr></thead><tbody>
              <tr><td className="t-medium">Planned</td><td>{v.start}</td><td>{v.end}</td><td className="num">{hoursText(plannedHours(v))}</td></tr>
              {v.original && <tr><td className="t-medium">Recorded by the app <span className="t-caption t-muted">(before correction)</span></td><td>{v.original.checkIn ?? v.checkIn}</td><td>{v.original.checkOut ?? v.checkOut}</td><td className="num">—</td></tr>}
              <tr><td className="t-medium">{v.original ? 'Corrected by the supervisor' : 'Recorded by the app'}</td><td>{v.checkIn ?? '—'}</td><td>{v.checkOut ?? 'No check-out'}</td><td className="num">{recorded !== null ? hoursText(Math.round(recorded * 100) / 100) : '—'}</td></tr>
              <tr><td className="t-medium">Billed and paid</td><td colSpan={2} className="t-caption t-muted">Approved time to the nearest {s.rules.billingUnitMins} minutes</td><td className="num t-medium">{v.approval === 'Approved' && approvedHours(v) !== null ? hoursText(approvedHours(v)!) : '—'}</td></tr>
            </tbody></table></div>
          </div>
          <div className="card">
            <CardHead title="Billing" />
            <div className="card-body">{inv && line ? <dl className="kv" style={{ gridTemplateColumns: '130px 1fr' }}>
              <dt>Invoice</dt><dd><Link to={`/invoices/${inv.id}?from=${here}`}>{inv.id}</Link> <Chip tone={statusTone(invoiceStatus(inv, s.payments))}>{invoiceStatus(inv, s.payments)}</Chip></dd>
              <dt>Billed</dt><dd>{hoursText(line.hours)} × {money(line.rate)} = {money(lineAmount(line))}</dd>
              <dt>Bills go to</dt><dd>{inv.billTo}</dd>
            </dl> : b === 'Ready to bill' && prof ? <div className="row between"><span className="t-small">Not billed yet · {money(rateOn(prof.rates, v.date))} an hour on this day</span><Button size="sm" onClick={() => nav(`/to-bill/${c.id}?from=${here}`)}>Bill this client</Button></div>
              : <div className="t-small t-muted">{b === 'Waiting for approval' || b === 'Sent back to fix' ? 'Can be billed once the Care Supervisor approves it.' : b === 'Cancelled visit' ? 'Not billed.' : !prof ? 'Billing isn’t set up for this client.' : 'Not billed.'}</div>}
              {corrections.map(({ i, l }) => <div key={l.id} className="t-caption" style={{ marginTop: 8, color: 'var(--status-warning)' }}>Correction on <Link to={`/invoices/${i.id}?from=${here}`}>{i.id}</Link>: {l.hours > 0 ? '+' : ''}{hoursText(l.hours)} · {money(lineAmount(l))}</div>)}</div>
          </div>
        </div>
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <CardHead title="Approval" />
            <div className="card-body"><dl className="kv" style={{ gridTemplateColumns: '110px 1fr' }}>
              <dt>Status</dt><dd>{v.approval === 'Approved' ? 'Approved' : v.approval === 'Sent back' ? 'Sent back to fix' : v.approval === 'To review' ? 'Waiting for the Care Supervisor' : v.status}</dd>
              {v.approvedBy && <><dt>Approved by</dt><dd>{v.approvedBy}, {v.approvedAt}</dd></>}
              <dt>Checked in</dt><dd>{v.place ?? '—'}</dd>
              {v.cgNote && <><dt>Caregiver’s note</dt><dd>{v.cgNote}</dd></>}
            </dl></div>
          </div>
          <div className="card">
            <CardHead title="Pay" />
            <div className="card-body">{g ? <dl className="kv" style={{ gridTemplateColumns: '110px 1fr' }}>
              <dt>Caregiver</dt><dd><Link to={`/pay-rates/${g.id}?from=${here}`}>{g.name}</Link></dd>
              <dt>Pay rate</dt><dd>{money(rateOn(g.pay, v.date))} an hour</dd>
              <dt>Timesheet</dt><dd>{ts ? <><Link to={`/timesheets/${ts.id}?from=${here}`}>{fmtDate(s.period(ts.periodId).from, { day: 'numeric', month: 'short' })} – {fmtDate(s.period(ts.periodId).to, { day: 'numeric', month: 'short' })}</Link> <Chip tone={tsTone(ts.state)}>{ts.state === 'Returned' ? 'Sent back' : ts.state}</Chip></> : 'Pay period still running'}</dd>
            </dl> : <div className="t-small t-muted">No caregiver.</div>}</div>
          </div>
          <div className="card">
            <CardHead title="Client" />
            <div className="card-body"><dl className="kv" style={{ gridTemplateColumns: '110px 1fr' }}>
              <dt>Client</dt><dd><Link to={`/clients/${c.id}?from=${here}`}>{c.name}</Link></dd><dt>Who pays</dt><dd>{prof?.payer ?? 'Not set up'}</dd>
            </dl></div>
          </div>
        </div>
      </div>
    </>
  )
}
