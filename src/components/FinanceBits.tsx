import { ReactNode, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Wallet, MinusCircle } from 'lucide-react'
import { useStore, fmtDate, stampNow } from '../data/store'
import { Invoice, Payment, TODAY } from '../data/seed'
import { balance, money, r2 } from '../data/finance'
import { AlertBanner, Button, Field, Input, Modal, Select, Textarea } from './ui'

/** Where "Back" goes: the ?from= the user came from, or a sensible default. */
export function useFrom(fallback: string, fallbackLabel: string) {
  const [params] = useSearchParams()
  const from = params.get('from') || fallback
  const LABELS: [string, string][] = [['/invoices/', 'Invoice'], ['/invoices', 'Invoices'], ['/to-bill', 'Ready to bill'], ['/payments/', 'Payment'], ['/payments', 'Payments'], ['/owed', 'Money owed'], ['/timesheets/', 'Timesheet'], ['/timesheets', 'Timesheets'], ['/exports', 'Payroll exports'], ['/adjustments', 'Adjustments'], ['/clients/', 'Client billing'], ['/billing', 'Clients’ billing'], ['/pay-rates', 'Pay rates'], ['/visits/', 'Visit'], ['/reports', 'Reports']]
  const label = from === '/' ? 'My work' : LABELS.find(([p]) => from.startsWith(p))?.[1] ?? fallbackLabel
  return { from, label }
}

export function DetailHead({ back, title, chips, sub, crumb, actions, lead }: { back: { from: string; label: string }; title: ReactNode; chips?: ReactNode; sub?: ReactNode; crumb: string; actions?: ReactNode; lead?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <Link to={back.from} className="row t-small t-medium" style={{ gap: 6, marginBottom: 8 }}><ArrowLeft size={15} />{back.label}</Link>
        <div className="row wrap" style={{ gap: 12 }}>{lead}<div><div className="row wrap" style={{ gap: 10 }}><h1 className="t-h1">{title}</h1>{chips}</div>{sub && <div className="t-small t-muted" style={{ marginTop: 4 }}>{sub}</div>}</div></div>
        <div className="crumbs"><Link to="/">Home</Link><span>/</span><Link to={back.from}>{back.label}</Link><span>/</span><span>{crumb}</span></div>
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}

/** Record money received outside CORLIVA and say which invoices it pays (BILL-07). CORLIVA never takes payments itself. */
export function RecordPayment({ clientId, invoiceId, onClose, onDone }: { clientId?: string; invoiceId?: string; onClose: () => void; onDone?: (id: string) => void }) {
  const s = useStore()
  const owing = (cid: string) => s.invoices.filter(i => i.clientId === cid && balance(i, s.payments) > 0).sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))
  const withBalance = s.clients.filter(c => s.inBranch(c.branch) && owing(c.id).length)
  const [cid, setCid] = useState(clientId ?? s.invoices.find(i => i.id === invoiceId)?.clientId ?? '')
  const prof = s.profile(cid)
  const open = cid ? owing(cid) : []
  const [date, setDate] = useState(TODAY)
  const [amount, setAmount] = useState(() => { const i = s.invoices.find(x => x.id === invoiceId); return i ? String(balance(i, s.payments)) : '' })
  const [method, setMethod] = useState(prof ? defaultMethod(prof.payer) : 'Bank transfer')
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')
  const [alloc, setAlloc] = useState<Record<string, string>>(() => invoiceId ? { [invoiceId]: String(s.invoices.find(x => x.id === invoiceId) ? balance(s.invoices.find(x => x.id === invoiceId)!, s.payments) : '') } : {})
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const amt = Number(amount)
  const allocated = r2(Object.values(alloc).reduce((a, x) => a + (Number(x) || 0), 0))
  const fillOldestFirst = (total: number, list = open) => { let left = total; const out: Record<string, string> = {}; for (const i of list) { const b = balance(i, s.payments); const take = r2(Math.min(b, Math.max(0, left))); if (take > 0) out[i.id] = String(take); left = r2(left - take) } setAlloc(out) }
  const overOne = open.find(i => (Number(alloc[i.id]) || 0) > balance(i, s.payments) + 0.001)
  const errs = {
    cid: !cid ? 'Choose who paid.' : '',
    amount: !(amt > 0) ? 'Enter the amount received.' : '',
    date: !date || date > TODAY ? 'Choose the day the money arrived (not in the future).' : '',
    ref: !ref.trim() ? 'Add the bank or cheque reference so it can be matched later.' : '',
    alloc: overOne ? `That’s more than ${overOne.id} still owes.` : amt > 0 && Math.abs(allocated - amt) > 0.005 ? `Split the full ${money(amt || 0)} across the invoices (now ${money(allocated)}).` : '',
  }
  const save = () => {
    setTried(true); if (Object.values(errs).some(Boolean) || busy) return
    setBusy(true)
    const id = 'PAY-' + (Math.max(900, ...s.payments.map(p => Number(p.id.slice(4)))) + 1)
    const p: Payment = { id, clientId: cid, date, amount: r2(amt), method, ref: ref.trim(), by: s.me.name, at: stampNow(), note: note.trim() || undefined,
      allocations: Object.entries(alloc).filter(([, v]) => Number(v) > 0).map(([invoiceId, v]) => ({ invoiceId, amount: r2(Number(v)) })) }
    s.setPayments(x => [p, ...x])
    p.allocations.forEach(a => s.setInvoices(x => x.map(i => i.id === a.invoiceId ? { ...i, history: [...i.history, { by: s.me.name, at: stampNow(), text: `Payment ${id} recorded: ${money(a.amount)} (${method}, ${ref.trim()}).` }] } : i)))
    s.log({ type: 'Payment', action: `Recorded payment ${money(p.amount)}`, record: id, after: p.allocations.map(a => a.invoiceId).join(', ') })
    s.toast(`Payment of ${money(p.amount)} recorded.`); onDone?.(id); onClose()
  }
  return (
    <Modal wide title="Record a payment" sub="For money received outside CORLIVA — by bank, cheque, insurer or program. CORLIVA doesn’t take payments." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={Wallet} disabled={busy} onClick={save}>Save payment</Button></>}>
      <div className="grid g-2">
        <Field label="Who paid (client)" required error={tried ? errs.cid || undefined : undefined}>
          <Select value={cid} disabled={!!clientId || !!invoiceId} onChange={e => { setCid(e.target.value); setAlloc({}); const pf = s.profile(e.target.value); if (pf) setMethod(defaultMethod(pf.payer)) }} options={[{ value: '', label: 'Choose a client' }, ...withBalance.map(c => ({ value: c.id, label: `${c.name} — ${s.profile(c.id)?.billTo ?? ''}` }))]} />
        </Field>
        <Field label="Day the money arrived" required error={tried ? errs.date || undefined : undefined}><Input type="date" max={TODAY} value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Amount received" required error={tried ? errs.amount || undefined : undefined}><Input inputMode="decimal" value={amount} onChange={e => { setAmount(e.target.value.replace(/[^\d.]/g, '')); }} onBlur={() => { if (amt > 0 && !invoiceId) fillOldestFirst(amt) }} placeholder="0.00" /></Field>
        <Field label="How it was paid" required><Select value={method} onChange={e => setMethod(e.target.value)} options={s.rules.paymentMethods} /></Field>
        <Field label="Reference" required helper="Bank reference, cheque number or remittance number." error={tried ? errs.ref || undefined : undefined}><Input value={ref} onChange={e => setRef(e.target.value)} placeholder="For example TRF-5123" /></Field>
        <Field label="Note" helper="Optional."><Input value={note} onChange={e => setNote(e.target.value)} /></Field>
      </div>
      {cid && <div className="col" style={{ gap: 8 }}>
        <div className="row between"><span className="t-small t-medium">Which invoices does it pay?</span>{amt > 0 && <button className="link-btn" onClick={() => fillOldestFirst(amt)}>Oldest first</button>}</div>
        {open.length === 0 ? <div className="t-small t-muted">Nothing is owed on this client’s invoices.</div> : open.map(i => (
          <div key={i.id} className="list-row" style={{ padding: 10 }}>
            <div className="grow"><div className="t-small t-medium">{i.id} · {fmtDate(i.from, { day: 'numeric', month: 'short' })} – {fmtDate(i.to, { day: 'numeric', month: 'short' })}</div><div className="t-caption t-muted">Still owed {money(balance(i, s.payments))} · due {fmtDate(i.due ?? '')}</div></div>
            <div style={{ width: 130 }}><Input inputMode="decimal" aria-label={`Amount for ${i.id}`} value={alloc[i.id] ?? ''} onChange={e => setAlloc(a => ({ ...a, [i.id]: e.target.value.replace(/[^\d.]/g, '') }))} placeholder="0.00" /></div>
          </div>))}
        {tried && errs.alloc && <span className="t-caption" style={{ color: 'var(--status-danger)' }}>{errs.alloc}</span>}
      </div>}
    </Modal>
  )
}
const defaultMethod = (payer: string) => payer === 'Long-term care insurance' ? 'Insurance payment' : payer === 'Medicaid waiver' ? 'Medicaid payment' : payer === 'Veterans benefits' ? 'VA payment' : 'Bank transfer'

/** A credit lowers what is owed on a sent invoice. Sent invoices are never edited (BILL-08). */
export function CreditModal({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const s = useStore()
  const owed = balance(inv, s.payments)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const amt = Number(amount)
  const err = !(amt > 0) ? 'Enter the amount to credit.' : amt > owed + 0.001 ? `It can’t be more than what is still owed (${money(owed)}).` : ''
  const save = () => {
    setTried(true); if (err || reason.trim().length < 5) return
    const id = 'CN-' + (300 + s.invoices.reduce((a, i) => a + i.credits.length, 0) + 1)
    s.setInvoices(x => x.map(i => i.id === inv.id ? { ...i, credits: [...i.credits, { id, date: TODAY, amount: r2(amt), reason: reason.trim(), by: s.me.name }], history: [...i.history, { by: s.me.name, at: stampNow(), text: `Credit ${id} for ${money(amt)}: ${reason.trim()}` }] } : i))
    s.log({ type: 'Invoice', action: `Added credit ${id} (${money(amt)})`, record: inv.id, reason: reason.trim() })
    s.toast(`Credit ${id} added. ${inv.id} now owes ${money(r2(owed - amt))}.`); onClose()
  }
  return (
    <Modal title={`Add a credit to ${inv.id}`} sub="Lowers what is owed. The invoice itself doesn’t change — the credit is shown under it." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={MinusCircle} onClick={save}>Add credit</Button></>}>
      <Field label="Amount" required error={tried && err ? err : undefined} helper={`Still owed: ${money(owed)}`}><Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" /></Field>
      <Field label="Reason" required error={tried && reason.trim().length < 5 ? 'Say why — this is kept with the invoice.' : undefined}><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="For example: visit on 3 Nov was shorter than billed" /></Field>
      <AlertBanner tone="info" title="Kept for the record">The person who pays will see the credit on their statement.</AlertBanner>
    </Modal>
  )
}
