import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
  Link, Accordion, AccordionSummary, AccordionDetails, Divider,
  Tooltip, IconButton
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import ExternalLinkIcon from '@mui/icons-material/OpenInNew';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import Money from '../components/Money';
import { useAuth } from '../context/AuthContext';
import {
  MobilePaper,
  MobilePageHeader,
  MobileFormGrid,
  MobileActionButtons,
  MobileDialog,
  ResponsiveTableContainer,
  MobileCardGrid,
  useMobile,
} from '../components/MobileResponsive';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CLAIM_CATEGORIES = ['travel', 'meals', 'software', 'office_supplies', 'client_entertainment', 'training', 'other'];

// Default company settings
const COMPANY_DEFAULTS = {
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri
  workStart: '09:30',
  workEnd: '19:00',
  dailyHours: 9.5,
  monthlyPaidLeaves: 2,
};

export default function MyProfile() {
  const { staff } = useAuth();
  const canSeeReimbursements = ['owner', 'admin', 'finance'].includes(staff?.role);
  const isMobile = useMobile();

  const [employee, setEmployee] = useState(null);
  const [tab, setTab] = useState(0);
  const [payslips, setPayslips] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [docs, setDocs] = useState([]);
  const [assets, setAssets] = useState([]);
  const [pendingLeave, setPendingLeave] = useState([]);
  const [myExpenseClaims, setMyExpenseClaims] = useState([]);
  const [pendingApprovalClaims, setPendingApprovalClaims] = useState([]);
  const [pendingReimbursementClaims, setPendingReimbursementClaims] = useState([]);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimForm, setClaimForm] = useState({ category: 'travel', description: '', amount: '', expense_date: '' });
  const [claimSaving, setClaimSaving] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [reimburseBankSelections, setReimburseBankSelections] = useState({});
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notLinked, setNotLinked] = useState(false);
  const [taxInfo, setTaxInfo] = useState(null);
  const [leaveBalances, setLeaveBalances] = useState({ annual: 0, sick: 0 });

  const loadMyClaims = () => client.get('/finance/expense-claims/mine').then(({ data }) => setMyExpenseClaims(data.claims)).catch(() => setMyExpenseClaims([]));
  const loadPendingApproval = () => client.get('/finance/expense-claims/pending-my-approval').then(({ data }) => setPendingApprovalClaims(data.claims)).catch(() => setPendingApprovalClaims([]));
  const loadPendingReimbursement = () => canSeeReimbursements
    ? client.get('/finance/expense-claims', { params: { status: 'approved' } }).then(({ data }) => setPendingReimbursementClaims(data.claims)).catch(() => setPendingReimbursementClaims([]))
    : Promise.resolve();

  const loadAll = useCallback(async () => {
    try {
      const { data } = await client.get('/employees/me');
      setEmployee(data.employee);
      const [payslipRes, leaveRes, leaveTypesRes, docsRes, assetsRes, agentStatusRes] = await Promise.all([
        client.get('/payroll/me/payslips'),
        client.get('/employees/me/leave'),
        client.get('/employees/leave-types'),
        client.get('/documents', { params: { entity_type: 'employee' } }),
        client.get('/assets'),
        client.get('/asset-agent/employee/me/asset-agent-status'),
      ]);
      setPayslips(payslipRes.data.payslips);
      setLeaveRequests(leaveRes.data.leaveRequests);
      setLeaveTypes(leaveTypesRes.data.leaveTypes);
      setDocs(docsRes.data.documents);
      setAssets(assetsRes.data.assets);
      setAssets(agentStatusRes.data.assets);
      client.get('/employees/leave/pending').then(({ data }) => setPendingLeave(data.leaveRequests)).catch(() => setPendingLeave([]));
      loadMyClaims();
      loadPendingApproval();
      loadPendingReimbursement();
      client.get('/bank-accounts').then(({ data }) => setBankAccounts(data.accounts || [])).catch(() => setBankAccounts([]));

      // Load leave balances with 8-month probation check
      const joiningDate = new Date(data.employee.date_of_joining);
      const now = new Date();
      const monthsWorked = (now.getFullYear() - joiningDate.getFullYear()) * 12 + (now.getMonth() - joiningDate.getMonth());
      const isProbationComplete = monthsWorked >= 8;
      
      setLeaveBalances({
        annual: isProbationComplete ? (data.employee.leave_balance_annual || 0) : 0,
        sick: 0, // Unified paid leave only
      });

      // Load tax info from latest payslip
      if (payslipRes.data.payslips.length > 0) {
        const latest = payslipRes.data.payslips[0];
        const { data: detail } = await client.get(`/payroll/runs/${latest.payroll_run_id}/items/${latest.id}`);
        setTaxInfo({
          pf_deduction: detail.pf_deduction,
          esic_deduction: detail.esic_employee_deduction,
          professional_tax: detail.professional_tax,
          tds_deduction: detail.tds_deduction,
          epf_employer: detail.epf_employer_contribution,
          esic_employer: detail.esic_employer_contribution,
        });
      }
    } catch (err) {
      if (err.response?.status === 404) setNotLinked(true);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const decideLeave = async (leaveId, decision) => {
    await client.post(`/employees/leave/${leaveId}/decision`, { decision });
    client.get('/employees/leave/pending').then(({ data }) => setPendingLeave(data.leaveRequests)).catch(() => {});
  };

  const decideExpenseClaim = async (claimId, decision) => {
    await client.post(`/finance/expense-claims/${claimId}/decide`, { decision });
    loadPendingApproval();
    loadPendingReimbursement();
  };

  const reimburseClaim = async (claimId, bankAccountId) => {
    if (!bankAccountId) { alert('Pick a bank account first'); return; }
    await client.post(`/finance/expense-claims/${claimId}/reimburse`, { bank_account_id: bankAccountId });
    loadPendingReimbursement();
    loadMyClaims();
  };

  const submitExpenseClaim = async () => {
    setClaimSaving(true);
    try {
      await client.post('/finance/expense-claims', claimForm);
      setClaimOpen(false);
      setClaimForm({ category: 'travel', description: '', amount: '', expense_date: '' });
      loadMyClaims();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit claim');
    } finally {
      setClaimSaving(false);
    }
  };

  const handleLeaveSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post(`/employees/${employee.id}/leave`, leaveForm);
      setLeaveOpen(false);
      setLeaveForm({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request leave');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const { data } = await client.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.original_filename || doc.title);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Download failed');
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Delete this document? This action cannot be undone.')) return;
    try {
      await client.delete(`/documents/${docId}`);
      setDocs(docs.filter(d => d.id !== docId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete document');
    }
  };

  const handleDownloadPayslip = async (payslip) => {
    try {
      const { data } = await client.get(`/payroll/me/payslips/${payslip.id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payslip-${MONTHS[payslip.month - 1]}-${payslip.year}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Download failed');
    }
  };

  if (notLinked) return <Alert severity="info">Your login isn't linked to an employee record yet. Contact HR.</Alert>;
  if (!employee) return null;

  const tabs = [
    { key: 0, label: 'Profile', icon: '👤' },
    { key: 1, label: 'Payslips', icon: '💰' },
    { key: 2, label: 'Tax Details', icon: '📊' },
    { key: 3, label: 'Leave', icon: '📅' },
    { key: 4, label: 'Compliance', icon: '📋' },
    { key: 5, label: 'Pending', icon: '⏳' },
    { key: 6, label: 'Documents', icon: '📄' },
    { key: 7, label: 'Assets', icon: '💻' },
    { key: 8, label: 'Agent Setup', icon: '🔧' },
    { key: 9, label: 'Claims', icon: '🧾' },
  ];

  return (
    <Box sx={{ p: 2 }}>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>{employee.full_name} — My Profile</Typography>
      </MobilePageHeader>

      {/* Quick Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <MobilePaper sx={{ p: 3, background: 'primary.50', border: '1px solid', borderColor: 'primary.main' }}>
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>Email</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>{employee.work_email || employee.personal_email}</Typography>
          </MobilePaper>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MobilePaper sx={{ p: 3, background: 'success.50', border: '1px solid', borderColor: 'success.main' }}>
            <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>Phone</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>{employee.phone || '—'}</Typography>
          </MobilePaper>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MobilePaper sx={{ p: 3, background: 'warning.50', border: '1px solid', borderColor: 'warning.main' }}>
            <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>Department</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>{employee.department_name || '—'}</Typography>
          </MobilePaper>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MobilePaper sx={{ p: 3, background: 'info.50', border: '1px solid', borderColor: 'info.main' }}>
            <Typography variant="caption" color="info.main" sx={{ fontWeight: 600 }}>Joined</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>{employee.date_of_joining?.slice(0, 10) || '—'}</Typography>
          </MobilePaper>
        </Grid>
      </Grid>

      <MobilePaper sx={{ mb: 3, p: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ '& .MuiTab-root': { minHeight: isMobile ? 40 : 48, fontSize: isMobile ? '0.75rem' : '0.875rem', px: isMobile ? 1 : 1.5 } }}>
          {tabs.map((t) => <Tab key={t.key} label={t.label} />)}
        </Tabs>
      </MobilePaper>

      {tab === 0 && (
        <MobilePaper sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Full name</Typography>
              <Typography>{employee.full_name}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Personal email</Typography>
              <Typography>{employee.personal_email}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Date of birth</Typography>
              <Typography>{employee.date_of_birth?.slice(0, 10) || '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>PAN</Typography>
              <Typography>{employee.pan_number || '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>City</Typography>
              <Typography>{employee.city || '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>State</Typography>
              <Typography>{employee.state || '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Employment type</Typography>
              <Typography>{employee.employment_type?.replace('_', ' ')}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Manager</Typography>
              <Typography>{employee.manager_name || '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>CTC (annual)</Typography>
              <Money amount={employee.ctc_annual} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Basic (monthly)</Typography>
              <Money amount={employee.basic_monthly} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>HRA (monthly)</Typography>
              <Money amount={employee.hra_monthly} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Other allowances</Typography>
              <Money amount={employee.other_allowances_monthly} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>DA (monthly)</Typography>
              <Money amount={employee.da_monthly} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Tax regime</Typography>
              <Typography>{employee.tax_regime === 'new' ? 'New' : 'Old'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>PF applicable</Typography>
              <Typography>{employee.pf_applicable ? 'Yes' : 'No'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Bank account</Typography>
              <Typography>{employee.bank_account_number || '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>IFSC</Typography>
              <Typography>{employee.bank_ifsc || '—'}</Typography>
            </Grid>
          </Grid>
        </MobilePaper>
      )}

      {/* PAYSLIPS TAB */}
      {tab === 1 && (
        <Box>
          {/* Summary Cards - Leave Policy + Current Month */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} lg={3}>
              <MobilePaper sx={{ p: 3, background: 'primary.50', border: '1px solid', borderColor: 'primary.main' }}>
                <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>Monthly Paid Leave</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>2 days/month</Typography>
                <Typography variant="caption" color="text.secondary">Credited on 1st</Typography>
              </MobilePaper>
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <MobilePaper sx={{ p: 3, background: 'success.50', border: '1px solid', borderColor: 'success.main' }}>
                <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>Annual Entitlement</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>24 days/year</Typography>
                <Typography variant="caption" color="text.secondary">2 × 12 months</Typography>
              </MobilePaper>
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <MobilePaper sx={{ p: 3, background: 'warning.50', border: '1px solid', borderColor: 'warning.main' }}>
                <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>Current Balance</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>{leaveBalances.annual} days</Typography>
                <Typography variant="caption" color="text.secondary">Max cap: 3 days</Typography>
              </MobilePaper>
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <MobilePaper sx={{ p: 3, background: 'info.50', border: '1px solid', borderColor: 'info.main' }}>
                <Typography variant="caption" color="info.main" sx={{ fontWeight: 600 }}>Probation</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>8 months</Typography>
                <Typography variant="caption" color="text.secondary">Paid leave after probation</Typography>
              </MobilePaper>
            </Grid>
          </Grid>

          {/* Current Month Payslip Summary */}
          {payslips.length > 0 && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} lg={3}>
                <MobilePaper sx={{ p: 3, background: 'primary.50', border: '1px solid', borderColor: 'primary.main' }}>
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>Current Month Gross</Typography>
                  <Money amount={payslips[0].gross_pay} size="1.5rem" />
                </MobilePaper>
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <MobilePaper sx={{ p: 3, background: 'success.50', border: '1px solid', borderColor: 'success.main' }}>
                  <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>Current Month Net</Typography>
                  <Money amount={payslips[0].net_pay} size="1.5rem" />
                </MobilePaper>
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <MobilePaper sx={{ p: 3, background: 'warning.50', border: '1px solid', borderColor: 'warning.main' }}>
                  <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>LOP Days</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{payslips[0].loss_of_pay_days} days</Typography>
                </MobilePaper>
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <MobilePaper sx={{ p: 3, background: 'info.50', border: '1px solid', borderColor: 'info.main' }}>
                  <Typography variant="caption" color="info.main" sx={{ fontWeight: 600 }}>Leave Balance</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{leaveBalances.annual} days</Typography>
                  <Typography variant="caption" color="text.secondary">Available for use</Typography>
                </MobilePaper>
              </Grid>
            </Grid>
          )}

          {/* Payslips Table */}
          <MobilePaper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>Payslip History</Typography>
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Period</TableCell>
                    <TableCell align="right">Gross</TableCell>
                    <TableCell align="right">Net</TableCell>
                    <TableCell align="right">LOP Days</TableCell>
                    <TableCell align="right">Leave Bal</TableCell>
                    <TableCell align="right">Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payslips.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{MONTHS[p.month - 1]} {p.year}</TableCell>
                      <TableCell align="right"><Money amount={p.gross_pay} size={isMobile ? '0.75rem' : '0.875rem'} /></TableCell>
                      <TableCell align="right"><Money amount={p.net_pay} size={isMobile ? '0.75rem' : '0.875rem'} /></TableCell>
                      <TableCell align="right" className="figure">{p.loss_of_pay_days}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600, color: leaveBalances.annual > 0 ? 'success.main' : 'text.secondary' }}>
                          {leaveBalances.annual} days
                        </Typography>
                      </TableCell>
                      <TableCell align="right"><StatusChip status={p.run_status} /></TableCell>
                      <TableCell align="right">
                        <Button size="small" startIcon={<DownloadIcon fontSize="small" />} onClick={() => handleDownloadPayslip(p)}>
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!payslips.length && <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No payslips yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </MobilePaper>
        </Box>
      )}

      {/* TAX DETAILS TAB */}
      {tab === 2 && (
        <MobilePaper sx={{ p: 3 }}>
          {taxInfo ? (
            <>
              <Typography variant="h6" sx={{ mb: 3 }}>Employee Deductions (Latest Month)</Typography>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} lg={3}>
                  <MobilePaper sx={{ p: 3 }}>
                    <Typography variant="caption" color="text.secondary">PF (Employee)</Typography>
                    <Money amount={taxInfo.pf_deduction} size="1.25rem" />
                  </MobilePaper>
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                  <MobilePaper sx={{ p: 3 }}>
                    <Typography variant="caption" color="text.secondary">ESIC (Employee)</Typography>
                    <Money amount={taxInfo.esic_deduction} size="1.25rem" />
                  </MobilePaper>
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                  <MobilePaper sx={{ p: 3 }}>
                    <Typography variant="caption" color="text.secondary">Professional Tax</Typography>
                    <Money amount={taxInfo.professional_tax} size="1.25rem" />
                  </MobilePaper>
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                  <MobilePaper sx={{ p: 3 }}>
                    <Typography variant="caption" color="text.secondary">TDS (Sec 192)</Typography>
                    <Money amount={taxInfo.tds_deduction} size="1.25rem" />
                  </MobilePaper>
                </Grid>
              </Grid>

              <Divider sx={{ mb: 3 }} />
              <Typography variant="h6" sx={{ mb: 3 }}>Employer Contributions</Typography>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} lg={3}>
                  <MobilePaper sx={{ p: 3 }}>
                    <Typography variant="caption" color="text.secondary">PF (Employer)</Typography>
                    <Money amount={taxInfo.epf_employer} size="1.25rem" />
                  </MobilePaper>
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                  <MobilePaper sx={{ p: 3 }}>
                    <Typography variant="caption" color="text.secondary">ESIC (Employer)</Typography>
                    <Money amount={taxInfo.esic_employer} size="1.25rem" />
                  </MobilePaper>
                </Grid>
              </Grid>

              <Divider sx={{ mb: 3 }} />
              <Typography variant="h6" sx={{ mb: 3 }}>Tax Regime & Declarations</Typography>
              <MobilePaper sx={{ p: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Tax Regime</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{employee.tax_regime === 'new' ? 'New Regime (Default)' : 'Old Regime'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">PAN</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{employee.pan_number || 'Not provided'}</Typography>
                  </Grid>
                </Grid>
              </MobilePaper>
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary">No Tax Data Available</Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                Tax details will appear after your first payroll run.
              </Typography>
            </Box>
          )}
        </MobilePaper>
      )}

{/* LEAVE TAB */}
      {tab === 3 && (
        <Box>
          <MobilePaper sx={{ mb: 3, p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Leave Policy</Typography>
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <MobilePaper sx={{ p: 3, border: '1px solid', borderColor: 'primary.main', background: 'primary.50' }}>
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>Monthly Paid Leave</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>2 days</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>Credited on 1st of each month</Typography>
                </MobilePaper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <MobilePaper sx={{ p: 3, border: '1px solid', borderColor: 'success.main', background: 'success.50' }}>
                  <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>Annual Entitlement</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>24 days</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>2 × 12 months</Typography>
                </MobilePaper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <MobilePaper sx={{ p: 3, border: '1px solid', borderColor: 'warning.main', background: 'warning.50' }}>
                  <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>Current Balance</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>{leaveBalances.annual} days</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>Max cap: 3 days (rollover)</Typography>
                </MobilePaper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <MobilePaper sx={{ p: 3, border: '1px dashed', borderColor: 'grey.500', background: 'grey.50' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Probation Period</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>8 months</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>Paid leaves start after probation</Typography>
                </MobilePaper>
              </Grid>
            </Grid>
            <Alert severity="info" sx={{ mb: 3 }}>
              <strong>Policy:</strong> 2 paid leaves/month (unified). Max balance capped at 3 days. 
              <strong>Eligibility:</strong> Paid leaves available only after completing 8 months from date of joining.
              <strong>Emergency/Sick leave:</strong> Accepted on spot (separate type, requires approval).
            </Alert>
          </MobilePaper>

          <MobilePaper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">Leave History</Typography>
              <Button variant="contained" size="small" onClick={() => setLeaveOpen(true)}>Request leave</Button>
            </Box>
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>From</TableCell>
                    <TableCell>To</TableCell>
                    <TableCell>Days</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leaveRequests.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.leave_type_name}</TableCell>
                      <TableCell className="figure">{l.start_date?.slice(0, 10)}</TableCell>
                      <TableCell className="figure">{l.end_date?.slice(0, 10)}</TableCell>
                      <TableCell className="figure">{l.days}</TableCell>
                      <TableCell><StatusChip status={l.status} /></TableCell>
                      <TableCell>{l.reason || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {!leaveRequests.length && <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No leave requests yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </MobilePaper>
        </Box>
      )}

      {/* COMPLIANCE TAB */}
      {tab === 4 && (
        <MobilePaper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>Compliance & Contributions</Typography>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Provident Fund (EPF)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <MobilePaper sx={{ p: 3 }}>
                    <Typography variant="body2" color="text.secondary">Employee Contribution (12% of Basic+DA)</Typography>
                    <Money amount={taxInfo?.pf_deduction} size="1.25rem" />
                  </MobilePaper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <MobilePaper sx={{ p: 3 }}>
                    <Typography variant="body2" color="text.secondary">Employer Contribution (12% of Basic+DA)</Typography>
                    <Money amount={taxInfo?.epf_employer} size="1.25rem" />
                  </MobilePaper>
                </Grid>
              </Grid>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
                PF is deducted from Basic + DA. Employer also contributes 12%. The total goes to your EPF account.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Employee State Insurance (ESIC)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <MobilePaper sx={{ p: 3 }}>
                    <Typography variant="body2" color="text.secondary">Employee Contribution (0.75% of Gross)</Typography>
                    <Money amount={taxInfo?.esic_deduction} size="1.25rem" />
                  </MobilePaper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <MobilePaper sx={{ p: 3 }}>
                    <Typography variant="body2" color="text.secondary">Employer Contribution (3.25% of Gross)</Typography>
                    <Money amount={taxInfo?.esic_employer} size="1.25rem" />
                  </MobilePaper>
                </Grid>
              </Grid>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
                ESIC applies when gross monthly salary ≤ ₹21,000. Provides medical, sickness, maternity & disability benefits.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Professional Tax (PT)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <MobilePaper sx={{ p: 2 }}>
                <Money amount={taxInfo?.professional_tax} size="1.5rem" />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  State-specific tax deducted monthly. Varies by state and income slab.
                </Typography>
              </MobilePaper>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Tax Deducted at Source (TDS)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <MobilePaper sx={{ p: 2 }}>
                <Money amount={taxInfo?.tds_deduction} size="1.5rem" />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Calculated under Section 192 based on estimated annual taxable income and declared deductions.
                </Typography>
              </MobilePaper>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 3 }} />
          <Typography variant="body2" color="text.secondary">
            For detailed Form 16, investment declarations, or tax planning assistance, contact the Finance/HR team.
          </Typography>
        </MobilePaper>
      )}

      {tab === 5 && (
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Pending approvals (you are the manager)</Typography>
          {pendingLeave.length === 0 ? (
            <Typography sx={{ color: 'text.secondary' }}>No pending leave requests.</Typography>
          ) : (
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>From</TableCell>
                    <TableCell>To</TableCell>
                    <TableCell>Days</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingLeave.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.employee_name}</TableCell>
                      <TableCell>{l.leave_type_name}</TableCell>
                      <TableCell className="figure">{l.start_date?.slice(0, 10)}</TableCell>
                      <TableCell className="figure">{l.end_date?.slice(0, 10)}</TableCell>
                      <TableCell className="figure">{l.days}</TableCell>
                      <TableCell>{l.reason || '—'}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Button size="small" variant="outlined" onClick={() => decideLeave(l.id, 'approved')}>Approve</Button>
                          <Button size="small" variant="outlined" color="error" onClick={() => decideLeave(l.id, 'rejected')}>Reject</Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          )}
        </MobilePaper>
      )}

      {tab === 6 && (
        <MobilePaper>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Documents</Typography>
            <Typography variant="body2" color="text.secondary">
              {docs.length} document{docs.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow><TableCell>Title</TableCell><TableCell>Type</TableCell><TableCell>Uploaded</TableCell><TableCell align="right">Actions</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.title}</TableCell>
                    <TableCell><StatusChip status={d.doc_type} /></TableCell>
                    <TableCell className="figure">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Download"><IconButton size="small" onClick={() => handleDownload(d)}><DownloadIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDeleteDocument(d.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {!docs.length && <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No documents yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {tab === 7 && (
        <MobilePaper>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Device</TableCell>
                  <TableCell>Tag / Serial</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Agent Status</TableCell>
                  <TableCell>Last Heartbeat</TableCell>
                  <TableCell>Assigned</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assets.map((a) => {
                  const agentStatus = a.agent_current_status || 'never_installed';
                  const statusColors = {
                    active: 'success',
                    inactive: 'warning',
                    uninstalled: 'error',
                    never_installed: 'default'
                  };
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{a.name}</Typography>
                          {a.model && <Typography variant="caption" color="text.secondary">({a.model})</Typography>}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{a.asset_tag || '—'}</Typography>
                          {a.serial_number && <Typography variant="caption" color="text.secondary">S/N: {a.serial_number}</Typography>}
                        </Box>
                      </TableCell>
                      <TableCell>{a.asset_type}</TableCell>
                      <TableCell>
                        <Chip 
                          size="small" 
                          label={agentStatus.replace('_', ' ')} 
                          color={statusColors[agentStatus] || 'default'} 
                          variant={agentStatus === 'never_installed' ? 'outlined' : 'filled'}
                        />
                      </TableCell>
                      <TableCell>
                        {a.last_agent_heartbeat ? new Date(a.last_agent_heartbeat).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="figure">
                        {a.assigned_date?.slice(0, 10) || '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!assets.length && <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No company assets assigned to you.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {tab === 8 && (
        <MobilePaper>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>EtherTrack Agent Setup</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Download and install the EtherTrack Agent to enable activity monitoring, attendance tracking, and productivity analytics.
            </Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              <strong>Company Code:</strong> <code>{'ETPL'}</code> (enter this during installation)
            </Alert>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            <Button 
              variant="contained" 
              size="large" 
              startIcon={<DownloadIcon />}
              onClick={async () => {
                try {
                  const proxyUrl = '/api/asset-agent/agent-download';
                  const response = await fetch(proxyUrl);
                  if (!response.ok) throw new Error('Download failed');
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'EtherTrack-Agent-Setup.exe';
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                } catch (err) {
                  alert('Failed to download installer');
                }
              }}
            >
              Download Agent Installer
            </Button>
            <Button 
              variant="outlined" 
              size="large" 
              startIcon={<ExternalLinkIcon />}
              onClick={() => window.open('https://chrome.google.com/webstore/detail/ethertrack-browser-extension', '_blank')}
            >
              Install Browser Extension
            </Button>
          </Box>

          <MobilePaper sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>Installation Instructions</Typography>
            <MobileFormGrid>
              <TextField 
                fullWidth 
                label="Download URL" 
                value="https://your-domain.com/agent/download" 
                readonly 
                InputProps={{ readOnly: true }}
              />
              <TextField 
                fullWidth 
                label="Company Code" 
                value="ETPL" 
                readonly 
                InputProps={{ readOnly: true }}
              />
              <TextField 
                fullWidth 
                label="API Base URL" 
                value="https://api.yourdomain.com" 
                readonly 
                InputProps={{ readOnly: true }}
              />
            </MobileFormGrid>
          </MobilePaper>

          <MobilePaper sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>What the Agent Tracks</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1 }}>⏱️ Attendance</Typography>
                  <Typography variant="body2" color="text.secondary">Auto clock-in/out, idle detection, work mode (office/WFH)</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1 }}>📊 Productivity</Typography>
                  <Typography variant="body2" color="text.secondary">App usage, website visits, focus/engagement scores</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1 }}>📸 Screenshots</Typography>
                  <Typography variant="body2" color="text.secondary">Multi-monitor, watermarked, randomized intervals</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1 }}>🔒 Security</Typography>
                  <Typography variant="body2" color="text.secondary">HWID binding, VM detection, tamper-proof, encrypted storage</Typography>
                </Box>
              </Grid>
            </Grid>
          </MobilePaper>

          <MobilePaper>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>Need Help?</Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Contact IT support at <strong>it@yourcompany.com</strong> or create a support ticket. 
              The agent runs silently in the background — you'll see it in your system tray.
            </Typography>
          </MobilePaper>
        </MobilePaper>
      )}

      {tab === 9 && (
        <MobilePaper>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" size="small" onClick={() => setClaimOpen(true)}>Submit expense claim</Button>
          </Box>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow><TableCell>Description</TableCell><TableCell>Category</TableCell><TableCell align="right">Amount</TableCell><TableCell>Date</TableCell><TableCell>Status</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {myExpenseClaims.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.description || '—'}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{c.category.replace('_', ' ')}</TableCell>
                    <TableCell align="right" className="figure">₹{Number(c.amount).toLocaleString('en-IN')}</TableCell>
                    <TableCell className="figure">{c.expense_date?.slice(0, 10)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={c.status.replace('_', ' ')} color={c.status === 'reimbursed' ? 'success' : c.status === 'rejected' ? 'error' : c.status === 'approved' ? 'info' : 'default'} />
                    </TableCell>
                  </TableRow>
                ))}
                {!myExpenseClaims.length && <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No expense claims yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      <MobileDialog open={claimOpen} onClose={() => setClaimOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Submit expense claim</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <TextField fullWidth select label="Category" value={claimForm.category} onChange={(e) => setClaimForm({ ...claimForm, category: e.target.value })}>
              {CLAIM_CATEGORIES.map((c) => <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c.replace('_', ' ')}</MenuItem>)}
            </TextField>
            <TextField fullWidth label="What was it for" value={claimForm.description} onChange={(e) => setClaimForm({ ...claimForm, description: e.target.value })} />
            <TextField fullWidth type="number" label="Amount (₹)" value={claimForm.amount} onChange={(e) => setClaimForm({ ...claimForm, amount: e.target.value })} />
            <TextField fullWidth type="date" label="Expense date" InputLabelProps={{ shrink: true }} value={claimForm.expense_date} onChange={(e) => setClaimForm({ ...claimForm, expense_date: e.target.value })} />
          </MobileFormGrid>
        </DialogContent>
        <MobileActionButtons>
          <Button onClick={() => setClaimOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitExpenseClaim} disabled={claimSaving || !claimForm.amount || !claimForm.expense_date}>
            {claimSaving ? 'Submitting…' : 'Submit'}
          </Button>
        </MobileActionButtons>
      </MobileDialog>

      <MobileDialog open={leaveOpen} onClose={() => setLeaveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Request leave</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <TextField fullWidth select label="Leave type" value={leaveForm.leave_type_id} onChange={(e) => setLeaveForm({ ...leaveForm, leave_type_id: e.target.value })}>
              {leaveTypes.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
            </TextField>
            <TextField fullWidth type="date" label="Start date" InputLabelProps={{ shrink: true }} value={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })} />
            <TextField fullWidth type="date" label="End date" InputLabelProps={{ shrink: true }} value={leaveForm.end_date} onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })} />
            <TextField fullWidth label="Reason" multiline rows={2} value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <Button onClick={() => setLeaveOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleLeaveSubmit} disabled={saving}>{saving ? 'Requesting…' : 'Request leave'}</Button>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}