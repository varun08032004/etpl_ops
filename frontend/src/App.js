import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MyProfile from './pages/MyProfile';
import { EmployeeList, EmployeeDetail } from './pages/Employees';
import Invoices from './pages/Invoices';
import Accounting from './pages/Accounting';
import Payroll from './pages/Payroll';
import Attendance from './pages/Attendance';
import OrgStructure from './pages/OrgStructure';
import Team from './pages/Team';
import Import from './pages/Import';
import Documents from './pages/Documents';
import DocumentEngine from './pages/DocumentEngine';
import Sales from './pages/Sales';
import Automation from './pages/Automation';
import AIAssistant from './pages/AIAssistant';
import Analytics from './pages/Analytics';
import Expenses from './pages/Expenses';
import Admin from './pages/Admin';
import Compliance from './pages/Compliance';
import Finance from './pages/Finance';

const PRIVILEGED_ROLES = ['owner', 'admin', 'hr', 'finance'];

function ProtectedRoutes() {
  const { staff, loading } = useAuth();
  if (loading) return null;
  if (!staff) return <Navigate to="/login" replace />;
  return (
    <Layout />
  );
}

// The root path shows different content depending on role — company-wide
// financials for owner/admin/hr/finance, a personal profile for everyone else.
function Home() {
  const { staff } = useAuth();
  return PRIVILEGED_ROLES.includes(staff?.role) ? <Dashboard /> : <MyProfile />;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/" element={<Home />} />
              <Route path="/employees" element={<EmployeeList />} />
              <Route path="/employees/:id" element={<EmployeeDetail />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/accounting" element={<Accounting />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/org-structure" element={<OrgStructure />} />
              <Route path="/team" element={<Team />} />
              <Route path="/import" element={<Import />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/document-engine" element={<DocumentEngine />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/automation" element={<Automation />} />
              <Route path="/ai-assistant" element={<AIAssistant />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/compliance" element={<Compliance />} />
              <Route path="/finance" element={<Finance />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}