import type { ReactElement } from 'react'
import { HashRouter, Navigate, Route, Routes, Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { StoreProvider, useStore } from './data/store'
import Shell from './components/Shell'
import { EmptyState } from './components/ui'
import { Login, Forgot } from './pages/Auth'
import Dashboard from './pages/Dashboard'
import ToBill, { PrepareInvoice } from './pages/ToBill'
import Invoices, { InvoiceDetail } from './pages/Invoices'
import Payments, { PaymentDetail, Owed } from './pages/Money'
import Timesheets, { TimesheetDetail, Exports, ExportDetail } from './pages/Payroll'
import Adjustments from './pages/Adjustments'
import BillingList, { ClientBilling, PayRates, CaregiverPay } from './pages/Billing'
import VisitDetail from './pages/VisitDetail'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

function Guard({ children }: { children: ReactElement }) {
  const s = useStore()
  if (!s.signedIn) return <Navigate to="/login" replace />
  return children
}

function NotFound() {
  return <div className="card"><EmptyState icon={Compass} tone="info" title="We can’t find that page" text="The link may be old, or you may not have access to it." action={<Link className="btn btn-primary" to="/">Go to My work</Link>} /></div>
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot" element={<Forgot />} />
          <Route element={<Guard><Shell /></Guard>}>
            <Route index element={<Dashboard />} />
            <Route path="to-bill" element={<ToBill />} />
            <Route path="to-bill/:clientId" element={<PrepareInvoice />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="invoices/:id" element={<InvoiceDetail />} />
            <Route path="payments" element={<Payments />} />
            <Route path="payments/:id" element={<PaymentDetail />} />
            <Route path="owed" element={<Owed />} />
            <Route path="timesheets" element={<Timesheets />} />
            <Route path="timesheets/:id" element={<TimesheetDetail />} />
            <Route path="exports" element={<Exports />} />
            <Route path="exports/:id" element={<ExportDetail />} />
            <Route path="adjustments" element={<Adjustments />} />
            <Route path="billing" element={<BillingList />} />
            <Route path="clients/:id" element={<ClientBilling />} />
            <Route path="pay-rates" element={<PayRates />} />
            <Route path="pay-rates/:id" element={<CaregiverPay />} />
            <Route path="visits/:id" element={<VisitDetail />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  )
}
