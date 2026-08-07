import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import SecurityGuard from './components/SecurityGuard';
import TwoFactorSettings from './pages/TwoFactorSettings';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import SignDocument from './pages/SignDocument';
import Dashboard from './pages/Dashboard';
import MyProfile from './pages/MyProfile';
import { EmployeeList, EmployeeDetail } from './pages/Employees';
import Invoices from './pages/Invoices';
import Accounting from './pages/Accounting';
import Payroll from './pages/Payroll';
import Attendance from './pages/Attendance';
import Monitoring from './pages/Monitoring';
import MyActivity from './pages/MyActivity';
import Recruitment from './pages/Recruitment';
import Performance from './pages/Performance';
import OrgStructure from './pages/OrgStructure';
import Team from './pages/Team';
import Import from './pages/Import';
import Documents from './pages/Documents';
import DocumentEngine from './pages/DocumentEngine';
import TemplateManager from './pages/TemplateManager';
import Sales from './pages/Sales';
import Automation from './pages/Automation';
import AIAssistant from './pages/AIAssistant';
import Analytics from './pages/Analytics';
import Expenses from './pages/Expenses';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import Compliance from './pages/Compliance';
import ComplianceCalendar from './pages/ComplianceCalendar';
import OneTimeCompliance from './pages/OneTimeCompliance';
import Certifications from './pages/Certifications';
import IPAssets from './pages/IPAssets';
import DataGovernance from './pages/DataGovernance';
import Finance from './pages/Finance';
import BankAccounts from './pages/BankAccounts';
import ESignatures from './pages/ESignatures';
import { CompanyList, CompanyDetail } from './pages/CRM';
import MarketingSocials from './pages/MarketingSocials';
import MarketingCampaigns from './pages/MarketingCampaigns';
import MarketingContentCalendar from './pages/MarketingContentCalendar';
import MarketingBrandAssets from './pages/MarketingBrandAssets';
import MarketingDashboard from './pages/MarketingDashboard';
import MarketingLeads from './pages/MarketingLeads';
import MarketingCompetitors from './pages/MarketingCompetitors';
import MarketingEvents from './pages/MarketingEvents';
import MarketingPress from './pages/MarketingPress';
import MarketingNewsletter from './pages/MarketingNewsletter';
import MarketingSeo from './pages/MarketingSeo';
import MarketingBlog from './pages/MarketingBlog';
import PartnershipFirms from './pages/PartnershipFirms';
import PartnershipFollowUps from './pages/PartnershipFollowUps';
import ProductRoadmap from './pages/ProductRoadmap';
import ProductReleases from './pages/ProductReleases';
import ProductFeedback from './pages/ProductFeedback';
import ProductBetaUsers from './pages/ProductBetaUsers';
import ProductSubscriptions from './pages/ProductSubscriptions';
import ProductPricing from './pages/ProductPricing';
import ProductCoupons from './pages/ProductCoupons';
import CorporateDeals from './pages/CorporateDeals';
import MarketingCouponPerformance from './pages/MarketingCouponPerformance';
import SupportTicketsView from './pages/SupportTicketsView';

// Widened to include legal_hod/compliance_hod/marketing_hod/sales_hod/
// product_hod — matches Layout.jsx's PRIVILEGED_ROLES, so those roles get
// Dashboard as their home screen too instead of the self-service MyProfile view.
const PRIVILEGED_ROLES = ['owner', 'admin', 'hr', 'finance', 'legal_hod', 'compliance_hod', 'marketing_hod', 'sales_hod', 'product_hod', 'accounting_hod'];

function ProtectedRoutes() {
  const { staff, loading } = useAuth();
  if (loading) return null;
  if (!staff) return <Navigate to="/login" replace />;
  // SecurityGuard reads `staff` itself via useAuth(), so it only ever
  // renders here — after the auth check above — meaning the watermark,
  // copy/print/right-click blocking never touches the public /login or
  // /sign/:token pages, only the authenticated app inside Layout/Outlet.
  return (
    <SecurityGuard>
      <Layout />
    </SecurityGuard>
  );
}

// The root path shows different content depending on role — company-wide
// financials for privileged roles, a personal profile for everyone else.
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
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/sign/:token" element={<SignDocument />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/" element={<Home />} />
              <Route path="/my-profile" element={<MyProfile />} />
              <Route path="/security" element={<TwoFactorSettings />} />
              <Route path="/employees" element={<EmployeeList />} />
              <Route path="/employees/:id" element={<EmployeeDetail />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/accounting" element={<Accounting />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/monitoring" element={<Monitoring />} />
              <Route path="/my-activity" element={<MyActivity />} />
              <Route path="/recruitment" element={<Recruitment />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/org-structure" element={<OrgStructure />} />
              <Route path="/team" element={<Team />} />
              <Route path="/import" element={<Import />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/document-engine" element={<DocumentEngine />} />
              <Route path="/templates" element={<TemplateManager />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/crm" element={<CompanyList />} />
              <Route path="/crm/:id" element={<CompanyDetail />} />
              <Route path="/automation" element={<Automation />} />
              <Route path="/ai-assistant" element={<AIAssistant />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/compliance" element={<Compliance />} />
              <Route path="/compliance-calendar" element={<ComplianceCalendar />} />
              <Route path="/one-time-compliance" element={<OneTimeCompliance />} />
              <Route path="/certifications" element={<Certifications />} />
              <Route path="/ip-assets" element={<IPAssets />} />
              <Route path="/data-governance" element={<DataGovernance />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/bank-accounts" element={<BankAccounts />} />
              <Route path="/esignatures" element={<ESignatures />} />
              <Route path="/marketing/socials" element={<MarketingSocials />} />
              <Route path="/marketing/campaigns" element={<MarketingCampaigns />} />
              <Route path="/marketing/content-calendar" element={<MarketingContentCalendar />} />
              <Route path="/marketing/brand-assets" element={<MarketingBrandAssets />} />
              <Route path="/marketing/dashboard" element={<MarketingDashboard />} />
              <Route path="/marketing/leads" element={<MarketingLeads />} />
              <Route path="/marketing/competitors" element={<MarketingCompetitors />} />
              <Route path="/marketing/events" element={<MarketingEvents />} />
              <Route path="/marketing/press" element={<MarketingPress />} />
              <Route path="/marketing/newsletter" element={<MarketingNewsletter />} />
              <Route path="/marketing/seo" element={<MarketingSeo />} />
              <Route path="/marketing/blog" element={<MarketingBlog />} />
              <Route path="/marketing/coupon-performance" element={<MarketingCouponPerformance />} />
              <Route path="/partnerships/firms" element={<PartnershipFirms />} />
              <Route path="/partnerships/follow-ups" element={<PartnershipFollowUps />} />
              <Route path="/product/roadmap" element={<ProductRoadmap />} />
              <Route path="/product/releases" element={<ProductReleases />} />
              <Route path="/product/feedback" element={<ProductFeedback />} />
              <Route path="/product/beta-users" element={<ProductBetaUsers />} />
              <Route path="/product/subscriptions" element={<ProductSubscriptions />} />
              <Route path="/product/pricing" element={<ProductPricing />} />
              <Route path="/product/coupons" element={<ProductCoupons />} />
              <Route path="/product/corporate-deals" element={<CorporateDeals />} />
              <Route path="/support-tickets" element={<SupportTicketsView />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}