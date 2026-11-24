import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Wallet, Search, Undo2, Clock3, MessageSquarePlus, CheckCircle2 } from 'lucide-react'
import { useStore, fmtDate, stampNow } from '../data/store'
import { AGING, agingOf, balance, daysLate, invoiceStatus, money, r2, statusTone } from '../data/finance'
import { AlertBanner, Button, CardHead, Chip, EmptyState, Input, PageHead, Pager, ReasonDialog, Select, Tabs, usePaged } from '../components/ui'
import { DetailHead, RecordPayment, useFrom } from '../components/FinanceBits'

const long = (d?: string) => d ? fmtDate(d, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

/* ---------------- Payments ---------------- */
export default function Payments() {
  const s = useStore()
  const nav = useNavigate()
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [method, setMethod] = useState('All ways')
  const [tab, setTab] = useState<'Received' | 'Reversed'>('Received')
  const rows = useMemo(() => s.payments.filter(p => s.inBranch(s.client(p.clientId)?.branch ?? '') && (tab === 'Reversed' ? !!p.reversed : !p.reversed) && (method === 'All ways' || p.method === method)
    && (!q.trim() || `${p.id} ${p.ref} ${s.client(p.clientId)?.name} ${p.allocations.map(a => a.invoiceId).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), [s.payments, q, method, tab, s.branch])
  const pg = usePaged(rows, 12)
  const last30 = r2(s.payments.filter(p => !p.reversed && s.inBranch(s.client(p.clientId)?.branch ?? '') && p.date >= fmtIso(-30)).reduce((a, p) => a + p.amount, 0))
  return (
    <>
      <PageHead title="Payments" crumb="Payments" sub="Money received outside CORLIVA — by bank, cheque, insurer or program — and which invoices it paid. A payment entered by mistake is reversed with a reason, never deleted."
        actions={<Button icon={Wallet} onClick={() => setAdding(true)}>Record a payment</Button>} />
      <div className="card card-pad row wrap" style={{ gap: 24 }}>
        <div><div className="t-caption t-muted">Received in the last 30 days</div><div className="t-h2">{money(last30)}</div></div>
        <div><div className="t-caption t-muted">Payments recorded</div><div className="t-h2">{s.payments.filter(p => !p.reversed && s.inBranch(s.client(p.clientId)?.branch ?? '')).length}</div></div>
      </div>
      <div className="card">
        <Tabs tabs={[{ id: 'Received', label: 'Received', count: s.payments.filter(p => !p.reversed).length }, { id: 'Reversed', label: 'Reversed', count: s.payments.filter(p => p.reversed).length }]} value={tab} onChange={t => { setTab(t); pg.setPage(1) }} />
        <div className="row wrap" style={{ gap: 10, padding: 16 }}>
          <div style={{ width: 280 }}><Input icon={Search} placeholder="Payment, reference, client or invoice" value={q} onChange={e => { setQ(e.target.value); pg.setPage(1) }} /></div>
          <div style={{ width: 240 }}><Select value={method} onChange={e => setMethod(e.target.value)} options={['All ways', ...s.rules.paymentMethods]} /></div>
        </div>
        {rows.length === 0 ? <EmptyState icon={Wallet} tone="neutral" title="No payments here" text="Record a payment when money arrives." /> : <>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Payment</th><th>Received</th><th>Client</th><th>How paid</th><th>Reference</th><th>Pays invoices</th><th className="num">Amount</th><th>Recorded by</th></tr></thead>
            <tbody>{pg.items.map(p => (
              <tr key={p.id} className="clickable-row" onClick={() => nav(`/payments/${p.id}?from=/payments`)}>
                <td className="t-medium">{p.id}</td><td>{long(p.date)}</td><td>{s.client(p.clientId)?.name}</td><td>{p.method}</td><td>{p.ref}</td>
                <td>{p.allocations.map(a => a.invoiceId).join(', ')}</td><td className="num t-medium">{money(p.amount)}</td><td>{p.by}</td></tr>))}</tbody>
          </table></div>
          <Pager {...pg.pager} />
        </>}
      </div>
      {adding && <RecordPayment onClose={() => setAdding(false)} onDone={id => nav(`/payments/${id}?from=/payments`)} />}
    </>
  )
}
const fmtIso = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export function PaymentDetail() {
  const { id = '' } = useParams()
  const s = useStore()
  const nav = useNavigate()
  const back = useFrom('/payments', 'Payments')
  const [reversing, setReversing] = useState(false)
  const p = s.payments.find(x => x.id === id)
  if (!p || !s.inBranch(s.client(p.clientId)?.branch ?? '')) return <div className="card"><EmptyState icon={Wallet} tone="neutral" title="We can’t find this payment" text="It may be in a branch you’ve filtered out." action={<Button onClick={() => nav('/payments')}>Open Payments</Button>} /></div>
  const c = s.client(p.clientId)!
  const reverse = (reason: string) => {
    s.setPayments(x => x.map(y => y.id === p.id ? { ...y, reversed: { reason, by: s.me.name, at: stampNow() } } : y))
    p.allocations.forEach(a => s.setInvoices(x => x.map(i => i.id === a.invoiceId ? { ...i, history: [...i.history, { by: s.me.name, at: stampNow(), text: `Payment ${p.id} reversed (${money(a.amount)}): ${reason}` }] } : i)))
    s.log({ type: 'Payment', action: `Reversed payment ${money(p.amount)}`, record: p.id, reason })
    s.toast(`${p.id} reversed. The invoices show as owed again.`); setReversing(false)
  }
  return (
    <>
      <DetailHead back={back} title={`${p.id} · ${money(p.amount)}`} crumb={p.id} chips={p.reversed ? <Chip tone="danger">Reversed</Chip> : <Chip tone="success">Received</Chip>}
        sub={`${c.name} · ${p.method} · received ${long(p.date)}`}
        actions={!p.reversed && <Button variant="secondary" icon={Undo2} onClick={() => setReversing(true)}>Reverse payment</Button>} />
      {p.reversed && <AlertBanner tone="danger" title="This payment was reversed">{p.reversed.reason} — {p.reversed.by}, {p.reversed.at}. It no longer counts against the invoices.</AlertBanner>}
      <div className="grid g-main-side" style={{ alignItems: 'start' }}>
        <div className="card">
          <CardHead title="Invoices it paid" />
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Invoice</th><th>Visits from</th><th className="num">Paid by this payment</th><th className="num">Still owed now</th><th>Status</th></tr></thead>
            <tbody>{p.allocations.map(a => { const i = s.invoices.find(x => x.id === a.invoiceId)!; const st = invoiceStatus(i, s.payments); return (
              <tr key={a.invoiceId} className="clickable-row" onClick={() => nav(`/invoices/${i.id}?from=/payments/${p.id}`)}><td className="t-medium">{i.id}</td><td>{long(i.from)} – {long(i.to)}</td><td className="num">{money(a.amount)}</td><td className="num">{money(balance(i, s.payments))}</td><td><Chip tone={statusTone(st)}>{st}</Chip></td></tr>) })}</tbody>
          </table></div>
        </div>
        <div className="card">
          <CardHead title="Payment details" />
          <div className="card-body"><dl className="kv" style={{ gridTemplateColumns: '120px 1fr' }}>
            <dt>Client</dt><dd><Link to={`/clients/${c.id}?from=/payments/${p.id}`}>{c.name}</Link></dd>
            <dt>Paid by</dt><dd>{s.profile(c.id)?.billTo}</dd>
            <dt>Amount</dt><dd>{money(p.amount)}</dd><dt>Received</dt><dd>{long(p.date)}</dd>
            <dt>How paid</dt><dd>{p.method}</dd><dt>Reference</dt><dd>{p.ref}</dd>
            {p.note && <><dt>Note</dt><dd>{p.note}</dd></>}
            <dt>Recorded by</dt><dd>{p.by}, {p.at}</dd>
          </dl></div>
        </div>
      </div>
      {reversing && <ReasonDialog title={`Reverse ${p.id}?`} text="Use this if the payment was entered by mistake or the bank returned it. The record is kept and the invoices show as owed again." confirm="Reverse payment" danger onClose={() => setReversing(false)} onConfirm={reverse} placeholder="For example: cheque bounced" />}
    </>
  )
}

/* ---------------- Money owed (balances and aging, BILL-09) ---------------- */
const BUCKET_COLOUR = ['var(--status-info)', 'var(--status-warning)', '#C46A1A', 'var(--status-danger)', '#7A1F1A']
export function Owed() {
  const s = useStore()
  const nav = useNavigate()
  const [paying, setPaying] = useState<string | null>(null)
  const [only, setOnly] = useState<'All' | 'Late'>('All')
  const open = s.invoices.filter(i => s.inBranch(i.branch) && balance(i, s.payments) > 0)
  const byBucket = AGING.map(b => r2(open.filter(i => agingOf(i) === b).reduce((a, i) => a + balance(i, s.payments), 0)))
  const total = r2(byBucket.reduce((a, x) => a + x, 0))
  const who = Array.from(new Set(open.map(i => i.clientId))).map(cid => {
    const inv = open.filter(i => i.clientId === cid)
    return { cid, inv, total: r2(inv.reduce((a, i) => a + balance(i, s.payments), 0)), buckets: AGING.map(b => r2(inv.filter(i => agingOf(i) === b).reduce((a, i) => a + balance(i, s.payments), 0))), late: Math.max(0, ...inv.map(daysLate)) }
  }).filter(x => only === 'All' || x.late > 0).sort((a, b) => b.late - a.late || b.total - a.total)
  const overdue = open.filter(i => invoiceStatus(i, s.payments) === 'Overdue').sort((a, b) => daysLate(b) - daysLate(a))
  return (
    <>
      <PageHead title="Money owed" crumb="Money owed" sub="Everything still owed on sent invoices, grouped by how late it is. Follow up the late ones and note what you were told." />
      <div className="card card-pad col" style={{ gap: 14 }}>
        <div className="row between wrap"><div><div className="t-caption t-muted">Still owed in total</div><div className="t-h1">{money(total)}</div></div><div className="t-small t-muted">{open.length} invoices · {new Set(open.map(i => i.clientId)).size} clients</div></div>
        <div className="aging-bar" aria-hidden>{byBucket.map((v, k) => v > 0 && <span key={k} style={{ width: `${(v / total) * 100}%`, background: BUCKET_COLOUR[k] }} />)}</div>
        <div className="aging">{AGING.map((b, k) => <div key={b} className="aging-cell"><div className="row t-caption t-muted" style={{ gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: BUCKET_COLOUR[k] }} />{b}</div><div className="t-h3" style={{ marginTop: 4 }}>{money(byBucket[k])}</div></div>)}</div>
      </div>
      <div className="col" style={{ gap: 16 }}>
        <div className="card">
          <CardHead title="Who owes what" action={<Select aria-label="Show" value={only} onChange={e => setOnly(e.target.value as 'All' | 'Late')} options={[{ value: 'All', label: 'Everyone who owes' }, { value: 'Late', label: 'Only late' }]} />} />
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Client · bills go to</th>{AGING.map(b => <th key={b} className="num">{b.replace(' late', '')}</th>)}<th className="num">Total</th><th /></tr></thead>
            <tbody>{who.map(x => { const c = s.client(x.cid)!; return (
              <tr key={x.cid}><td><Link to={`/clients/${c.id}?from=/owed`} className="t-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</Link><div className="t-caption t-muted">{s.profile(c.id)?.billTo} · {s.profile(c.id)?.payer}</div></td>
                {x.buckets.map((v, k) => <td key={k} className="num" style={{ color: v > 0 && k > 0 ? 'var(--status-danger)' : undefined }}>{v > 0 ? money(v) : '—'}</td>)}
                <td className="num t-medium">{money(x.total)}</td><td><Button size="sm" variant="secondary" onClick={() => setPaying(c.id)}>Record payment</Button></td></tr>) })}
              {who.length === 0 && <tr><td colSpan={8} className="t-muted">Nothing owed.</td></tr>}</tbody>
          </table></div>
        </div>
        <div className="card">
          <CardHead title="Late — follow up" sub="Oldest first" />
          <div className="card-body">{overdue.length === 0 ? <EmptyState icon={CheckCircle2} title="Nothing is late" text="Every sent invoice is within its payment terms." /> : overdue.map(i => (
            <button key={i.id} className="list-row clickable-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav(`/invoices/${i.id}?from=/owed`)}>
              <Clock3 size={16} color="var(--status-danger)" />
              <div className="grow"><div className="t-small t-medium">{i.id} · {s.client(i.clientId)?.name}</div><div className="t-caption t-muted">{money(balance(i, s.payments))} · due {long(i.due)}</div>
                {i.notes.length > 0 ? <div className="t-caption row" style={{ gap: 4 }}><MessageSquarePlus size={11} />{i.notes[i.notes.length - 1].text}</div> : <div className="t-caption" style={{ color: 'var(--status-warning)' }}>No follow-up yet</div>}</div>
              <Chip tone="danger">{daysLate(i)} days late</Chip>
            </button>))}</div>
        </div>
      </div>
      {paying && <RecordPayment clientId={paying} onClose={() => setPaying(null)} />}
    </>
  )
}
