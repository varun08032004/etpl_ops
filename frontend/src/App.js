import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { EmployeeList, EmployeeDetail } from './pages/Employees';
import Invoices from './pages/Invoices';
import Accounting from './pages/Accounting';
import Payroll from './pages/Payroll';
import Team from './pages/Team';
import Import from './pages/Import';
import Documents from './pages/Documents';

function ProtectedRoutes() {
  const { staff, loading } = useAuth();
  if (loading) return null;
  if (!staff) return <Navigate to="/login" replace />;
  return (
    <Layout />
  );
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
              <Route path="/" element={<Dashboard />} />
              <Route path="/employees" element={<EmployeeList />} />
              <Route path="/employees/:id" element={<EmployeeDetail />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/accounting" element={<Accounting />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/team" element={<Team />} />
              <Route path="/import" element={<Import />} />
              <Route path="/documents" element={<Documents />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}