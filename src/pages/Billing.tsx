import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Users, Settings2, Pencil, TrendingUp, Wallet, FileText, Receipt, Search, BadgeDollarSign, Lock } from 'lucide-react'
import { useStore, fmtDate, stampNow } from '../data/store'
import { BillingProfile, TODAY, addDays, rateOn } from '../data/seed'
import { AGING, agingOf, balance, billState, invoiceStatus, invoiceTotal, money, r2, statusTone, timesheetDetail, tsTone } from '../data/finance'
import { AlertBanner, Avatar, Button, CardHead, Chip, EmptyState, Field, Input, Modal, PageHead, Select, Tabs, Textarea } from '../components/ui'
import { DetailHead, RecordPayment, useFrom } from '../components/FinanceBits'

const long = (d?: string) => d ? fmtDate(d, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

/* ---------------- Clients' billing (BILL-01) ---------------- */
export default function BillingList() {
  const s = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const rows = s.clients.filter(c => s.inBranch(c.branch) && (!q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase())))
    .map(c => ({ c, p: s.profile(c.id), owed: r2(s.invoices.filter(i => i.clientId === c.id).reduce((a, i) => a + balance(i, s.payments), 0)) }))
    .sort((a, b) => Number(!!a.p) - Number(!!b.p) || a.c.name.localeCompare(b.c.name))
  return (
    <>
      <PageHead title="Clients’ billing" crumb="Clients’ billing" sub="Who pays for each client’s care, the hourly rate, where bills go and how long they have to pay. Rate changes start from a date and never change invoices already sent." />
      <div className="card">
        <div className="row wrap" style={{ gap: 10, padding: 16 }}><div style={{ width: 280 }}><Input icon={Search} placeholder="Search clients" value={q} onChange={e => setQ(e.target.value)} /></div></div>
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Client</th><th>Care status</th><th>Who pays</th><th>Bills go to</th><th className="num">Rate an hour</th><th>Pay within</th><th>Invoices</th><th className="num">Still owed</th></tr></thead>
          <tbody>{rows.map(({ c, p, owed }) => (
            <tr key={c.id} className="clickable-row" onClick={() => nav(`/clients/${c.id}?from=/billing`)}>
              <td className="t-medium">{c.name}<div className="t-caption t-muted">{s.branchName(c.branch)}</div></td>
              <td><Chip tone={c.status === 'Active' ? 'success' : 'warning'}>{c.status}</Chip></td>
              {p ? <><td>{p.payer}</td><td>{p.billTo}</td><td className="num">{money(rateOn(p.rates, TODAY))}</td><td>{p.terms} days</td><td>{p.period}</td><td className="num">{owed ? money(owed) : '—'}</td></>
                : <td colSpan={6}><Chip tone="danger">Billing not set up</Chip> <span className="t-small t-muted">{c.payer ? `Coordinator says: ${c.payer}` : ''}</span></td>}
            </tr>))}</tbody>
        </table></div>
      </div>
    </>
  )
}

export function ClientBilling() {
  const { id = '' } = useParams()
  const s = useStore()
  const nav = useNavigate()
  const back = useFrom('/billing', 'Clients’ billing')
  const [params] = useSearchParams()
  const [act, setAct] = useState<null | 'setup' | 'rate' | 'pay'>(params.get('setup') ? 'setup' : null)
  const [tab, setTab] = useState<'invoices' | 'payments' | 'visits'>('invoices')
  const c = s.client(id)
  if (!c || !s.inBranch(c.branch)) return <div className="card"><EmptyState icon={Users} tone="neutral" title="We can’t find this client" text="They may be in a branch you’ve filtered out." action={<Button onClick={() => nav('/billing')}>Open Clients’ billing</Button>} /></div>
  const p = s.profile(c.id)
  const invs = s.invoices.filter(i => i.clientId === c.id).sort((a, b) => b.id.localeCompare(a.id))
  const pays = s.payments.filter(x => x.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date))
  const owed = r2(invs.reduce((a, i) => a + balance(i, s.payments), 0))
  const late = r2(invs.filter(i => invoiceStatus(i, s.payments) === 'Overdue').reduce((a, i) => a + balance(i, s.payments), 0))
  const visits = s.visits.filter(v => v.clientId === c.id && v.status === 'Completed').sort((a, b) => b.date.localeCompare(a.date))
  const ready = visits.filter(v => billState(v, s.invoices) === 'Ready to bill')
  const here = `/clients/${c.id}`
  return (
    <>
      <DetailHead back={back} title={c.name} crumb={c.name} lead={<Avatar name={c.name} size="lg" />} chips={<><Chip tone={c.status === 'Active' ? 'success' : 'warning'}>{c.status}</Chip>{!p && <Chip tone="danger">Billing not set up</Chip>}</>}
        sub={`${s.branchName(c.branch)} · client since ${c.since} · coordinator ${c.coordinator}`}
        actions={p ? <><Button variant="secondary" icon={Pencil} onClick={() => setAct('setup')}>Edit billing details</Button><Button variant="secondary" icon={TrendingUp} onClick={() => setAct('rate')}>Change rate</Button>{owed > 0 && <Button variant="secondary" icon={Wallet} onClick={() => setAct('pay')}>Record payment</Button>}{ready.length > 0 && <Button icon={Receipt} onClick={() => nav(`/to-bill/${c.id}?from=${here}`)}>Bill {ready.length} visit{ready.length > 1 ? 's' : ''}</Button>}</> : <Button icon={Settings2} onClick={() => setAct('setup')}>Set up billing</Button>} />
      {!p && <AlertBanner tone="warning" title="Set up billing before the first invoice">{c.payer ? `The coordinator noted this client is “${c.payer}”. ` : ''}Add who pays, the rate and the payment terms. Visits can’t be billed until this is done.</AlertBanner>}
      {c.status === 'On hold' && <AlertBanner tone="info" title="Care is on hold">{c.statusReason}. No new visits are being billed.</AlertBanner>}
      <div className="grid g-4">
        <div className="card card-pad"><div className="t-caption t-muted">Still owed</div><div className="t-h2">{money(owed)}</div></div>
        <div className="card card-pad"><div className="t-caption t-muted">Late</div><div className="t-h2" style={{ color: late ? 'var(--status-danger)' : undefined }}>{money(late)}</div></div>
        <div className="card card-pad"><div className="t-caption t-muted">Paid in the last 90 days</div><div className="t-h2">{money(r2(pays.filter(x => !x.reversed && x.date >= addDays(-90)).reduce((a, x) => a + x.amount, 0)))}</div></div>
        <div className="card card-pad"><div className="t-caption t-muted">Approved, not billed</div><div className="t-h2">{ready.length} visit{ready.length === 1 ? "" : "s"}</div></div>
      </div>
      <div className="grid g-main-side" style={{ alignItems: 'start' }}>
        <div className="card">
          <Tabs tabs={[{ id: 'invoices', label: 'Invoices', count: invs.length }, { id: 'payments', label: 'Payments', count: pays.length }, { id: 'visits', label: 'Visits and billing', count: visits.length }]} value={tab} onChange={setTab} />
          {tab === 'invoices' && (invs.length === 0 ? <EmptyState icon={FileText} tone="neutral" title="No invoices yet" text="Make one from approved visits." /> :
            <div className="table-wrap"><table className="tbl"><thead><tr><th>Invoice</th><th>Visits from</th><th>Sent</th><th>Due</th><th className="num">Total</th><th className="num">Still owed</th><th>Status</th></tr></thead>
              <tbody>{invs.map(i => { const st = invoiceStatus(i, s.payments); return <tr key={i.id} className="clickable-row" onClick={() => nav(`/invoices/${i.id}?from=${here}`)}><td className="t-medium">{i.id}</td><td>{fmtDate(i.from, { day: 'numeric', month: 'short' })} – {fmtDate(i.to, { day: 'numeric', month: 'short' })}</td><td>{i.issued ? long(i.issued) : '—'}</td><td>{long(i.due)}</td><td className="num">{money(invoiceTotal(i))}</td><td className="num">{i.state === 'Sent' ? money(balance(i, s.payments)) : '—'}</td><td><Chip tone={statusTone(st)}>{st}</Chip></td></tr> })}</tbody></table></div>)}
          {tab === 'payments' && (pays.length === 0 ? <EmptyState icon={Wallet} tone="neutral" title="No payments yet" text="Record money when it arrives." /> :
            <div className="table-wrap"><table className="tbl"><thead><tr><th>Payment</th><th>Received</th><th>How paid</th><th>Reference</th><th>Invoices</th><th className="num">Amount</th></tr></thead>
              <tbody>{pays.map(x => <tr key={x.id} className="clickable-row" onClick={() => nav(`/payments/${x.id}?from=${here}`)}><td className="t-medium">{x.id}{x.reversed && <> <Chip tone="danger">Reversed</Chip></>}</td><td>{long(x.date)}</td><td>{x.method}</td><td>{x.ref}</td><td>{x.allocations.map(a => a.invoiceId).join(', ')}</td><td className="num">{money(x.amount)}</td></tr>)}</tbody></table></div>)}
          {tab === 'visits' && <div className="table-wrap"><table className="tbl"><thead><tr><th>Date</th><th>Caregiver</th><th>Times</th><th>Billing</th></tr></thead>
            <tbody>{visits.slice(0, 40).map(v => { const b = billState(v, s.invoices); return <tr key={v.id} className="clickable-row" onClick={() => nav(`/visits/${v.id}?from=${here}`)}><td>{fmtDate(v.date)}</td><td>{s.caregiver(v.caregiverId)?.name}</td><td>{v.checkIn ?? '—'}–{v.checkOut ?? '—'}</td><td><Chip tone={b === 'Invoiced' ? 'success' : b === 'Ready to bill' ? 'info' : b === 'Sent back to fix' ? 'danger' : b === 'Waiting for approval' ? 'warning' : 'neutral'}>{b}</Chip></td></tr> })}</tbody></table></div>}
        </div>
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <CardHead title="How care is paid" action={p && <button className="link-btn" onClick={() => setAct('setup')}>Edit</button>} />
            <div className="card-body">{p ? <dl className="kv" style={{ gridTemplateColumns: '110px 1fr' }}>
              <dt>Who pays</dt><dd>{p.payer}</dd><dt>Bills go to</dt><dd>{p.billTo}<div className="t-caption t-muted">{p.billToContact}<br />{p.billToAddress}</div></dd>
              <dt>Rate now</dt><dd>{money(rateOn(p.rates, TODAY))} an hour</dd><dt>Pay within</dt><dd>{p.terms} days</dd><dt>Invoices</dt><dd>{p.period}</dd>
            </dl> : <div className="t-small t-muted">Not set up yet.</div>}</div>
          </div>
          {p && <div className="card">
            <CardHead title="Rate history" action={<button className="link-btn" onClick={() => setAct('rate')}>Change rate</button>} />
            <div className="card-body">{[...p.rates].sort((a, b) => b.from.localeCompare(a.from)).map((r, k) => <div key={k} className="note"><div className="row between"><span className="t-small t-medium">{money(r.rate)} an hour</span>{k === 0 && <Chip tone="success">In use</Chip>}</div><div className="t-caption t-muted">From {long(r.from)} · {r.note} · {r.by}</div></div>)}
              <div className="hint row" style={{ gap: 6, marginTop: 10 }}><Lock size={12} />Each invoice line keeps the rate it was billed at.</div></div>
          </div>}
          {owed > 0 && <div className="card"><CardHead title="Owed, by how late" /><div className="card-body">{AGING.map(b => { const v = r2(invs.filter(i => balance(i, s.payments) > 0 && agingOf(i) === b).reduce((a, i) => a + balance(i, s.payments), 0)); return v > 0 && <div key={b} className="row between t-small" style={{ padding: '4px 0' }}><span>{b}</span><span className="t-medium">{money(v)}</span></div> })}</div></div>}
          {p && p.history.length > 0 && <div className="card"><CardHead title="Changes" /><div className="card-body">{[...p.history].reverse().map((h, k) => <div key={k} className="note"><div className="t-small">{h.text}</div><div className="t-caption t-muted">{h.by} · {h.at}</div></div>)}</div></div>}
        </div>
      </div>
      {act === 'setup' && <SetupModal clientId={c.id} onClose={() => setAct(null)} />}
      {act === 'rate' && p && <RateModal p={p} onClose={() => setAct(null)} />}
      {act === 'pay' && <RecordPayment clientId={c.id} onClose={() => setAct(null)} />}
    </>
  )
}

function SetupModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const s = useStore()
  const c = s.client(clientId)!; const p = s.profile(clientId)
  const [f, setF] = useState({ payer: p?.payer ?? c.payer ?? 'Private pay', billTo: p?.billTo ?? '', billToContact: p?.billToContact ?? '', billToAddress: p?.billToAddress ?? '', terms: String(p?.terms ?? 14), period: p?.period ?? 'Every 2 weeks', rate: '', from: TODAY })
  const [tried, setTried] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }))
  const errs = { billTo: !f.billTo.trim() ? 'Who should the bills go to?' : '', contact: !f.billToContact.trim() ? 'Add a phone, email or policy number.' : '', rate: !p && !(Number(f.rate) > 0) ? 'Enter the hourly rate.' : '', terms: !(Number(f.terms) >= 1 && Number(f.terms) <= 90) ? '1 to 90 days.' : '' }
  const save = () => {
    setTried(true); if (Object.values(errs).some(Boolean)) return
    const base = { payer: f.payer, billTo: f.billTo.trim(), billToContact: f.billToContact.trim(), billToAddress: f.billToAddress.trim(), terms: Number(f.terms), period: f.period as BillingProfile['period'] }
    if (p) {
      const changed = (Object.keys(base) as (keyof typeof base)[]).filter(k => String(base[k]) !== String(p[k]))
      s.setProfiles(x => x.map(y => y.clientId === clientId ? { ...y, ...base, history: [...y.history, { by: s.me.name, at: stampNow(), text: changed.length ? `Changed ${changed.map(k => ({ payer: 'who pays', billTo: 'bills go to', billToContact: 'contact', billToAddress: 'address', terms: 'payment terms', period: 'how often' } as Record<string, string>)[k]).join(', ')}. Invoices already sent are not changed.` : 'Saved with no changes.' }] } : y))
      s.toast('Billing details saved. Invoices already sent keep the old details.')
    } else {
      s.setProfiles(x => [...x, { clientId, ...base, rates: [{ rate: Number(f.rate), from: f.from, by: s.me.name, note: 'First rate' }], history: [{ by: s.me.name, at: stampNow(), text: `Billing set up: ${f.payer}, ${money(Number(f.rate))} an hour.` }] }])
      s.toast(`Billing set up for ${c.name}.`)
    }
    s.log({ type: 'Billing set-up', action: p ? 'Changed billing details' : 'Set up billing', record: c.name })
    onClose()
  }
  return (
    <Modal wide title={p ? `Billing details · ${c.name}` : `Set up billing · ${c.name}`} sub="Agreed with the client or their funder. Changes apply to invoices made from now on." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>{p ? 'Save details' : 'Set up billing'}</Button></>}>
      <div className="grid g-2">
        <Field label="Who pays" required><Select value={f.payer} onChange={set('payer')} options={s.rules.payers} /></Field>
        <Field label="Bills go to" required error={tried ? errs.billTo || undefined : undefined}><Input value={f.billTo} onChange={set('billTo')} placeholder="Person or organisation" /></Field>
        <Field label="Contact" required helper="Phone, email, policy or authorisation number." error={tried ? errs.contact || undefined : undefined}><Input value={f.billToContact} onChange={set('billToContact')} /></Field>
        <Field label="Address for bills"><Input value={f.billToAddress} onChange={set('billToAddress')} /></Field>
        <Field label="Pay within (days)" required error={tried ? errs.terms || undefined : undefined}><Input inputMode="numeric" value={f.terms} onChange={set('terms')} /></Field>
        <Field label="How often to invoice" required><Select value={f.period} onChange={set('period')} options={['Every 2 weeks', 'Every month']} /></Field>
        {!p && <><Field label="Rate an hour" required error={tried ? errs.rate || undefined : undefined}><Input inputMode="decimal" value={f.rate} onChange={e => setF(x => ({ ...x, rate: e.target.value.replace(/[^\d.]/g, '') }))} placeholder="0.00" /></Field>
          <Field label="Rate starts from" required><Input type="date" value={f.from} onChange={set('from')} /></Field></>}
      </div>
      {p && <div className="hint">To change the rate, use “Change rate” so the old rate is kept for visits before the change.</div>}
    </Modal>
  )
}

function RateModal({ p, onClose }: { p: BillingProfile; onClose: () => void }) {
  const s = useStore()
  const lastBilled = s.invoices.filter(i => i.clientId === p.clientId && i.state !== 'Cancelled').flatMap(i => i.lines.map(l => l.date)).sort().pop()
  const minFrom = lastBilled && lastBilled >= TODAY ? addDaysFrom(lastBilled, 1) : TODAY
  const [rate, setRate] = useState(''); const [from, setFrom] = useState(minFrom); const [note, setNote] = useState(''); const [tried, setTried] = useState(false)
  const errs = { rate: !(Number(rate) > 0) ? 'Enter the new rate.' : '', from: !from || (lastBilled && from <= lastBilled) ? `Choose a day after the last billed visit (${long(lastBilled)}).` : '', note: note.trim().length < 3 ? 'Say why — for example the new yearly rate.' : '' }
  const save = () => {
    setTried(true); if (Object.values(errs).some(Boolean)) return
    s.setProfiles(x => x.map(y => y.clientId === p.clientId ? { ...y, rates: [...y.rates, { rate: Number(rate), from, by: s.me.name, note: note.trim() }], history: [...y.history, { by: s.me.name, at: stampNow(), text: `Rate ${money(rateOn(p.rates, TODAY))} → ${money(Number(rate))} from ${long(from)}: ${note.trim()}` }] } : y))
    s.log({ type: 'Billing set-up', action: 'Changed rate', record: s.client(p.clientId)!.name, before: money(rateOn(p.rates, TODAY)), after: money(Number(rate)), reason: note.trim() })
    s.toast(`New rate ${money(Number(rate))} from ${long(from)}.`); onClose()
  }
  return (
    <Modal title="Change rate" sub={`Now ${money(rateOn(p.rates, TODAY))} an hour. Visits before the start date keep the old rate.`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save new rate</Button></>}>
      <Field label="New rate an hour" required error={tried ? errs.rate || undefined : undefined}><Input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" /></Field>
      <Field label="Starts from" required helper="Can’t be on or before a visit that’s already billed." error={tried ? errs.from || undefined : undefined}><Input type="date" min={minFrom} value={from} onChange={e => setFrom(e.target.value)} /></Field>
      <Field label="Why" required error={tried ? errs.note || undefined : undefined}><Textarea value={note} onChange={e => setNote(e.target.value)} /></Field>
    </Modal>
  )
}
const addDaysFrom = (d: string, n: number) => { const [y, m, dd] = d.split('-').map(Number); const x = new Date(y, m - 1, dd + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }

/* ---------------- Pay rates (PAY-10: only Finance and the Agency Admin see pay) ---------------- */
export function PayRates() {
  const s = useStore()
  const nav = useNavigate()
  const rows = s.caregivers.filter(g => s.inBranch(g.branch)).sort((a, b) => a.name.localeCompare(b.name))
  return (
    <>
      <PageHead title="Pay rates" crumb="Pay rates" sub="Caregivers’ hourly pay. Only Finance and the Agency Admin can see this. A new rate starts from a date — timesheets already exported are never changed." />
      <div className="card card-pad t-small row wrap" style={{ gap: 24 }}><span>Weekend: <b>+{money(s.rules.weekendExtra)}</b> an hour</span><span>Overtime: over <b>{s.rules.overtimeAfter} hours</b> a week, <b>× {s.rules.overtimeTimes}</b></span><span>Mileage: <b>{money(s.rules.mileageRate)}</b> a mile</span><span className="t-muted">Agreed with the agency</span></div>
      <div className="card">
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Caregiver</th><th>Job</th><th className="num">Rate an hour</th><th className="num">Weekend rate</th><th>Since</th><th>Last timesheet</th></tr></thead>
          <tbody>{rows.map(g => { const cur = [...g.pay].sort((a, b) => b.from.localeCompare(a.from))[0]; const last = s.timesheets.filter(t => t.caregiverId === g.id).sort((a, b) => a.periodId.localeCompare(b.periodId))[0]; return (
            <tr key={g.id} className="clickable-row" onClick={() => nav(`/pay-rates/${g.id}?from=/pay-rates`)}><td className="t-medium">{g.name}<div className="t-caption t-muted">{s.branchName(g.branch)}</div></td><td>{g.type}</td><td className="num t-medium">{money(cur.rate)}</td><td className="num">{money(cur.rate + s.rules.weekendExtra)}</td><td>{long(cur.from)}</td><td>{last ? <Chip tone={tsTone(last.state)}>{last.state === 'Returned' ? 'Sent back' : last.state}</Chip> : <span className="t-muted">None yet</span>}</td></tr>) })}</tbody>
        </table></div>
      </div>
    </>
  )
}

export function CaregiverPay() {
  const { id = '' } = useParams()
  const s = useStore()
  const nav = useNavigate()
  const back = useFrom('/pay-rates', 'Pay rates')
  const [changing, setChanging] = useState(false)
  const g = s.caregiver(id)
  if (!g || !s.inBranch(g.branch)) return <div className="card"><EmptyState icon={BadgeDollarSign} tone="neutral" title="We can’t find this caregiver" text="They may be in a branch you’ve filtered out." action={<Button onClick={() => nav('/pay-rates')}>Open Pay rates</Button>} /></div>
  const rates = [...g.pay].sort((a, b) => b.from.localeCompare(a.from))
  const sheets = s.timesheets.filter(t => t.caregiverId === g.id).sort((a, b) => a.periodId.localeCompare(b.periodId))
  const lastExported = sheets.filter(t => t.state === 'Exported').map(t => s.period(t.periodId).to).sort().pop()
  const here = `/pay-rates/${g.id}`
  return (
    <>
      <DetailHead back={back} title={g.name} crumb={g.name} lead={<Avatar name={g.name} size="lg" />} sub={`${g.type} · ${s.branchName(g.branch)} · ${g.phone}`} actions={<Button icon={TrendingUp} onClick={() => setChanging(true)}>Change pay rate</Button>} />
      <div className="grid g-main-side" style={{ alignItems: 'start' }}>
        <div className="card">
          <CardHead title="Timesheets" />
          <div className="table-wrap"><table className="tbl"><thead><tr><th>Pay period</th><th className="num">Approved hours</th><th className="num">Pay before tax</th><th>Status</th></tr></thead>
            <tbody>{sheets.map(t => { const p = s.period(t.periodId); const d = timesheetDetail(t, g, p, s.visits, s.payCorrections); return <tr key={t.id} className="clickable-row" onClick={() => nav(`/timesheets/${t.id}?from=${here}`)}><td>{fmtDate(p.from, { day: 'numeric', month: 'short' })} – {long(p.to)}</td><td className="num">{d.approved} h</td><td className="num">{money(d.gross)}</td><td><Chip tone={tsTone(t.state)}>{t.state === 'Returned' ? 'Sent back' : t.state}</Chip></td></tr> })}
              {!sheets.length && <tr><td colSpan={4} className="t-muted">No timesheets yet.</td></tr>}</tbody></table></div>
        </div>
        <div className="card">
          <CardHead title="Pay rate history" />
          <div className="card-body">{rates.map((r, k) => <div key={k} className="note"><div className="row between"><span className="t-small t-medium">{money(r.rate)} an hour</span>{k === 0 && <Chip tone="success">In use</Chip>}</div><div className="t-caption t-muted">From {long(r.from)} · {r.note} · {r.by}</div></div>)}</div>
        </div>
      </div>
      {changing && <PayRateModal gid={g.id} after={lastExported} onClose={() => setChanging(false)} />}
    </>
  )
}

function PayRateModal({ gid, after, onClose }: { gid: string; after?: string; onClose: () => void }) {
  const s = useStore()
  const g = s.caregiver(gid)!
  const cur = rateOn(g.pay, TODAY)
  const minFrom = after ? addDaysFrom(after, 1) : TODAY
  const [rate, setRate] = useState(''); const [from, setFrom] = useState(minFrom > TODAY ? minFrom : TODAY); const [note, setNote] = useState(''); const [tried, setTried] = useState(false)
  const errs = { rate: !(Number(rate) > 0) ? 'Enter the new rate.' : '', from: from < minFrom ? `Must be after the last exported pay period (${long(after)}).` : '', note: note.trim().length < 3 ? 'Say why.' : '' }
  const save = () => {
    setTried(true); if (Object.values(errs).some(Boolean)) return
    s.setCaregivers(x => x.map(y => y.id === gid ? { ...y, pay: [...y.pay, { rate: Number(rate), from, by: s.me.name, note: note.trim() }] } : y))
    s.log({ type: 'Pay rate', action: 'Changed pay rate', record: g.name, before: money(cur), after: money(Number(rate)), reason: note.trim() })
    s.toast(`${g.name}: ${money(Number(rate))} an hour from ${long(from)}.`); onClose()
  }
  return (
    <Modal title={`Change ${g.name}’s pay rate`} sub={`Now ${money(cur)} an hour. Visits before the start date keep the old rate.`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save new rate</Button></>}>
      <Field label="New rate an hour" required error={tried ? errs.rate || undefined : undefined}><Input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" /></Field>
      <Field label="Starts from" required error={tried ? errs.from || undefined : undefined}><Input type="date" min={minFrom} value={from} onChange={e => setFrom(e.target.value)} /></Field>
      <Field label="Why" required error={tried ? errs.note || undefined : undefined}><Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="For example: yearly pay review" /></Field>
    </Modal>
  )
}
