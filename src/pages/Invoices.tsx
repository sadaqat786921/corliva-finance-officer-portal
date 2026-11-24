import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FileText, Send, Printer, Wallet, MinusCircle, Ban, MessageSquarePlus, Mail, Trash2, Search, Lock } from 'lucide-react'
import { useStore, fmtDate, stampNow } from '../data/store'
import { Invoice, TODAY, addDays } from '../data/seed'
import { InvoiceStatus, balance, creditTotal, daysLate, hoursText, invoiceStatus, invoiceTotal, lineAmount, money, paidOn, statusTone } from '../data/finance'
import { AlertBanner, Button, CardHead, Chip, ConfirmDialog, EmptyState, Input, Modal, PageHead, Pager, ReasonDialog, Select, Tabs, Textarea, Field, usePaged } from '../components/ui'
import { CreditModal, DetailHead, RecordPayment, useFrom } from '../components/FinanceBits'

const short = (d: string) => fmtDate(d, { day: 'numeric', month: 'short' })
const long = (d?: string) => d ? fmtDate(d, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
type Tab = 'Drafts' | 'Waiting for payment' | 'Paid' | 'Cancelled' | 'All'
const inTab = (t: Tab, st: InvoiceStatus) => t === 'All' || (t === 'Drafts' ? st === 'Draft' : t === 'Waiting for payment' ? ['Sent', 'Partly paid', 'Overdue'].includes(st) : t === 'Paid' ? st === 'Paid' : st === 'Cancelled')

export default function Invoices() {
  const s = useStore()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = ((['Drafts', 'Waiting for payment', 'Paid', 'Cancelled', 'All'] as Tab[]).find(t => t === params.get('tab')) ?? 'Waiting for payment') as Tab
  const [q, setQ] = useState('')
  const [payer, setPayer] = useState('All payers')
  const all = useMemo(() => s.invoices.filter(i => s.inBranch(i.branch)).map(i => ({ i, st: invoiceStatus(i, s.payments) })), [s.invoices, s.payments, s.branch])
  const rows = all.filter(x => inTab(tab, x.st) && (payer === 'All payers' || x.i.payer === payer) && (!q.trim() || `${x.i.id} ${s.client(x.i.clientId)?.name} ${x.i.billTo}`.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => tab === 'Waiting for payment' ? (a.i.due ?? '').localeCompare(b.i.due ?? '') : b.i.id.localeCompare(a.i.id))
  const pg = usePaged(rows, 12)
  const count = (t: Tab) => all.filter(x => inTab(t, x.st)).length
  return (
    <>
      <PageHead title="Invoices" crumb="Invoices" sub="Drafts are made from approved visits. Once sent, an invoice is never changed — use a credit or cancel it with a reason." actions={<Button icon={FileText} onClick={() => nav('/to-bill')}>Make an invoice</Button>} />
      <div className="card">
        <Tabs tabs={(['Drafts', 'Waiting for payment', 'Paid', 'Cancelled', 'All'] as Tab[]).map(t => ({ id: t, label: t, count: count(t) }))} value={tab} onChange={t => { setParams({ tab: t }, { replace: true }); pg.setPage(1) }} />
        <div className="row wrap" style={{ gap: 10, padding: 16 }}>
          <div style={{ width: 280 }}><Input icon={Search} placeholder="Invoice number, client or who pays" value={q} onChange={e => { setQ(e.target.value); pg.setPage(1) }} /></div>
          <div style={{ width: 220 }}><Select value={payer} onChange={e => setPayer(e.target.value)} options={['All payers', ...s.rules.payers]} /></div>
        </div>
        {rows.length === 0 ? <EmptyState icon={FileText} tone="neutral" title="No invoices here" text={tab === 'Drafts' ? 'Make drafts from Ready to bill.' : 'Try another tab or filter.'} /> : <>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Invoice</th><th>Client</th><th>Visits from</th><th>Bills go to</th><th>Sent</th><th>Due</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>Still owed</th><th>Status</th></tr></thead>
            <tbody>{pg.items.map(({ i, st }) => (
              <tr key={i.id} className="clickable-row" onClick={() => nav(`/invoices/${i.id}?from=/invoices?tab=${encodeURIComponent(tab)}`)}>
                <td className="t-medium">{i.id}</td><td>{s.client(i.clientId)?.name}<div className="t-caption t-muted">{s.branchName(i.branch)}</div></td>
                <td>{short(i.from)} – {short(i.to)}</td><td>{i.billTo}<div className="t-caption t-muted">{i.payer}</div></td>
                <td>{i.issued ? short(i.issued) : '—'}</td><td>{i.due ? short(i.due) : '—'}{st === 'Overdue' && <div className="t-caption" style={{ color: 'var(--status-danger)' }}>{daysLate(i)} days late</div>}</td>
                <td style={{ textAlign: 'right' }}>{money(invoiceTotal(i))}</td><td style={{ textAlign: 'right' }} className="t-medium">{st === 'Draft' || st === 'Cancelled' ? '—' : money(balance(i, s.payments))}</td>
                <td><Chip tone={statusTone(st)}>{st}</Chip></td></tr>))}</tbody>
          </table></div>
          <Pager {...pg.pager} />
        </>}
      </div>
    </>
  )
}

export function InvoiceDetail() {
  const { id = '' } = useParams()
  const s = useStore()
  const nav = useNavigate()
  const back = useFrom('/invoices', 'Invoices')
  const [act, setAct] = useState<null | 'send' | 'cancelDraft' | 'cancel' | 'pay' | 'credit' | 'note' | 'resend' | { remove: string }>(null)
  const i = s.invoices.find(x => x.id === id)
  if (!i || !s.inBranch(i.branch)) return <div className="card"><EmptyState icon={FileText} tone="neutral" title="We can’t find this invoice" text="It may be in a branch you’ve filtered out, or the link is old." action={<Button onClick={() => nav('/invoices')}>Open Invoices</Button>} /></div>
  const c = s.client(i.clientId)!
  const prof = s.profile(i.clientId)
  const st = invoiceStatus(i, s.payments)
  const total = invoiceTotal(i), paid = paidOn(i, s.payments), credits = creditTotal(i), owed = balance(i, s.payments)
  const pays = s.payments.filter(p => p.allocations.some(a => a.invoiceId === i.id))
  const here = `/invoices/${i.id}`
  const upd = (fn: (x: Invoice) => Invoice, text: string) => s.setInvoices(x => x.map(y => y.id === i.id ? { ...fn(y), history: [...y.history, { by: s.me.name, at: stampNow(), text }] } : y))

  const send = () => {
    const due = addDays(i.terms)
    upd(x => ({ ...x, state: 'Sent', issued: TODAY, due, issuedBy: s.me.name }), `Sent to ${i.billTo}. Due ${long(due)}.`)
    s.log({ type: 'Invoice', action: 'Sent invoice', record: i.id, after: money(total) })
    s.toast(`${i.id} sent to ${i.billTo}. Due ${long(due)}.`); setAct(null)
  }
  const removeLine = (lineId: string) => {
    const l = i.lines.find(x => x.id === lineId)!
    upd(x => ({ ...x, lines: x.lines.filter(y => y.id !== lineId) }), `Took off the ${short(l.date)} ${l.kind === 'Visit' ? 'visit' : 'correction'} — it goes back to Ready to bill.`)
    if (l.kind === 'Correction') s.setBillCorrections(x => x.map(y => y.invoiceId === i.id && y.visitId === l.visitId && y.text === l.text ? { ...y, invoiceId: undefined } : y))
    s.toast('Taken off the draft. It’s back in Ready to bill.'); setAct(null)
  }
  const cancel = (reason: string, draft: boolean) => {
    upd(x => ({ ...x, state: 'Cancelled', cancelReason: reason, credits: draft ? x.credits : [...x.credits, { id: 'CN-' + (300 + s.invoices.reduce((a, y) => a + y.credits.length, 0) + 1), date: TODAY, amount: owed, reason: `Invoice cancelled: ${reason}`, by: s.me.name }] }), `${draft ? 'Draft cancelled' : 'Invoice cancelled with a full credit'}: ${reason}`)
    s.setBillCorrections(x => x.map(y => y.invoiceId === i.id ? { ...y, invoiceId: undefined } : y))
    s.log({ type: 'Invoice', action: draft ? 'Cancelled a draft' : 'Cancelled an invoice (full credit)', record: i.id, reason })
    s.toast(`${i.id} cancelled. Its visits are back in Ready to bill.`); setAct(null)
  }
  return (
    <>
      <DetailHead back={back} title={`${i.id} · ${c.name}`} crumb={i.id} chips={<Chip tone={statusTone(st)}>{st}</Chip>}
        sub={<>{i.payer} · visits {long(i.from)} – {long(i.to)} · {s.branchName(i.branch)}</>}
        actions={<>
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>
          {i.state === 'Draft' && <><Button variant="secondary" icon={Ban} onClick={() => setAct('cancelDraft')}>Cancel draft</Button><Button icon={Send} disabled={!i.lines.length} onClick={() => setAct('send')}>Send invoice</Button></>}
          {i.state === 'Sent' && <>
            <Button variant="secondary" icon={MessageSquarePlus} onClick={() => setAct('note')}>Add follow-up note</Button>
            {owed > 0 && <Button variant="secondary" icon={MinusCircle} onClick={() => setAct('credit')}>Add credit</Button>}
            {owed > 0 && paid === 0 && <Button variant="secondary" icon={Ban} onClick={() => setAct('cancel')}>Cancel invoice</Button>}
            {owed > 0 && <Button icon={Wallet} onClick={() => setAct('pay')}>Record payment</Button>}
          </>}
        </>} />
      {st === 'Overdue' && <AlertBanner tone="danger" title={`${daysLate(i)} days late — ${money(owed)} still owed`} action={<Button size="sm" variant="secondary" icon={MessageSquarePlus} onClick={() => setAct('note')}>Add follow-up note</Button>}>Contact {i.billTo}: {i.billToContact}.</AlertBanner>}
      {i.state === 'Draft' && <AlertBanner tone="info" title="This is a draft">Check the lines and totals. You can take a line off (it goes back to Ready to bill). Once sent, it can’t be changed.</AlertBanner>}
      {i.state === 'Sent' && <div className="row t-small t-muted" style={{ gap: 6 }}><Lock size={13} />Sent invoices are never changed. Use a credit, or cancel it with a reason, and keep every record.</div>}
      {i.state === 'Cancelled' && <AlertBanner tone="warning" title="Cancelled">{i.cancelReason}. Its visits went back to Ready to bill.</AlertBanner>}

      <div className="grid g-main-side" style={{ alignItems: 'start' }}>
        <div className="card invoice-doc">
          <div className="card-body col" style={{ gap: 18 }}>
            <div className="row between wrap" style={{ alignItems: 'flex-start', gap: 16 }}>
              <div><img src="./images/corliva-logo.svg" alt="" style={{ height: 26 }} /><div className="t-strong" style={{ marginTop: 10 }}>{s.agency.name}</div><div className="t-caption t-muted">{s.agency.address}<br />{s.agency.phone} · {s.agency.email}</div></div>
              <div style={{ textAlign: 'right' }}><div className="t-h2">Invoice {i.id}</div><div className="t-small t-muted">{i.issued ? `Sent ${long(i.issued)} · due ${long(i.due)}` : 'Draft — not sent yet'}</div><div className="t-small t-muted">Pay within {i.terms} days</div></div>
            </div>
            <div className="grid g-2">
              <div><div className="t-caption t-muted">Bill to</div><div className="t-medium">{i.billTo}</div><div className="t-caption t-muted">{i.billToContact}{prof?.billToAddress ? <><br />{prof.billToAddress}</> : null}</div></div>
              <div><div className="t-caption t-muted">Care for</div><div className="t-medium">{c.name}</div><div className="t-caption t-muted">{c.address}<br />Visits {long(i.from)} – {long(i.to)}</div></div>
            </div>
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>Date</th><th>What</th><th>Hours</th><th>Rate</th><th style={{ textAlign: 'right' }}>Amount</th>{i.state === 'Draft' && <th />}</tr></thead>
              <tbody>{[...i.lines].sort((a, b) => a.date.localeCompare(b.date)).map(l => (
                <tr key={l.id}><td><Link to={`/visits/${l.visitId}?from=${here}`}>{fmtDate(l.date, { weekday: 'short', day: 'numeric', month: 'short' })}</Link></td>
                  <td>{l.kind === 'Correction' ? <><Chip tone="warning">Correction</Chip> <span className="t-small">{l.text}</span></> : l.text}</td>
                  <td>{l.hours > 0 ? '' : ''}{hoursText(l.hours)}</td><td>{money(l.rate)}</td><td style={{ textAlign: 'right' }}>{money(lineAmount(l))}</td>
                  {i.state === 'Draft' && <td style={{ textAlign: 'right' }}><button className="link-btn" aria-label="Take off" onClick={() => setAct({ remove: l.id })}><Trash2 size={14} /></button></td>}</tr>))}</tbody>
            </table></div>
            <div className="col" style={{ alignSelf: 'flex-end', minWidth: 260, gap: 6 }}>
              <div className="row between t-small"><span>Total</span><span className="t-medium">{money(total)}</span></div>
              {credits > 0 && <div className="row between t-small"><span>Credits</span><span>-{money(credits)}</span></div>}
              {paid > 0 && <div className="row between t-small"><span>Paid</span><span>-{money(paid)}</span></div>}
              {i.state === 'Sent' && <div className="row between t-h3" style={{ borderTop: '1px solid var(--border-default)', paddingTop: 8 }}><span>Still owed</span><span>{money(owed)}</span></div>}
            </div>
            <div className="t-caption t-muted">Each line is an approved visit, billed to the nearest {s.rules.billingUnitMins} minutes at the rate that applied on that day. Pay by bank transfer quoting {i.id}.</div>
          </div>
        </div>
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <CardHead title="Payments" action={i.state === 'Sent' && owed > 0 && <button className="link-btn" onClick={() => setAct('pay')}>Record payment</button>} />
            <div className="card-body">{pays.length === 0 ? <div className="t-small t-muted">No payments yet.</div> : pays.map(p => { const a = p.allocations.find(x => x.invoiceId === i.id)!; return (
              <Link key={p.id} to={`/payments/${p.id}?from=${here}`} className="list-row" style={{ color: 'var(--text-primary)' }}><Wallet size={15} color="var(--text-muted)" /><div className="grow"><div className="t-small t-medium">{money(a.amount)} · {long(p.date)}</div><div className="t-caption t-muted">{p.method} · {p.ref}</div></div>{p.reversed ? <Chip tone="danger">Reversed</Chip> : <Chip tone="success">Received</Chip>}</Link>) })}</div>
          </div>
          {i.credits.length > 0 && <div className="card"><CardHead title="Credits" /><div className="card-body">{i.credits.map(cr => <div key={cr.id} className="list-row"><MinusCircle size={15} color="var(--text-muted)" /><div className="grow"><div className="t-small t-medium">{cr.id} · {money(cr.amount)}</div><div className="t-caption t-muted">{cr.reason} · {cr.by}, {long(cr.date)}</div></div></div>)}</div></div>}
          <div className="card">
            <CardHead title="Follow-up notes" action={i.state === 'Sent' && <button className="link-btn" onClick={() => setAct('note')}>Add note</button>} />
            <div className="card-body">{i.notes.length === 0 ? <div className="t-small t-muted">No notes.</div> : [...i.notes].reverse().map((n, k) => <div key={k} className="note"><div className="t-small">{n.text}</div><div className="t-caption t-muted">{n.by} · {n.at}</div></div>)}</div>
          </div>
          <div className="card">
            <CardHead title="About this invoice" />
            <div className="card-body"><dl className="kv" style={{ gridTemplateColumns: '110px 1fr' }}>
              <dt>Client</dt><dd><Link to={`/clients/${c.id}?from=${here}`}>{c.name}</Link></dd>
              <dt>Made by</dt><dd>{i.createdBy}, {long(i.created)}</dd>
              {i.issuedBy && <><dt>Sent by</dt><dd>{i.issuedBy}, {long(i.issued)}</dd></>}
              <dt>Visits</dt><dd>{i.lines.filter(l => l.kind === 'Visit').length}</dd>
            </dl>{i.state === 'Sent' && <button className="link-btn row" style={{ gap: 6, marginTop: 10 }} onClick={() => setAct('resend')}><Mail size={14} />Send a copy again</button>}</div>
          </div>
          <div className="card"><CardHead title="History" /><div className="card-body">{[...i.history].reverse().map((h, k) => <div key={k} className="note"><div className="t-small">{h.text}</div><div className="t-caption t-muted">{h.by} · {h.at}</div></div>)}</div></div>
        </div>
      </div>

      {act === 'send' && <ConfirmDialog title={`Send ${i.id}?`} text={`${money(total)} to ${i.billTo} (${i.billToContact}). It will be due on ${long(addDays(i.terms))}. After sending, the invoice can’t be changed.`} confirm="Send invoice" onClose={() => setAct(null)} onConfirm={send} />}
      {act === 'resend' && <ConfirmDialog title="Send a copy again?" text={`A copy of ${i.id} goes to ${i.billTo} (${i.billToContact}). Nothing on the invoice changes.`} confirm="Send copy" onClose={() => setAct(null)} onConfirm={() => { upd(x => x, `Copy sent again to ${i.billTo}.`); s.toast('Copy sent.'); setAct(null) }} />}
      {typeof act === 'object' && act && <ConfirmDialog title="Take this line off the draft?" text="It goes back to Ready to bill, so you can put it on a later invoice." confirm="Take off" onClose={() => setAct(null)} onConfirm={() => removeLine(act.remove)} />}
      {act === 'cancelDraft' && <ReasonDialog title={`Cancel draft ${i.id}?`} text="The draft is kept for the record and its visits go back to Ready to bill." confirm="Cancel draft" danger onClose={() => setAct(null)} onConfirm={r => cancel(r, true)} />}
      {act === 'cancel' && <ReasonDialog title={`Cancel ${i.id}?`} text={`A full credit of ${money(owed)} is added so nothing is owed. The invoice is kept and its visits go back to Ready to bill, so they can be billed correctly.`} confirm="Cancel invoice" danger onClose={() => setAct(null)} onConfirm={r => cancel(r, false)} placeholder="For example: sent to the wrong insurer" />}
      {act === 'pay' && <RecordPayment invoiceId={i.id} onClose={() => setAct(null)} />}
      {act === 'credit' && <CreditModal inv={i} onClose={() => setAct(null)} />}
      {act === 'note' && <NoteModal onClose={() => setAct(null)} onSave={t => { s.setInvoices(x => x.map(y => y.id === i.id ? { ...y, notes: [...y.notes, { by: s.me.name, at: stampNow(), text: t }] } : y)); s.toast('Note added.'); setAct(null) }} />}
    </>
  )
}

function NoteModal({ onClose, onSave }: { onClose: () => void; onSave: (t: string) => void }) {
  const [t, setT] = useState(''); const [tried, setTried] = useState(false)
  return <Modal title="Add a follow-up note" sub="For example who you spoke to and when they said they’d pay." onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => { setTried(true); if (t.trim().length >= 3) onSave(t.trim()) }}>Save note</Button></>}>
    <Field label="Note" required error={tried && t.trim().length < 3 ? 'Write a short note.' : undefined}><Textarea value={t} onChange={e => setT(e.target.value)} placeholder="Called Jim Fields — he’ll pay on Friday." /></Field>
  </Modal>
}
