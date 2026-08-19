import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
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

  const loadMyClaims = () => client.get('/finance/expense-claims/mine').then(({ data }) => setMyExpenseClaims(data.claims)).catch(() => setMyExpenseClaims([]));
  const loadPendingApproval = () => client.get('/finance/expense-claims/pending-my-approval').then(({ data }) => setPendingApprovalClaims(data.claims)).catch(() => setPendingApprovalClaims([]));
  const loadPendingReimbursement = () => canSeeReimbursements
    ? client.get('/finance/expense-claims', { params: { status: 'approved' } }).then(({ data }) => setPendingReimbursementClaims(data.claims)).catch(() => setPendingReimbursementClaims([]))
    : Promise.resolve();

  const loadAll = useCallback(async () => {
    try {
      const { data } = await client.get('/employees/me');
      setEmployee(data.employee);
      const [payslipRes, leaveRes, leaveTypesRes, docsRes, assetsRes] = await Promise.all([
        client.get('/payroll/me/payslips'),
        client.get('/employees/me/leave'),
        client.get('/employees/leave-types'),
        client.get('/documents', { params: { entity_type: 'employee' } }),
        client.get('/assets'),
      ]);
      setPayslips(payslipRes.data.payslips);
      setLeaveRequests(leaveRes.data.leaveRequests);
      setLeaveTypes(leaveTypesRes.data.leaveTypes);
      setDocs(docsRes.data.documents);
      setAssets(assetsRes.data.assets);
      client.get('/employees/leave/pending').then(({ data }) => setPendingLeave(data.leaveRequests)).catch(() => setPendingLeave([]));
      loadMyClaims();
      loadPendingApproval();
      loadPendingReimbursement();
      client.get('/bank-accounts').then(({ data }) => setBankAccounts(data.accounts || [])).catch(() => setBankAccounts([]));
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

  if (notLinked) return <Alert severity="info">Your login isn't linked to an employee record yet. Contact HR.</Alert>;
  if (!employee) return null;

  const tabs = [
    { key: 0, label: 'Profile', icon: '👤' },
    { key: 1, label: 'Payslips', icon: '💰' },
    { key: 2, label: 'Leave', icon: '📅' },
    { key: 3, label: 'Pending', icon: '⏳' },
    { key: 4, label: 'Documents', icon: '📄' },
    { key: 5, label: 'Assets', icon: '💻' },
    { key: 6, label: 'Claims', icon: '🧾' },
  ];

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>{employee.full_name} — My Profile</Typography>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 2 }}>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6}>
            <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Email</Typography>
            <Typography>{employee.work_email || employee.personal_email}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Phone</Typography>
            <Typography>{employee.phone || '—'}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Department</Typography>
            <Typography>{employee.department_name || '—'}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Designation</Typography>
            <Typography>{employee.designation_title || '—'}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Joined</Typography>
            <Typography>{employee.date_of_joining?.slice(0, 10) || '—'}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Status</Typography>
            <StatusChip status={employee.status} />
          </Grid>
        </Grid>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ '& .MuiTab-root': { minHeight: isMobile ? 40 : 48, fontSize: isMobile ? '0.75rem' : '0.875rem', px: isMobile ? 1 : 1.5 } }}>
          {tabs.map((t) => <Tab key={t.key} label={t.label} />)}
        </Tabs>
      </MobilePaper>

      {tab === 0 && (
        <MobilePaper>
          <Grid container spacing={2}>
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

      {tab === 1 && (
        <MobilePaper>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Period</TableCell>
                  <TableCell align="right">Gross</TableCell>
                  <TableCell align="right">Net</TableCell>
                  <TableCell align="right"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payslips.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{MONTHS[p.month - 1]} {p.year}</TableCell>
                    <TableCell align="right" className="figure"><Money amount={p.gross_pay} size={isMobile ? '0.75rem' : '0.875rem'} /></TableCell>
                    <TableCell align="right" className="figure"><Money amount={p.net_pay} size={isMobile ? '0.75rem' : '0.875rem'} /></TableCell>
                    <TableCell align="right">
                      <Button size="small" startIcon={<DownloadIcon fontSize="small" />} onClick={() => handleDownload({ ...p, title: `payslip-${p.month}-${p.year}` })}>Download</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!payslips.length && <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No payslips yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {tab === 2 && (
        <MobilePaper>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
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
                {!leaveRequests.length && <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No leave requests yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {tab === 3 && (
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

      {tab === 4 && (
        <MobilePaper>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow><TableCell>Title</TableCell><TableCell>Type</TableCell><TableCell>Uploaded</TableCell><TableCell align="right"></TableCell></TableRow>
              </TableHead>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.title}</TableCell>
                    <TableCell><StatusChip status={d.doc_type} /></TableCell>
                    <TableCell className="figure">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <Button size="small" startIcon={<DownloadIcon fontSize="small" />} onClick={() => handleDownload(d)}>Download</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!docs.length && <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No documents yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {tab === 5 && (
        <MobilePaper>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow><TableCell>Item</TableCell><TableCell>Tag</TableCell><TableCell>Assigned since</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {assets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.category}{a.description ? ` — ${a.description}` : ''}</TableCell>
                    <TableCell className="figure">{a.asset_tag || '—'}</TableCell>
                    <TableCell className="figure">{a.assigned_date?.slice(0, 10)}</TableCell>
                  </TableRow>
                ))}
                {!assets.length && <TableRow><TableCell colSpan={3} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No company assets assigned to you.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {tab === 6 && (
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