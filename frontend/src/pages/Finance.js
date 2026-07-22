import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip, Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import Money from '../components/Money';
import { useAuth } from '../context/AuthContext';

const STATUS_COLOR = { pending: 'warning', approved: 'success', rejected: 'error', paid: 'info', cancelled: 'default', converted_to_bill: 'info' };
const CATEGORIES = ['travel', 'meals', 'software', 'office_supplies', 'client_entertainment', 'training', 'other'];

// ════════════════════════════════════════════════════════════════════════
// EXPENSE CLAIMS (reimbursement — AFTER spend)
// ════════════════════════════════════════════════════════════════════════

function SubmitClaimDialog({ open, onClose, onSubmitted }) {
  const [form, setForm] = useState({ category: 'travel', description: '', amount: '', expense_date: '' });
  const [receiptFile, setReceiptFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await client.post('/finance/expense-claims', form);
      const claim = data.claim;

      if (receiptFile) {
        const fd = new FormData();
        fd.append('file', receiptFile);
        fd.append('title', `Receipt — ${form.category}`);
        fd.append('doc_type', 'expense_receipt');
        fd.append('entity_type', 'expense_claim');
        fd.append('entity_id', claim.id);
        const { data: docData } = await client.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        await client.patch(`/finance/expense-claims/${claim.id}/receipt`, { receipt_document_id: docData.document.id });
      }

      setForm({ category: 'travel', description: '', amount: '', expense_date: '' });
      setReceiptFile(null);
      onClose();
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit claim');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Submit expense claim</DialogTitle>
      <DialogContent>
        <TextField fullWidth select label="Category" margin="normal" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c.replace('_', ' ')}</MenuItem>)}
        </TextField>
        <TextField fullWidth label="Description" margin="normal" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <TextField fullWidth type="number" label="Amount (₹)" margin="normal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <TextField fullWidth type="date" label="Expense date" InputLabelProps={{ shrink: true }} margin="normal" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
        <Button component="label" variant="outlined" fullWidth sx={{ mt: 1 }}>
          {receiptFile ? receiptFile.name : 'Attach receipt (optional)'}
          <input type="file" hidden onChange={(e) => setReceiptFile(e.target.files[0])} />
        </Button>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving || !form.amount || !form.expense_date}>
          {saving ? 'Submitting…' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ClaimsTable({ claims, showEmployee, onDecide, onLoadMore, hasMore }) {
  return (
    <Paper>
      <Table size="small">
        <TableHead>
          <TableRow>
            {showEmployee && <TableCell>Employee</TableCell>}
            <TableCell>Category</TableCell>
            <TableCell>Date</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell>Level</TableCell>
            <TableCell>Status</TableCell>
            {onDecide && <TableCell align="right">Decide</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {claims.map((c) => (
            <TableRow key={c.id}>
              {showEmployee && <TableCell sx={{ fontSize: '0.85rem' }}>{c.employee_name}</TableCell>}
              <TableCell sx={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>{c.category.replace('_', ' ')}</TableCell>
              <TableCell className="figure" sx={{ fontSize: '0.8rem' }}>{c.expense_date?.slice(0, 10)}</TableCell>
              <TableCell align="right"><Money amount={c.amount} size="0.85rem" /></TableCell>
              <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{c.current_level}/{c.levels_required}</TableCell>
              <TableCell><Chip size="small" label={c.status} color={STATUS_COLOR[c.status]} /></TableCell>
              {onDecide && (
                <TableCell align="right">
                  <Button size="small" color="error" onClick={() => onDecide(c, 'rejected')}>Reject</Button>
                  <Button size="small" variant="contained" onClick={() => onDecide(c, 'approved')}>Approve</Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {!claims.length && (
            <TableRow><TableCell colSpan={showEmployee ? 7 : 6} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>Nothing here.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
      {hasMore && <Box sx={{ textAlign: 'center', py: 1.5 }}><Button size="small" onClick={onLoadMore}>Load more</Button></Box>}
    </Paper>
  );
}

function ExpenseClaimsSection({ canSeeAll }) {
  const [subTab, setSubTab] = useState(0);
  const [myClaims, setMyClaims] = useState([]);
  const [myClaimsTotal, setMyClaimsTotal] = useState(0);
  const [pendingApproval, setPendingApproval] = useState([]);
  const [allClaims, setAllClaims] = useState([]);
  const [allClaimsTotal, setAllClaimsTotal] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [message, setMessage] = useState(null);
  const PAGE_SIZE = 50;

  const loadMine = () => client.get('/finance/expense-claims/mine', { params: { limit: PAGE_SIZE, offset: 0 } })
    .then(({ data }) => { setMyClaims(data.claims); setMyClaimsTotal(data.pagination?.total ?? data.claims.length); })
    .catch(() => setMyClaims([]));
  const loadMoreMine = () => client.get('/finance/expense-claims/mine', { params: { limit: PAGE_SIZE, offset: myClaims.length } })
    .then(({ data }) => setMyClaims((prev) => [...prev, ...data.claims]));
  const loadPending = () => client.get('/finance/expense-claims/pending-my-approval').then(({ data }) => setPendingApproval(data.claims)).catch(() => setPendingApproval([]));
  const loadAll = () => canSeeAll && client.get('/finance/expense-claims', { params: { limit: PAGE_SIZE, offset: 0 } })
    .then(({ data }) => { setAllClaims(data.claims); setAllClaimsTotal(data.pagination?.total ?? data.claims.length); })
    .catch(() => setAllClaims([]));
  const loadMoreAll = () => client.get('/finance/expense-claims', { params: { limit: PAGE_SIZE, offset: allClaims.length } })
    .then(({ data }) => setAllClaims((prev) => [...prev, ...data.claims]));

  useEffect(() => { loadMine(); loadPending(); loadAll(); }, []);

  const decide = async (claim, decision) => {
    try {
      await client.post(`/finance/expense-claims/${claim.id}/decide`, { decision });
      loadPending(); loadMine(); loadAll();
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to record decision' });
    }
  };

  const SUBTABS = ['My Claims', 'Pending My Approval', ...(canSeeAll ? ['All Claims'] : [])];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setSubmitOpen(true)}>Submit expense claim</Button>
      </Box>
      {message && <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message.text}</Alert>}
      <Tabs value={subTab} onChange={(e, v) => setSubTab(v)} sx={{ mb: 2 }}>
        {SUBTABS.map((t) => <Tab key={t} label={t} />)}
      </Tabs>
      {subTab === 0 && <ClaimsTable claims={myClaims} showEmployee={false} onLoadMore={loadMoreMine} hasMore={myClaims.length < myClaimsTotal} />}
      {subTab === 1 && <ClaimsTable claims={pendingApproval} showEmployee onDecide={decide} />}
      {subTab === 2 && canSeeAll && <ClaimsTable claims={allClaims} showEmployee onLoadMore={loadMoreAll} hasMore={allClaims.length < allClaimsTotal} />}
      <SubmitClaimDialog open={submitOpen} onClose={() => setSubmitOpen(false)} onSubmitted={loadMine} />
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PURCHASE REQUESTS (approval — BEFORE spend)
// ════════════════════════════════════════════════════════════════════════

function SubmitPRDialog({ open, onClose, onSubmitted }) {
  const [form, setForm] = useState({ vendor_name: '', item_description: '', estimated_amount: '', currency: 'INR', needed_by_date: '', justification: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post('/purchase-requests', form);
      setForm({ vendor_name: '', item_description: '', estimated_amount: '', currency: 'INR', needed_by_date: '', justification: '' });
      onClose();
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit purchase request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>New purchase request</DialogTitle>
      <DialogContent>
        <TextField fullWidth label="Vendor name" margin="normal" value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} />
        <TextField fullWidth label="What are you buying?" margin="normal" value={form.item_description} onChange={(e) => setForm({ ...form, item_description: e.target.value })} />
        <TextField fullWidth type="number" label="Estimated amount" margin="normal" value={form.estimated_amount} onChange={(e) => setForm({ ...form, estimated_amount: e.target.value })} />
        <TextField fullWidth type="date" label="Needed by (optional)" InputLabelProps={{ shrink: true }} margin="normal" value={form.needed_by_date} onChange={(e) => setForm({ ...form, needed_by_date: e.target.value })} />
        <TextField fullWidth multiline rows={2} label="Justification (optional)" margin="normal" value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving || !form.vendor_name || !form.item_description || !form.estimated_amount}>
          {saving ? 'Submitting…' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ConvertToBillDialog({ request, onClose, onSaved }) {
  const [form, setForm] = useState({ vendor_id: '', category_id: '', bill_date: '', due_date: '' });
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!request) return;
    client.get('/accounting/vendors').then(({ data }) => setVendors(data.vendors || [])).catch(() => setVendors([]));
    client.get('/accounting/expense-categories').then(({ data }) => setCategories(data.categories || [])).catch(() => setCategories([]));
  }, [request]);

  const handleConvert = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post(`/purchase-requests/${request.id}/convert-to-bill`, form);
      onClose();
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to convert to bill');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!request} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Convert "{request?.item_description}" to a bill</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>
          Requested vendor: {request?.vendor_name}. Select the matching vendor record to create the actual bill against.
        </Typography>
        <TextField fullWidth select label="Vendor" margin="normal" value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}>
          {vendors.map((v) => <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>)}
        </TextField>
        <TextField fullWidth select label="Category (optional)" margin="normal" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
          <MenuItem value="">None</MenuItem>
          {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
        </TextField>
        <TextField fullWidth type="date" label="Bill date" InputLabelProps={{ shrink: true }} margin="normal" value={form.bill_date} onChange={(e) => setForm({ ...form, bill_date: e.target.value })} />
        <TextField fullWidth type="date" label="Due date" InputLabelProps={{ shrink: true }} margin="normal" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleConvert} disabled={saving || !form.vendor_id}>
          {saving ? 'Converting…' : 'Create bill'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PRTable({ requests, showRequester, onDecide, onCancel, onConvert, onLoadMore, hasMore }) {
  return (
    <Paper>
      <Table size="small">
        <TableHead>
          <TableRow>
            {showRequester && <TableCell>Requested by</TableCell>}
            <TableCell>Vendor</TableCell>
            <TableCell>Item</TableCell>
            <TableCell align="right">Est. Amount</TableCell>
            <TableCell>Level</TableCell>
            <TableCell>Status</TableCell>
            {(onDecide || onCancel) && <TableCell align="right">Action</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {requests.map((r) => (
            <TableRow key={r.id}>
              {showRequester && <TableCell sx={{ fontSize: '0.85rem' }}>{r.requested_by_name}</TableCell>}
              <TableCell sx={{ fontSize: '0.85rem' }}>{r.vendor_name}</TableCell>
              <TableCell sx={{ fontSize: '0.85rem' }}>{r.item_description}</TableCell>
              <TableCell align="right"><Money amount={r.estimated_amount} size="0.85rem" /></TableCell>
              <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{r.current_level}/{r.levels_required}</TableCell>
              <TableCell><Chip size="small" label={r.status} color={STATUS_COLOR[r.status]} /></TableCell>
              {onDecide && (
                <TableCell align="right">
                  <Button size="small" color="error" onClick={() => onDecide(r, 'rejected')}>Reject</Button>
                  <Button size="small" variant="contained" onClick={() => onDecide(r, 'approved')}>Approve</Button>
                </TableCell>
              )}
              {onCancel && r.status === 'pending' && (
                <TableCell align="right"><Button size="small" color="error" onClick={() => onCancel(r)}>Cancel</Button></TableCell>
              )}
              {onConvert && r.status === 'approved' && (
                <TableCell align="right"><Button size="small" variant="outlined" onClick={() => onConvert(r)}>Convert to bill</Button></TableCell>
              )}
            </TableRow>
          ))}
          {!requests.length && (
            <TableRow><TableCell colSpan={showRequester ? 7 : 6} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>Nothing here.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
      {hasMore && <Box sx={{ textAlign: 'center', py: 1.5 }}><Button size="small" onClick={onLoadMore}>Load more</Button></Box>}
    </Paper>
  );
}

function PurchaseRequestsSection({ canSeeAll }) {
  const [subTab, setSubTab] = useState(0);
  const [mine, setMine] = useState([]);
  const [mineTotal, setMineTotal] = useState(0);
  const [pendingApproval, setPendingApproval] = useState([]);
  const [all, setAll] = useState([]);
  const [allTotal, setAllTotal] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [message, setMessage] = useState(null);
  const [convertRequest, setConvertRequest] = useState(null);
  const PAGE_SIZE = 50;

  const loadMine = () => client.get('/purchase-requests/mine', { params: { limit: PAGE_SIZE, offset: 0 } })
    .then(({ data }) => { setMine(data.requests); setMineTotal(data.pagination?.total ?? data.requests.length); })
    .catch(() => setMine([]));
  const loadMoreMine = () => client.get('/purchase-requests/mine', { params: { limit: PAGE_SIZE, offset: mine.length } })
    .then(({ data }) => setMine((prev) => [...prev, ...data.requests]));
  const loadPending = () => client.get('/purchase-requests/pending-my-approval').then(({ data }) => setPendingApproval(data.requests)).catch(() => setPendingApproval([]));
  const loadAll = () => canSeeAll && client.get('/purchase-requests', { params: { limit: PAGE_SIZE, offset: 0 } })
    .then(({ data }) => { setAll(data.requests); setAllTotal(data.pagination?.total ?? data.requests.length); })
    .catch(() => setAll([]));
  const loadMoreAll = () => client.get('/purchase-requests', { params: { limit: PAGE_SIZE, offset: all.length } })
    .then(({ data }) => setAll((prev) => [...prev, ...data.requests]));

  useEffect(() => { loadMine(); loadPending(); loadAll(); }, []);

  const decide = async (pr, decision) => {
    try {
      await client.post(`/purchase-requests/${pr.id}/decide`, { decision });
      loadPending(); loadMine(); loadAll();
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to record decision' });
    }
  };

  const cancel = async (pr) => {
    try {
      await client.post(`/purchase-requests/${pr.id}/cancel`);
      loadMine();
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to cancel request' });
    }
  };

  const SUBTABS = ['My Requests', 'Pending My Approval', ...(canSeeAll ? ['All Requests'] : [])];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setSubmitOpen(true)}>New purchase request</Button>
      </Box>
      {message && <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message.text}</Alert>}
      <Tabs value={subTab} onChange={(e, v) => setSubTab(v)} sx={{ mb: 2 }}>
        {SUBTABS.map((t) => <Tab key={t} label={t} />)}
      </Tabs>
      {subTab === 0 && <PRTable requests={mine} showRequester={false} onCancel={cancel} onLoadMore={loadMoreMine} hasMore={mine.length < mineTotal} />}
      {subTab === 1 && <PRTable requests={pendingApproval} showRequester onDecide={decide} />}
      {subTab === 2 && canSeeAll && <PRTable requests={all} showRequester onConvert={setConvertRequest} onLoadMore={loadMoreAll} hasMore={all.length < allTotal} />}
      <SubmitPRDialog open={submitOpen} onClose={() => setSubmitOpen(false)} onSubmitted={loadMine} />
      <ConvertToBillDialog request={convertRequest} onClose={() => setConvertRequest(null)} onSaved={loadAll} />
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════════════
// BUDGETS & CASH FLOW (finance/admin/owner only)
// ════════════════════════════════════════════════════════════════════════

function currentFiscalYearLabel() {
  const now = new Date();
  const fyStart = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
}

function BudgetsCashFlowSection() {
  const fiscalYearLabel = currentFiscalYearLabel();
  const [cashFlow, setCashFlow] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [variance, setVariance] = useState(null);
  const [newBudget, setNewBudget] = useState({ department: '', category: '', budgeted_amount_inr: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadCashFlow = () => client.get('/finance/cash-flow').then(({ data }) => setCashFlow(data)).catch(() => setCashFlow(null));
  const loadForecast = () => client.get('/finance/cash-flow/forecast', { params: { months: 6 } }).then(({ data }) => setForecast(data)).catch(() => setForecast(null));
  const loadVariance = () => client.get('/finance/budgets/variance', { params: { fiscal_year_label: fiscalYearLabel } })
    .then(({ data }) => setVariance(data)).catch(() => setVariance(null));

  useEffect(() => { loadCashFlow(); loadForecast(); loadVariance(); }, []);

  const saveBudget = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post('/finance/budgets', { ...newBudget, fiscal_year_label: fiscalYearLabel });
      setNewBudget({ department: '', category: '', budgeted_amount_inr: '' });
      loadVariance();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      {cashFlow && (
        <Paper sx={{ p: 2.5, mb: 3 }}>
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Cash Flow — as of {cashFlow.asOf}</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Total cash</Typography>
              <Money amount={cashFlow.totalCashInr} size="1.3rem" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Trailing monthly burn</Typography>
              <Money amount={cashFlow.trailingMonthlyBurnInr} size="1.3rem" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Runway</Typography>
              <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }} className="figure">
                {cashFlow.runwayMonths != null ? `${cashFlow.runwayMonths.toFixed(1)} months` : '—'}
              </Typography>
            </Grid>
          </Grid>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 2 }}>{cashFlow.note}</Typography>
        </Paper>
      )}

      {forecast && (
        <Paper sx={{ p: 2.5, mb: 3 }}>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>6-Month Cash Flow Forecast</Typography>
          {forecast.monthsUntilNegative && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Projected cash goes negative in month {forecast.monthsUntilNegative} at current known commitments.
            </Alert>
          )}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Month</TableCell>
                <TableCell align="right">Recurring Exp.</TableCell>
                <TableCell align="right">Payroll (avg)</TableCell>
                <TableCell align="right">Purchase Reqs.</TableCell>
                <TableCell align="right">Total Outflow</TableCell>
                <TableCell align="right">Projected Cash</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {forecast.forecast.map((f) => (
                <TableRow key={f.month} sx={{ bgcolor: f.projectedCashInr < 0 ? 'error.light' : undefined }}>
                  <TableCell sx={{ fontSize: '0.85rem' }}>{f.month}</TableCell>
                  <TableCell align="right"><Money amount={f.recurringExpensesInr} size="0.8rem" /></TableCell>
                  <TableCell align="right"><Money amount={f.payrollInr} size="0.8rem" /></TableCell>
                  <TableCell align="right"><Money amount={f.purchaseRequestsInr} size="0.8rem" /></TableCell>
                  <TableCell align="right"><Money amount={f.totalOutflowInr} size="0.8rem" /></TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: f.projectedCashInr < 0 ? 'error.main' : 'text.primary' }}>
                    <Money amount={f.projectedCashInr} size="0.85rem" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 1.5 }}>{forecast.note}</Typography>
        </Paper>
      )}

      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Set a budget — {fiscalYearLabel}</Typography>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} sm={3}>
            <TextField fullWidth size="small" label="Department" value={newBudget.department} onChange={(e) => setNewBudget({ ...newBudget, department: e.target.value })} placeholder="e.g. Salaries" />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth size="small" label="Category (optional)" value={newBudget.category} onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value })} placeholder="Must match an expense category name" />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth size="small" type="number" label="Budgeted amount (₹)" value={newBudget.budgeted_amount_inr} onChange={(e) => setNewBudget({ ...newBudget, budgeted_amount_inr: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <Button variant="contained" fullWidth onClick={saveBudget} disabled={saving || !newBudget.department || !newBudget.budgeted_amount_inr}>
              {saving ? 'Saving…' : 'Save budget'}
            </Button>
          </Grid>
        </Grid>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Paper>

      {variance && (
        <Paper sx={{ p: 2.5 }}>
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Budget vs Actual — {fiscalYearLabel}</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Department</TableCell><TableCell>Category</TableCell>
                <TableCell align="right">Budgeted</TableCell><TableCell align="right">Actual</TableCell>
                <TableCell align="right">Variance</TableCell><TableCell>Source</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {variance.budgets.map((b) => (
                <TableRow key={b.id} sx={{ bgcolor: b.overBudget ? 'error.light' : undefined }}>
                  <TableCell sx={{ fontSize: '0.85rem' }}>{b.department}</TableCell>
                  <TableCell sx={{ fontSize: '0.85rem' }}>{b.category || '—'}</TableCell>
                  <TableCell align="right"><Money amount={b.budgeted_amount_inr} size="0.85rem" /></TableCell>
                  <TableCell align="right"><Money amount={b.actual_spend_inr} size="0.85rem" /></TableCell>
                  <TableCell align="right" sx={{ color: b.overBudget ? 'error.main' : 'text.primary' }}>
                    <Money amount={b.variance} size="0.85rem" />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{b.actualSource}</TableCell>
                </TableRow>
              ))}
              {!variance.budgets.length && (
                <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No budgets set for this fiscal year yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 1.5 }}>{variance.note}</Typography>
        </Paper>
      )}
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════════════
// THRESHOLDS (owner/admin only)
// ════════════════════════════════════════════════════════════════════════

function ThresholdsTab() {
  const [thresholds, setThresholds] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = () => client.get('/finance/thresholds').then(({ data }) => setThresholds(data.thresholds)).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    setError('');
    try {
      await client.put(`/finance/thresholds/${editing.id}`, {
        min_amount: editing.min_amount, max_amount: editing.max_amount, levels_required: editing.levels_required,
      });
      setEditing(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save threshold');
    }
  };

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2.5 }}>
        Controls how many approval levels an expense claim or purchase request needs, by amount. 0 = auto-approved, no chain.
        Changing a band only affects requests submitted after the change — already-submitted ones keep their original requirement.
      </Alert>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>Type</TableCell><TableCell align="right">Min (₹)</TableCell><TableCell align="right">Max (₹)</TableCell><TableCell align="right">Levels</TableCell><TableCell align="right"></TableCell></TableRow>
          </TableHead>
          <TableBody>
            {thresholds.map((t) => (
              <TableRow key={t.id}>
                <TableCell sx={{ fontSize: '0.85rem' }}>{t.request_type.replace('_', ' ')}</TableCell>
                <TableCell align="right"><Money amount={t.min_amount} size="0.8rem" /></TableCell>
                <TableCell align="right">{t.max_amount ? <Money amount={t.max_amount} size="0.8rem" /> : '∞'}</TableCell>
                <TableCell align="right">{t.levels_required}</TableCell>
                <TableCell align="right"><Button size="small" onClick={() => { setError(''); setEditing({ ...t }); }}>Edit</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit threshold band</DialogTitle>
        {editing && (
          <DialogContent>
            <TextField fullWidth type="number" label="Min amount" margin="normal" value={editing.min_amount} onChange={(e) => setEditing({ ...editing, min_amount: e.target.value })} />
            <TextField fullWidth type="number" label="Max amount (blank = unlimited)" margin="normal" value={editing.max_amount || ''} onChange={(e) => setEditing({ ...editing, max_amount: e.target.value })} />
            <TextField fullWidth select type="number" label="Levels required" margin="normal" value={editing.levels_required} onChange={(e) => setEditing({ ...editing, levels_required: Number(e.target.value) })}>
              {[0, 1, 2, 3].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </TextField>
            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TOP-LEVEL PAGE
// ════════════════════════════════════════════════════════════════════════

export default function Finance() {
  const { staff } = useAuth();
  const isAdmin = ['owner', 'admin'].includes(staff?.role);
  const canSeeAll = ['owner', 'admin', 'finance'].includes(staff?.role);

  const [section, setSection] = useState(0);

  const SECTIONS = [
    'Expense Claims',
    'Purchase Requests',
    ...(canSeeAll ? ['Budgets & Cash Flow'] : []),
    ...(isAdmin ? ['Thresholds'] : []),
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>Finance</Typography>

      <Tabs value={section} onChange={(e, v) => setSection(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        {SECTIONS.map((s) => <Tab key={s} label={s} />)}
      </Tabs>

      {section === 0 && <ExpenseClaimsSection canSeeAll={canSeeAll} />}
      {section === 1 && <PurchaseRequestsSection canSeeAll={canSeeAll} />}
      {section === 2 && canSeeAll && <BudgetsCashFlowSection />}
      {((canSeeAll && section === 3) || (!canSeeAll && section === 2)) && isAdmin && <ThresholdsTab />}
    </Box>
  );
}