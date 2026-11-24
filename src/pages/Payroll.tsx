import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FileSpreadsheet, CheckCircle2, Undo2, Send, TriangleAlert, Car, Plus, Download, RotateCcw, Info, Lock, Copy } from 'lucide-react'
import { useStore, fmtDate, stampNow } from '../data/store'
import { ExportBatch, Period, TODAY, Timesheet, rateOn } from '../data/seed'
import { downloadCsv, hoursText, money, periodLabel, r2, timesheetDetail, tsTone } from '../data/finance'
import { AlertBanner, Button, CardHead, Chip, ConfirmDialog, EmptyState, Field, Input, Modal, PageHead, ReasonDialog, Select, Textarea } from '../components/ui'
import { DetailHead, useFrom } from '../components/FinanceBits'

const day = (d: string) => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })
const pl = (p: Period) => periodLabel(p, fmtDate)
const stateText = (t: Timesheet['state']) => t === 'To check' ? 'To check' : t === 'Returned' ? 'Sent back' : t

/** Helper: everything worked out for one timesheet. */
function useDetail() {
  const s = useStore()
  return (t: Timesheet) => timesheetDetail(t, s.caregiver(t.caregiverId)!, s.period(t.periodId), s.visits, s.payCorrections)
}

/* ---------------- Timesheets list ---------------- */
export default function Timesheets() {
  const s = useStore()
  const nav = useNavigate()
  const detail = useDetail()
  const [params, setParams] = useSearchParams()
  const withSheets = s.periods.filter(p => s.timesheets.some(t => t.periodId === p.id))
  const pid = params.get('period') ?? 'P1'
  const p = s.period(pid)
  const [picked, setPicked] = useState<string[]>([])
  const [confirm, setConfirm] = useState(false)
  const rows = useMemo(() => s.timesheets.filter(t => t.periodId === pid && s.inBranch(s.caregiver(t.caregiverId)?.branch ?? '')).map(t => ({ t, g: s.caregiver(t.caregiverId)!, d: detail(t) }))
    .sort((a, b) => ['Returned', 'To check', 'Approved', 'Exported'].indexOf(a.t.state) - ['Returned', 'To check', 'Approved', 'Exported'].indexOf(b.t.state) || a.g.name.localeCompare(b.g.name)), [s.timesheets, s.visits, s.payCorrections, s.caregivers, pid, s.branch])
  const canApprove = rows.filter(x => x.t.state === 'To check' && !x.d.issues.length).map(x => x.t.id)
  const approveMany = () => {
    const ids = picked.filter(id => canApprove.includes(id))
    s.setTimesheets(x => x.map(t => ids.includes(t.id) ? { ...t, state: 'Approved', approvedBy: s.me.name, approvedAt: stampNow(), history: [...t.history, { by: s.me.name, at: stampNow(), text: 'Approved.' }] } : t))
    ids.forEach(id => s.log({ type: 'Timesheet', action: 'Approved timesheet', record: id }))
    s.toast(`${ids.length} timesheet${ids.length > 1 ? 's' : ''} approved. Ready to export.`); setPicked([]); setConfirm(false)
  }
  const current = s.periods[0]
  return (
    <>
      <PageHead title="Timesheets" crumb="Timesheets" sub="Made from visits the Care Supervisor approved. Check hours, mileage and allowances, send back anything that’s wrong, then approve. CORLIVA prepares pay — your payroll provider works out tax."
        actions={<><Button variant="secondary" icon={Download} onClick={() => nav('/exports')}>Payroll exports</Button><Button icon={CheckCircle2} disabled={!picked.length} onClick={() => setConfirm(true)}>Approve selected{picked.length ? ` (${picked.length})` : ''}</Button></>} />
      <div className="card card-pad row wrap" style={{ gap: 16 }}>
        <div style={{ width: 300 }}><Field label="Pay period"><Select value={pid} onChange={e => { setParams({ period: e.target.value }, { replace: true }); setPicked([]) }} options={withSheets.map(x => ({ value: x.id, label: `${pl(x)}${x.id === 'P1' ? ' · last finished' : ''}` }))} /></Field></div>
        <div className="grow t-small t-muted row" style={{ gap: 6 }}><Info size={14} />This pay period ({pl(current)}) is still running. Its timesheets are made when it ends on {fmtDate(current.to, { day: 'numeric', month: 'short' })}.</div>
      </div>
      <div className="grid g-4">
        {(['To check', 'Returned', 'Approved', 'Exported'] as Timesheet['state'][]).map(st => <div key={st} className="card card-pad"><div className="t-caption t-muted">{stateText(st)}</div><div className="t-h2">{rows.filter(x => x.t.state === st).length}</div></div>)}
      </div>
      <div className="card">
        <CardHead title={`Timesheets · ${pl(p)}`} sub="Tick the ones with nothing to fix to approve them together." />
        {rows.length === 0 ? <EmptyState icon={FileSpreadsheet} tone="neutral" title="No timesheets for this period" text="Timesheets are made from approved visits when a pay period ends." /> :
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th style={{ width: 36 }} /><th>Caregiver</th><th className="num">Planned</th><th className="num">Approved</th><th className="num">Weekend</th><th className="num">Overtime</th><th className="num">Miles</th><th className="num">Pay before tax</th><th>To sort out</th><th>Status</th></tr></thead>
            <tbody>{rows.map(({ t, g, d }) => (
              <tr key={t.id} className="clickable-row" onClick={() => nav(`/timesheets/${t.id}?from=/timesheets?period=${pid}`)}>
                <td onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Pick ${g.name}`} disabled={!canApprove.includes(t.id)} checked={picked.includes(t.id)} onChange={e => setPicked(x => e.target.checked ? [...x, t.id] : x.filter(y => y !== t.id))} /></td>
                <td className="t-medium">{g.name}<div className="t-caption t-muted">{g.type} · {s.branchName(g.branch)}</div></td>
                <td className="num">{hoursText(d.planned)}</td><td className="num t-medium">{hoursText(d.approved)}</td><td className="num">{d.weekend ? hoursText(d.weekend) : '—'}</td><td className="num">{d.overtime ? hoursText(d.overtime) : '—'}</td>
                <td className="num">{d.miles || '—'}</td><td className="num t-medium">{money(d.gross)}</td>
                <td>{d.issues.length ? <Chip tone="danger">{d.issues.length} not approved</Chip> : t.state === 'Returned' ? <Chip tone="danger">Waiting on supervisor</Chip> : <span className="t-muted">—</span>}</td>
                <td><Chip tone={tsTone(t.state)}>{stateText(t.state)}</Chip></td></tr>))}</tbody>
          </table></div>}
      </div>
      {confirm && <ConfirmDialog title={`Approve ${picked.length} timesheet${picked.length > 1 ? 's' : ''}?`} text="They’ll be ready to go in the next payroll export. You can undo an approval until they’re exported." confirm="Approve" onClose={() => setConfirm(false)} onConfirm={approveMany} />}
    </>
  )
}

/* ---------------- One timesheet ---------------- */
export function TimesheetDetail() {
  const { id = '' } = useParams()
  const s = useStore()
  const nav = useNavigate()
  const back = useFrom('/timesheets', 'Timesheets')
  const detail = useDetail()
  const [act, setAct] = useState<null | 'approve' | 'return' | 'again' | 'undo' | 'mile' | 'allow'>(null)
  const t = s.timesheets.find(x => x.id === id)
  const g = t && s.caregiver(t.caregiverId)
  if (!t || !g || !s.inBranch(g.branch)) return <div className="card"><EmptyState icon={FileSpreadsheet} tone="neutral" title="We can’t find this timesheet" text="It may be in a branch you’ve filtered out." action={<Button onClick={() => nav('/timesheets')}>Open Timesheets</Button>} /></div>
  const p = s.period(t.periodId)
  const d = detail(t)
  const editable = t.state === 'To check' || t.state === 'Returned'
  const here = `/timesheets/${t.id}`
  const upd = (fn: (x: Timesheet) => Timesheet, text: string) => s.setTimesheets(x => x.map(y => y.id === t.id ? { ...fn(y), history: [...y.history, { by: s.me.name, at: stampNow(), text }] } : y))
  const supervisor = s.users.find(u => u.role === 'Care Supervisor')?.name ?? 'the Care Supervisor'
  const base = rateOn(g.pay, p.to)
  return (
    <>
      <DetailHead back={back} title={`${g.name} · timesheet`} crumb={g.name} chips={<Chip tone={tsTone(t.state)}>{stateText(t.state)}</Chip>}
        sub={<>Pay period {pl(p)} · {g.type} · {s.branchName(g.branch)} · <Link to={`/pay-rates/${g.id}?from=${here}`}>{money(base)} an hour</Link></>}
        actions={<>
          {t.state === 'To check' && <><Button variant="secondary" icon={Send} onClick={() => setAct('return')}>Send back to fix</Button><Button icon={CheckCircle2} disabled={d.issues.length > 0} onClick={() => setAct('approve')}>Approve timesheet</Button></>}
          {t.state === 'Returned' && <Button icon={RotateCcw} onClick={() => setAct('again')}>It’s fixed — check again</Button>}
          {t.state === 'Approved' && <Button variant="secondary" icon={Undo2} onClick={() => setAct('undo')}>Undo approval</Button>}
          {t.state === 'Exported' && t.batchId && <Button variant="secondary" icon={Download} onClick={() => nav(`/exports/${t.batchId}?from=${here}`)}>See export {t.batchId}</Button>}
        </>} />
      {d.issues.length > 0 && <AlertBanner tone="danger" title={`${d.issues.length} visit${d.issues.length > 1 ? 's' : ''} not approved yet`}>These aren’t paid until {supervisor} approves them. You can’t approve this timesheet until they’re sorted.</AlertBanner>}
      {t.state === 'Returned' && t.returned && <AlertBanner tone="danger" title={`Sent back to ${supervisor}`}>{t.returned.reason} — {t.returned.by}, {t.returned.at}</AlertBanner>}
      {t.state === 'Exported' && <div className="row t-small t-muted" style={{ gap: 6 }}><Lock size={13} />Exported in {t.batchId}. It can’t be changed — later corrections go in a separate corrections export.</div>}

      <div className="grid g-4">
        <div className="card card-pad"><div className="t-caption t-muted">Planned hours</div><div className="t-h2">{hoursText(d.planned)}</div><div className="t-caption t-muted">From the schedule</div></div>
        <div className="card card-pad"><div className="t-caption t-muted">Approved hours</div><div className="t-h2">{hoursText(d.approved)}</div><div className="t-caption t-muted">Regular {hoursText(d.regular)} · weekend {hoursText(d.weekend)} · overtime {hoursText(d.overtime)}</div></div>
        <div className="card card-pad"><div className="t-caption t-muted">Mileage and allowances</div><div className="t-h2">{money(r2(d.mileagePay + d.allowancePay))}</div><div className="t-caption t-muted">{d.miles} miles · {t.allowances.length} allowance{t.allowances.length === 1 ? '' : 's'}</div></div>
        <div className="card card-pad"><div className="t-caption t-muted">Pay before tax</div><div className="t-h2">{money(d.gross)}</div><div className="t-caption t-muted">Payroll works out tax</div></div>
      </div>

      <div className="grid g-main-side" style={{ alignItems: 'start' }}>
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <CardHead title="Visits" sub={`Planned, recorded and approved hours are shown apart. Approved time is paid to the nearest ${s.rules.billingUnitMins} minutes.`} />
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>Date</th><th>Client</th><th className="num">Planned</th><th className="num">Recorded</th><th className="num">Approved</th><th>Type</th><th className="num">Rate</th><th className="num">Pay</th></tr></thead>
              <tbody>{d.lines.map((l, k) => (
                <tr key={l.visitId + k}><td><Link to={`/visits/${l.visitId}?from=${here}`}>{day(l.date)}</Link></td><td>{s.client(l.clientId)?.name}{l.correction && <div className="t-caption" style={{ color: 'var(--status-warning)' }}>Correction: {l.correction}</div>}</td>
                  <td className="num">{l.planned ? hoursText(l.planned) : '—'}</td><td className="num">{l.recorded !== null ? hoursText(r2(l.recorded)) : '—'}</td><td className="num t-medium">{hoursText(l.approved)}</td>
                  <td><Chip tone={l.kind === 'Overtime' ? 'warning' : l.kind === 'Weekend' ? 'info' : 'neutral'}>{l.kind}</Chip></td><td className="num">{money(l.rate)}</td><td className="num">{money(l.amount)}</td></tr>))}
                {d.issues.map(x => <tr key={x.visitId}><td><Link to={`/visits/${x.visitId}?from=${here}`}>{day(x.date)}</Link></td><td>{s.client(x.clientId)?.name}</td><td colSpan={6}><span className="row t-small" style={{ gap: 6, color: 'var(--status-danger)' }}><TriangleAlert size={13} />{x.text}</span></td></tr>)}
                {!d.lines.length && !d.issues.length && <tr><td colSpan={8} className="t-muted">No visits.</td></tr>}</tbody>
            </table></div>
          </div>
        </div>
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <CardHead title="Mileage" sub={`${money(s.rules.mileageRate)} a mile between visits`} action={editable && <button className="link-btn" onClick={() => setAct('mile')}>Add</button>} />
            <div className="card-body">{t.mileage.length === 0 ? <div className="t-small t-muted">None claimed.</div> : t.mileage.map(m => <div key={m.id} className="list-row"><Car size={15} color="var(--text-muted)" /><div className="grow"><div className="t-small t-medium">{m.miles} miles · {money(r2(m.miles * s.rules.mileageRate))}</div><div className="t-caption t-muted">{m.note} · {day(m.date)}</div></div></div>)}</div>
          </div>
          <div className="card">
            <CardHead title="Allowances" action={editable && <button className="link-btn" onClick={() => setAct('allow')}>Add</button>} />
            <div className="card-body">{t.allowances.length === 0 ? <div className="t-small t-muted">None.</div> : t.allowances.map(a => <div key={a.id} className="list-row"><Plus size={15} color="var(--text-muted)" /><div className="grow"><div className="t-small t-medium">{a.type} · {money(a.amount)}</div><div className="t-caption t-muted">{a.note}</div></div></div>)}</div>
          </div>
          <div className="card">
            <CardHead title="Pay rules used" />
            <div className="card-body t-small col" style={{ gap: 4 }}>
              <span>Base rate {money(base)} an hour</span><span>Weekend: +{money(s.rules.weekendExtra)} an hour</span>
              <span>Overtime: over {s.rules.overtimeAfter} hours in a week, × {s.rules.overtimeTimes}</span>
              <span className="t-caption t-muted">Agreed with the agency. Tax and deductions are worked out by the payroll provider.</span>
            </div>
          </div>
          <div className="card"><CardHead title="History" /><div className="card-body">{[...t.history].reverse().map((h, k) => <div key={k} className="note"><div className="t-small">{h.text}</div><div className="t-caption t-muted">{h.by} · {h.at}</div></div>)}</div></div>
        </div>
      </div>

      {act === 'approve' && <ConfirmDialog title={`Approve ${g.name}’s timesheet?`} text={`${hoursText(d.approved)} and ${money(d.gross)} before tax. It goes in the next payroll export. You can undo this until it’s exported.`} confirm="Approve timesheet" onClose={() => setAct(null)} onConfirm={() => { upd(x => ({ ...x, state: 'Approved', approvedBy: s.me.name, approvedAt: stampNow() }), 'Approved.'); s.log({ type: 'Timesheet', action: 'Approved timesheet', record: t.id }); s.toast('Timesheet approved. Ready to export.'); setAct(null) }} />}
      {act === 'return' && <ReasonDialog title="Send back to fix?" text={`${supervisor} is told what’s wrong. Visit times are only changed by the Care Supervisor — Finance never changes what the caregiver recorded.`} confirm="Send back" onClose={() => setAct(null)} placeholder="For example: Rosa says she also covered a Saturday visit" onConfirm={r => { upd(x => ({ ...x, state: 'Returned', returned: { reason: r, by: s.me.name, at: stampNow() } }), `Sent back to ${supervisor}: ${r}`); s.log({ type: 'Timesheet', action: 'Sent timesheet back to fix', record: t.id, reason: r }); s.toast(`Sent back. ${supervisor} has been told.`); setAct(null) }} />}
      {act === 'again' && <ReasonDialog title="Put back to check?" text="Say what was fixed. The timesheet is worked out again from the approved visits." label="What was fixed" confirm="Check again" onClose={() => setAct(null)} placeholder="For example: Michael added the missing Saturday visit" onConfirm={r => { upd(x => ({ ...x, state: 'To check', returned: undefined }), `Back to check: ${r}`); s.toast('Back in To check.'); setAct(null) }} />}
      {act === 'undo' && <ReasonDialog title="Undo approval?" text="It goes back to To check. Possible until it’s exported." confirm="Undo approval" onClose={() => setAct(null)} onConfirm={r => { upd(x => ({ ...x, state: 'To check', approvedBy: undefined, approvedAt: undefined }), `Approval undone: ${r}`); s.log({ type: 'Timesheet', action: 'Undid timesheet approval', record: t.id, reason: r }); s.toast('Approval undone.'); setAct(null) }} />}
      {act === 'mile' && <MileageModal p={p} onClose={() => setAct(null)} onSave={(m) => { upd(x => ({ ...x, mileage: [...x.mileage, m] }), `Added ${m.miles} miles: ${m.note}`); s.toast('Mileage added.'); setAct(null) }} />}
      {act === 'allow' && <AllowanceModal onClose={() => setAct(null)} onSave={(a) => { upd(x => ({ ...x, allowances: [...x.allowances, a] }), `Added ${a.type} ${money(a.amount)}: ${a.note}`); s.toast('Allowance added.'); setAct(null) }} />}
    </>
  )
}

function MileageModal({ p, onClose, onSave }: { p: Period; onClose: () => void; onSave: (m: { id: string; date: string; miles: number; note: string }) => void }) {
  const [date, setDate] = useState(p.to > TODAY ? TODAY : p.to); const [miles, setMiles] = useState(''); const [note, setNote] = useState(''); const [tried, setTried] = useState(false)
  const n = Number(miles); const errM = !(n > 0) || n > 1000 ? 'Enter the miles (1 to 1000).' : ''; const errD = date < p.from || date > p.to ? 'Choose a day in this pay period.' : ''
  return <Modal title="Add mileage" sub="Miles driven between visits, from the caregiver’s claim." onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => { setTried(true); if (!errM && !errD && note.trim()) onSave({ id: 'mi' + Date.now(), date, miles: n, note: note.trim() }) }}>Add mileage</Button></>}>
    <Field label="Day" required error={tried && errD ? errD : undefined}><Input type="date" min={p.from} max={p.to} value={date} onChange={e => setDate(e.target.value)} /></Field>
    <Field label="Miles" required error={tried && errM ? errM : undefined}><Input inputMode="decimal" value={miles} onChange={e => setMiles(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
    <Field label="Where from" required error={tried && !note.trim() ? 'Say what the claim is for.' : undefined}><Input value={note} onChange={e => setNote(e.target.value)} placeholder="For example: mileage claim form, week 2" /></Field>
  </Modal>
}
function AllowanceModal({ onClose, onSave }: { onClose: () => void; onSave: (a: { id: string; type: string; amount: number; note: string }) => void }) {
  const s = useStore()
  const [type, setType] = useState(s.rules.allowanceTypes[0]); const [amount, setAmount] = useState(''); const [note, setNote] = useState(''); const [tried, setTried] = useState(false)
  const n = Number(amount); const err = !(n > 0) ? 'Enter the amount.' : ''
  return <Modal title="Add an allowance" sub="Only the agreed types can be added." onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => { setTried(true); if (!err && note.trim()) onSave({ id: 'al' + Date.now(), type, amount: r2(n), note: note.trim() }) }}>Add allowance</Button></>}>
    <Field label="Type" required><Select value={type} onChange={e => setType(e.target.value)} options={s.rules.allowanceTypes} /></Field>
    <Field label="Amount" required error={tried && err ? err : undefined}><Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" /></Field>
    <Field label="What for" required error={tried && !note.trim() ? 'Say what it’s for.' : undefined}><Textarea value={note} onChange={e => setNote(e.target.value)} /></Field>
  </Modal>
}

/* ---------------- Payroll exports (PAY-07 to PAY-09) ---------------- */
const CSV_HEAD = ['Batch', 'Type', 'Employee', 'Name', 'Period start', 'Period end', 'Regular hours', 'Weekend hours', 'Overtime hours', 'Base rate', 'Miles', 'Mileage pay', 'Allowances', 'Pay before tax', 'Note']
export function useBatchRows() {
  const s = useStore()
  return (b: ExportBatch, pc = s.payCorrections) => {
    const p = s.period(b.periodId)
    const sheets = b.timesheetIds.map(id => s.timesheets.find(t => t.id === id)!).filter(Boolean).map(t => { const g = s.caregiver(t.caregiverId)!; const d = timesheetDetail({ ...t, state: 'Exported', batchId: b.id }, g, p, s.visits, pc.filter(c => !b.correctionIds.includes(c.id))); return { g, d, row: [b.id, 'Pay', g.id.toUpperCase(), g.name, p.from, p.to, d.regular, d.weekend, d.overtime, rateOn(g.pay, p.to), d.miles, d.mileagePay, d.allowancePay, d.gross, ''] } })
    const corr = b.correctionIds.map(id => pc.find(c => c.id === id)!).filter(Boolean).map(c => { const g = s.caregiver(c.caregiverId)!; const wd = new Date(c.date + 'T12:00').getDay(); const rate = rateOn(g.pay, c.date) + (wd === 0 || wd === 6 ? s.rules.weekendExtra : 0); return { g, c, amount: r2(c.hours * rate), row: [b.id, 'Correction', g.id.toUpperCase(), g.name, c.date, c.date, c.hours, 0, 0, rate, 0, 0, 0, r2(c.hours * rate), c.text] } })
    return { sheets, corr, hours: r2(sheets.reduce((a, x) => a + x.d.approved, 0) + corr.reduce((a, x) => a + x.c.hours, 0)), gross: r2(sheets.reduce((a, x) => a + x.d.gross, 0) + corr.reduce((a, x) => a + x.amount, 0)) }
  }
}

export function Exports() {
  const s = useStore()
  const nav = useNavigate()
  const rowsOf = useBatchRows()
  const [act, setAct] = useState<null | { period: string } | 'corr'>(null)
  const pending = s.periods.filter(p => s.timesheets.some(t => t.periodId === p.id && t.state !== 'Exported')).map(p => {
    const ts = s.timesheets.filter(t => t.periodId === p.id)
    return { p, ready: ts.filter(t => t.state === 'Approved'), notYet: ts.filter(t => t.state === 'To check' || t.state === 'Returned') }
  })
  // Corrections to pay that was already exported (PAY-09)
  const alreadyExported = (gid: string, date: string) => s.timesheets.some(t => t.caregiverId === gid && t.state === 'Exported' && s.period(t.periodId).from <= date && s.period(t.periodId).to >= date)
  const corrections = s.payCorrections.filter(c => !c.batchId && alreadyExported(c.caregiverId, c.date))
  const nextId = 'PB-' + String(Math.max(...s.batches.map(b => Number(b.id.slice(3)))) + 1).padStart(4, '0')
  const doExport = (periodId: string, kind: 'Payroll' | 'Corrections') => {
    const p = s.period(periodId)
    const tIds = kind === 'Payroll' ? s.timesheets.filter(t => t.periodId === periodId && t.state === 'Approved').map(t => t.id) : []
    const cIds = kind === 'Corrections' ? corrections.map(c => c.id) : []
    const b: ExportBatch = { id: nextId, kind, periodId, timesheetIds: tIds, correctionIds: cIds, by: s.me.name, at: stampNow(), file: kind === 'Payroll' ? `payroll-${p.from}-to-${p.to}.csv` : `payroll-corrections-${TODAY}.csv`, caregivers: new Set([...tIds.map(id => s.timesheets.find(t => t.id === id)!.caregiverId), ...cIds.map(id => s.payCorrections.find(c => c.id === id)!.caregiverId)]).size, hours: 0, gross: 0, downloads: [] }
    // Corrections already inside these timesheets are paid with them — mark them so they're never exported again
    const inSheets = (c: { caregiverId: string; date: string }) => tIds.some(id => { const t = s.timesheets.find(x => x.id === id)!; return t.caregiverId === c.caregiverId && c.date >= p.from && c.date <= p.to })
    const marked = s.payCorrections.map(c => cIds.includes(c.id) || (!c.batchId && inSheets(c)) ? { ...c, batchId: b.id } : c)
    const r = rowsOf(b, marked)
    b.hours = r.hours; b.gross = r.gross
    s.setBatches(x => [b, ...x])
    if (tIds.length) s.setTimesheets(x => x.map(t => tIds.includes(t.id) ? { ...t, state: 'Exported', batchId: b.id, history: [...t.history, { by: s.me.name, at: stampNow(), text: `Exported in ${b.id}.` }] } : t))
    s.setPayCorrections(marked)
    downloadCsv(b.file, [CSV_HEAD, ...r.sheets.map(x => x.row), ...r.corr.map(x => x.row)])
    s.log({ type: 'Payroll export', action: `Exported ${kind === 'Payroll' ? 'payroll' : 'corrections'} (${b.caregivers} caregivers)`, record: b.id, after: money(b.gross) })
    s.toast(`${b.id} exported and downloaded. ${b.caregivers} caregiver${b.caregivers === 1 ? '' : 's'}.`); setAct(null); nav(`/exports/${b.id}?from=/exports`)
  }
  const sel = act && typeof act === 'object' ? pending.find(x => x.p.id === act.period) : null
  return (
    <>
      <PageHead title="Payroll exports" crumb="Payroll exports" sub="Send approved timesheets to the payroll provider as one agreed file. Each export is recorded, a timesheet is never exported twice, and later corrections go in their own export." />
      <div className="grid g-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <CardHead title="Ready to export" />
          <div className="card-body">{pending.length === 0 ? <div className="t-small t-muted">Nothing waiting.</div> : pending.map(x => (
            <div key={x.p.id} className="list-row" style={{ alignItems: 'flex-start' }}>
              <FileSpreadsheet size={16} color="var(--text-muted)" style={{ marginTop: 2 }} />
              <div className="grow"><div className="t-small t-medium">Pay period {pl(x.p)}</div><div className="t-caption t-muted">{x.ready.length} approved · {x.notYet.length} still to check or being fixed</div>
                {x.notYet.length > 0 && <div className="t-caption" style={{ color: 'var(--status-warning)' }}>Not approved: {x.notYet.map(t => s.caregiver(t.caregiverId)?.name).join(', ')} — export them later</div>}</div>
              <Button size="sm" icon={Download} disabled={!x.ready.length} onClick={() => setAct({ period: x.p.id })}>Export</Button>
            </div>))}</div>
        </div>
        <div className="card">
          <CardHead title="Corrections to pay already exported" sub="From adjustments agreed after a pay period was sent to payroll." />
          <div className="card-body">{corrections.length === 0 ? <div className="t-small t-muted">None waiting.</div> : <>
            {corrections.map(c => <div key={c.id} className="list-row"><Info size={15} color="var(--status-warning)" /><div className="grow"><div className="t-small t-medium">{s.caregiver(c.caregiverId)?.name} · {c.hours > 0 ? '+' : ''}{hoursText(c.hours)}</div><div className="t-caption t-muted">{c.text} · visit {day(c.date)}</div></div></div>)}
            <Button style={{ marginTop: 12 }} icon={Download} onClick={() => setAct('corr')}>Export corrections</Button></>}</div>
        </div>
      </div>
      <div className="card">
        <CardHead title="Past exports" />
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Export</th><th>Type</th><th>Pay period</th><th className="num">Caregivers</th><th className="num">Hours</th><th className="num">Pay before tax</th><th>Exported by</th><th>File</th></tr></thead>
          <tbody>{s.batches.map(b => { const r = rowsOf(b); return (
            <tr key={b.id} className="clickable-row" onClick={() => nav(`/exports/${b.id}?from=/exports`)}><td className="t-medium">{b.id}</td><td><Chip tone={b.kind === 'Payroll' ? 'info' : 'warning'}>{b.kind}</Chip></td><td>{pl(s.period(b.periodId))}</td>
              <td className="num">{b.caregivers}</td><td className="num">{hoursText(r.hours)}</td><td className="num">{money(r.gross)}</td><td>{b.by}, {b.at}</td><td className="t-caption">{b.file}</td></tr>) })}</tbody>
        </table></div>
      </div>
      {sel && <ConfirmDialog title={`Export pay period ${pl(sel.p)}?`} text={`${sel.ready.length} approved timesheet${sel.ready.length > 1 ? 's' : ''} go in ${nextId}: ${sel.ready.map(t => s.caregiver(t.caregiverId)?.name).join(', ')}.${sel.notYet.length ? ` Not included (not approved yet): ${sel.notYet.map(t => s.caregiver(t.caregiverId)?.name).join(', ')}.` : ''} Exported timesheets can’t be changed.`} confirm="Export and download" onClose={() => setAct(null)} onConfirm={() => doExport(sel.p.id, 'Payroll')} />}
      {act === 'corr' && <ConfirmDialog title="Export corrections?" text={`${corrections.length} correction${corrections.length > 1 ? 's' : ''} go in ${nextId}, marked as corrections so payroll can tell them apart from the original export.`} confirm="Export and download" onClose={() => setAct(null)} onConfirm={() => doExport(s.periods.find(p => p.from <= corrections[0].date && p.to >= corrections[0].date)?.id ?? 'P1', 'Corrections')} />}
    </>
  )
}

export function ExportDetail() {
  const { id = '' } = useParams()
  const s = useStore()
  const nav = useNavigate()
  const back = useFrom('/exports', 'Payroll exports')
  const rowsOf = useBatchRows()
  const [again, setAgain] = useState(false)
  const b = s.batches.find(x => x.id === id)
  if (!b) return <div className="card"><EmptyState icon={Download} tone="neutral" title="We can’t find this export" text="The link may be old." action={<Button onClick={() => nav('/exports')}>Open Payroll exports</Button>} /></div>
  const r = rowsOf(b)
  const p = s.period(b.periodId)
  const download = () => {
    downloadCsv(b.file.replace('.csv', '-COPY.csv'), [CSV_HEAD, ...r.sheets.map(x => x.row), ...r.corr.map(x => x.row)])
    s.setBatches(x => x.map(y => y.id === b.id ? { ...y, downloads: [...y.downloads, { by: s.me.name, at: stampNow(), text: 'Downloaded again (copy).' }] } : y))
    s.log({ type: 'Payroll export', action: 'Downloaded a copy of an export', record: b.id })
    s.toast('Copy downloaded. It’s marked COPY so it isn’t paid twice.'); setAgain(false)
  }
  return (
    <>
      <DetailHead back={back} title={`Export ${b.id}`} crumb={b.id} chips={<Chip tone={b.kind === 'Payroll' ? 'info' : 'warning'}>{b.kind}</Chip>} sub={`Pay period ${pl(p)} · exported by ${b.by}, ${b.at}`}
        actions={<Button variant="secondary" icon={Copy} onClick={() => setAgain(true)}>Download a copy</Button>} />
      <div className="grid g-4">
        <div className="card card-pad"><div className="t-caption t-muted">Caregivers</div><div className="t-h2">{b.caregivers}</div></div>
        <div className="card card-pad"><div className="t-caption t-muted">Hours</div><div className="t-h2">{hoursText(r.hours)}</div></div>
        <div className="card card-pad"><div className="t-caption t-muted">Pay before tax</div><div className="t-h2">{money(r.gross)}</div></div>
        <div className="card card-pad"><div className="t-caption t-muted">File</div><div className="t-small t-medium" style={{ marginTop: 6, wordBreak: 'break-all' }}>{b.file}</div></div>
      </div>
      <div className="grid g-main-side" style={{ alignItems: 'start' }}>
        <div className="card">
          <CardHead title="What was in it" />
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Caregiver</th><th className="num">Regular</th><th className="num">Weekend</th><th className="num">Overtime</th><th className="num">Miles</th><th className="num">Allowances</th><th className="num">Pay before tax</th></tr></thead>
            <tbody>{r.sheets.map(x => <tr key={x.g.id} className="clickable-row" onClick={() => nav(`/timesheets/TS-${b.periodId}-${x.g.id}?from=/exports/${b.id}`)}><td className="t-medium">{x.g.name}</td><td className="num">{hoursText(x.d.regular)}</td><td className="num">{hoursText(x.d.weekend)}</td><td className="num">{hoursText(x.d.overtime)}</td><td className="num">{x.d.miles}</td><td className="num">{money(x.d.allowancePay)}</td><td className="num">{money(x.d.gross)}</td></tr>)}
              {r.corr.map(x => <tr key={x.c.id}><td className="t-medium">{x.g.name}<div className="t-caption" style={{ color: 'var(--status-warning)' }}>Correction: {x.c.text}</div></td><td className="num">{hoursText(x.c.hours)}</td><td className="num">—</td><td className="num">—</td><td className="num">—</td><td className="num">—</td><td className="num">{money(x.amount)}</td></tr>)}</tbody>
          </table></div>
        </div>
        <div className="card">
          <CardHead title="Record of this export" />
          <div className="card-body">
            <dl className="kv" style={{ gridTemplateColumns: '110px 1fr' }}><dt>Exported by</dt><dd>{b.by}</dd><dt>When</dt><dd>{b.at}</dd><dt>Type</dt><dd>{b.kind === 'Payroll' ? 'Pay period' : 'Corrections to earlier exports'}</dd></dl>
            <div className="t-small t-medium" style={{ marginTop: 14 }}>Copies downloaded</div>
            {b.downloads.length === 0 ? <div className="t-small t-muted">None.</div> : b.downloads.map((x, k) => <div key={k} className="note"><div className="t-small">{x.text}</div><div className="t-caption t-muted">{x.by} · {x.at}</div></div>)}
          </div>
        </div>
      </div>
      {again && <ConfirmDialog title="Download a copy?" text="The file is marked COPY so payroll doesn’t pay it twice. The download is recorded." confirm="Download copy" onClose={() => setAgain(false)} onConfirm={download} />}
    </>
  )
}
