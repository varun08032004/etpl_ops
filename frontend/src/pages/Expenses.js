import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Tabs, Tab, IconButton, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Alert, Table, TableHead, TableRow, TableCell,
  TableBody, Switch, Tooltip, FormControlLabel,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import HistoryIcon from '@mui/icons-material/History';
import client from '../api/client';
import Money from '../components/Money';
import StatusChip from '../components/StatusChip';

const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly', 'custom_days'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'SGD'];
const emptyForm = {
  id: null, name: '', category_id: '', testnet_amount: '', prod_amount: '', currency: 'USD',
  frequency: 'monthly', custom_interval_days: '', start_date: new Date().toISOString().slice(0, 10),
  end_date: '', reminder_days_before: 3, auto_create_bill: false, account_url: '', notes: '',
};

function CalendarView() {
  const [cursor, setCursor] = useState(new Date());
  const [occurrences, setOccurrences] = useState([]);

  useEffect(() => {
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1).toISOString().slice(0, 10);
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).toISOString().slice(0, 10);
    client.get('/expenses/calendar', { params: { from, to } }).then(({ data }) => setOccurrences(data.occurrences));
  }, [cursor]);

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const byDay = {};
  occurrences.forEach((o) => {
    const day = Number(o.due_date.slice(8, 10));
    byDay[day] = byDay[day] || [];
    byDay[day].push(o);
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography sx={{ fontWeight: 600 }}>{cursor.toLocaleString('default', { month: 'long', year: 'numeric' })}</Typography>
        <Box>
          <IconButton size="small" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeftIcon /></IconButton>
          <IconButton size="small" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRightIcon /></IconButton>
        </Box>
      </Box>
      <Grid container spacing={0.5}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <Grid item xs={12 / 7} key={d}><Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textAlign: 'center', pb: 1 }}>{d}</Typography></Grid>
        ))}
        {cells.map((day, i) => (
          <Grid item xs={12 / 7} key={i}>
            <Paper sx={{ minHeight: 76, p: 0.75, bgcolor: day ? 'background.paper' : 'transparent', border: day ? undefined : 'none' }}>
              {day && (
                <>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{day}</Typography>
                  {(byDay[day] || []).map((o) => (
                    <Tooltip key={o.id} title={`${o.name} — ₹${o.amount}`}>
                      <Chip
                        size="small" label={o.name} sx={{ fontSize: '0.6rem', height: 18, mt: 0.25, maxWidth: '100%' }}
                        color={o.status === 'overdue' ? 'error' : o.status === 'paid' ? 'success' : 'default'}
                        variant={o.status === 'paid' ? 'filled' : 'outlined'}
                      />
                    </Tooltip>
                  ))}
                </>
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function TimelineView({ onMarkPaid }) {
  const [occurrences, setOccurrences] = useState([]);
  const [failDialog, setFailDialog] = useState(null);
  const [failReason, setFailReason] = useState('');
  const load = () => client.get('/expenses/timeline').then(({ data }) => setOccurrences(data.occurrences));
  useEffect(() => { load(); }, []);

  const openFailDialog = (o) => { setFailReason(''); setFailDialog(o); };
  const confirmFail = async () => {
    await client.post(`/expenses/occurrences/${failDialog.id}/mark-failed`, { reason: failReason });
    setFailDialog(null);
    load();
  };

  const toggleReconcile = async (o) => {
    if (o.reconciled) await client.post(`/expenses/occurrences/${o.id}/unreconcile`);
    else await client.post(`/expenses/occurrences/${o.id}/reconcile`);
    load();
  };

  return (
    <Paper>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell><TableCell>Expense</TableCell><TableCell>Frequency</TableCell>
            <TableCell align="right">Amount</TableCell><TableCell>Status</TableCell>
            <TableCell align="center">Reconciled</TableCell><TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {occurrences.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="figure">{o.due_date.slice(0, 10)}</TableCell>
              <TableCell>{o.name}</TableCell>
              <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary', textTransform: 'capitalize' }}>{o.frequency.replace('_', ' ')}</TableCell>
              <TableCell align="right">
                <Money amount={o.amount} />
                {o.original_currency && o.original_currency !== 'INR' && (
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                    {o.original_currency} {Number(o.original_amount).toLocaleString()} @ {Number(o.exchange_rate).toFixed(2)}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <StatusChip status={o.status} />
                {o.status === 'failed' && o.failure_reason && (
                  <Typography sx={{ fontSize: '0.7rem', color: 'error.main', mt: 0.25 }}>{o.failure_reason}</Typography>
                )}
              </TableCell>
              <TableCell align="center">
                {o.status === 'paid' ? (
                  <Tooltip title={o.reconciled ? 'Reconciled against bank statement — click to undo' : 'Not yet reconciled — click once confirmed against bank statement'}>
                    <Switch size="small" checked={!!o.reconciled} onChange={() => toggleReconcile(o)} />
                  </Tooltip>
                ) : '—'}
              </TableCell>
              <TableCell align="right">
                {['upcoming', 'due', 'overdue'].includes(o.status) && (
                  <>
                    <Button size="small" onClick={() => onMarkPaid(o, load)}>Mark paid</Button>
                    <Button size="small" color="error" onClick={() => openFailDialog(o)}>Mark failed</Button>
                  </>
                )}
                {o.status === 'failed' && (
                  <Button size="small" onClick={() => onMarkPaid(o, load)}>Retry / mark paid</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {!occurrences.length && <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>Nothing in the next 90 days or last 30 days.</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Dialog open={!!failDialog} onClose={() => setFailDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Mark "{failDialog?.name}" as failed</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Reason (e.g. card declined, insufficient balance)" value={failReason} onChange={(e) => setFailReason(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFailDialog(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmFail}>Mark failed</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

function RecurringList({ environment }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [auditDialog, setAuditDialog] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [approvalError, setApprovalError] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  const load = () => {
    const params = { limit: pageSize, offset: page * pageSize };
    if (categoryFilter) params.category_id = categoryFilter;
    client.get('/expenses/recurring', { params }).then(({ data }) => {
      setItems(data.recurringExpenses);
      setTotal(data.pagination?.total ?? data.recurringExpenses.length);
    });
  };
  useEffect(() => {
    load();
    client.get('/accounting/expense-categories').then(({ data }) => setCategories(data.categories)).catch(() => {});
  }, [environment, categoryFilter, page]);

  useEffect(() => { setPage(0); }, [categoryFilter]);

  const toggleActive = async (id, e) => {
    e.stopPropagation();
    await client.post(`/expenses/recurring/${id}/toggle`);
    load();
  };

  const openCreate = () => { setForm(emptyForm); setError(''); setOpen(true); };

  const openEdit = (r, e) => {
    e.stopPropagation();
    setForm({
      id: r.id, name: r.name, category_id: r.category_id || '', testnet_amount: r.testnet_amount,
      prod_amount: r.prod_amount, currency: r.currency, frequency: r.frequency,
      custom_interval_days: r.custom_interval_days || '', start_date: r.start_date?.slice(0, 10) || '',
      end_date: r.end_date?.slice(0, 10) || '', reminder_days_before: r.reminder_days_before,
      auto_create_bill: r.auto_create_bill, account_url: r.account_url || '', notes: r.notes || '',
    });
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (form.id) {
        await client.put(`/expenses/recurring/${form.id}`, form);
      } else {
        await client.post('/expenses/recurring', form);
      }
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (r, e) => { e.stopPropagation(); setDeleteError(''); setConfirmDelete(r); };

  const handleApprove = async (id, e) => {
    e.stopPropagation();
    setApprovalError('');
    try {
      await client.post(`/expenses/recurring/${id}/approve`);
      load();
    } catch (err) {
      setApprovalError(err.response?.data?.error || 'Failed to approve — only owner/admin can approve.');
    }
  };

  const handleReject = async (id, e) => {
    e.stopPropagation();
    setApprovalError('');
    try {
      await client.post(`/expenses/recurring/${id}/reject`);
      load();
    } catch (err) {
      setApprovalError(err.response?.data?.error || 'Failed to reject — only owner/admin can reject.');
    }
  };

  const openAuditLog = async (r, e) => {
    e.stopPropagation();
    setAuditDialog(r);
    const { data } = await client.get(`/expenses/recurring/${r.id}/audit-log`, { params: { limit: 20, offset: 0 } });
    setAuditLog(data.auditLog);
    setAuditTotal(data.pagination?.total ?? data.auditLog.length);
  };

  const loadMoreAuditLog = async () => {
    const { data } = await client.get(`/expenses/recurring/${auditDialog.id}/audit-log`, { params: { limit: 20, offset: auditLog.length } });
    setAuditLog((prev) => [...prev, ...data.auditLog]);
  };

  const confirmDeleteNow = async () => {
    try {
      await client.delete(`/expenses/recurring/${confirmDelete.id}`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
        <TextField
          select size="small" label="Filter by category" value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)} sx={{ minWidth: 220 }}
        >
          <MenuItem value="">All categories</MenuItem>
          {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
        </TextField>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New recurring expense</Button>
      </Box>
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell><TableCell>Category</TableCell><TableCell>Frequency</TableCell>
              <TableCell align="right">Amount ({environment})</TableCell><TableCell>Next due</TableCell>
              <TableCell>Approval</TableCell>
              <TableCell align="right">Active</TableCell><TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((r) => (
              <TableRow
                key={r.id}
                hover={!!r.account_url}
                sx={{ cursor: r.account_url ? 'pointer' : 'default' }}
                onClick={() => r.account_url && window.open(r.account_url, '_blank', 'noopener,noreferrer')}
              >
                <TableCell>
                  {r.name}
                  {r.account_url && <OpenInNewIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle', color: 'text.secondary' }} />}
                </TableCell>
                <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{r.category_name || '—'}</TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>{r.frequency.replace('_', ' ')}</TableCell>
                <TableCell align="right">
                  {r.currency !== 'INR' ? (
                    <Typography className="figure">{r.currency} {Number(r.effective_amount).toLocaleString()}</Typography>
                  ) : <Money amount={r.effective_amount} />}
                </TableCell>
                <TableCell className="figure">{r.next_due_date?.slice(0, 10)}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Chip
                    size="small" label={r.approval_status.replace('_', ' ')}
                    color={r.approval_status === 'approved' ? 'success' : r.approval_status === 'rejected' ? 'error' : 'warning'}
                    variant={r.approval_status === 'approved' ? 'outlined' : 'filled'}
                  />
                  {r.approval_status === 'pending_approval' && (
                    <Box sx={{ mt: 0.5 }}>
                      <Button size="small" onClick={(e) => handleApprove(r.id, e)}>Approve</Button>
                      <Button size="small" color="error" onClick={(e) => handleReject(r.id, e)}>Reject</Button>
                    </Box>
                  )}
                </TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <Switch checked={r.is_active} onChange={(e) => toggleActive(r.id, e)} size="small" />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={(e) => openAuditLog(r, e)}><HistoryIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={(e) => openEdit(r, e)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={(e) => handleDeleteClick(r, e)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!items.length && <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No recurring expenses set up yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
      {total > pageSize && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
          </Typography>
          <Box>
            <Button size="small" disabled={page === 0} onClick={() => setPage((p) => Math.max(p - 1, 0))}>Previous</Button>
            <Button size="small" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </Box>
        </Box>
      )}
      {approvalError && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setApprovalError('')}>{approvalError}</Alert>}

      <Dialog open={!!auditDialog} onClose={() => setAuditDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>History — {auditDialog?.name}</DialogTitle>
        <DialogContent>
          {auditLog.map((entry) => (
            <Box key={entry.id} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize' }}>{entry.action}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                {entry.changed_by_email || 'System'} — {new Date(entry.created_at).toLocaleString()}
              </Typography>
            </Box>
          ))}
          {!auditLog.length && <Typography sx={{ color: 'text.secondary', py: 2 }}>No history yet.</Typography>}
          {auditLog.length < auditTotal && (
            <Button size="small" onClick={loadMoreAuditLog} sx={{ mt: 1 }}>Load more</Button>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAuditDialog(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? 'Edit recurring expense' : 'New recurring expense'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField fullWidth label="Name (e.g. Vercel, Railway, Supabase)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Grid>
            <Grid item xs={4}><TextField fullWidth type="number" label="Testnet amount" value={form.testnet_amount} onChange={(e) => setForm({ ...form, testnet_amount: e.target.value })} /></Grid>
            <Grid item xs={4}><TextField fullWidth type="number" label="Production amount" value={form.prod_amount} onChange={(e) => setForm({ ...form, prod_amount: e.target.value })} /></Grid>
            <Grid item xs={4}>
              <TextField fullWidth select label="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {CURRENCIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth select label="Frequency" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                {FREQUENCIES.map((f) => <MenuItem key={f} value={f}>{f.replace('_', ' ')}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth select required label="Category" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
            </Grid>
            {form.frequency === 'custom_days' && (
              <Grid item xs={6}><TextField fullWidth type="number" label="Repeat every N days" value={form.custom_interval_days} onChange={(e) => setForm({ ...form, custom_interval_days: e.target.value })} /></Grid>
            )}
            <Grid item xs={6}><TextField fullWidth type="date" label="Start date" InputLabelProps={{ shrink: true }} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="date" label="End date (optional)" InputLabelProps={{ shrink: true }} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Remind me N days before" value={form.reminder_days_before} onChange={(e) => setForm({ ...form, reminder_days_before: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Account URL (dashboard/billing link)" placeholder="https://vercel.com/dashboard" value={form.account_url} onChange={(e) => setForm({ ...form, account_url: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Grid>
          </Grid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name || form.testnet_amount === '' || form.prod_amount === '' || !form.category_id}>
            {saving ? 'Saving…' : form.id ? 'Save changes' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete "{confirmDelete?.name}"?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
            This removes the recurring expense and any unpaid occurrences. If it already has paid occurrences linked to bills, delete will be blocked — deactivate it instead.
          </Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDeleteNow}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function InsightsView() {
  const [fxExposure, setFxExposure] = useState(null);
  const [budgetVsActual, setBudgetVsActual] = useState(null);
  const [unreconciled, setUnreconciled] = useState([]);
  const [budgetEdits, setBudgetEdits] = useState({});
  const [bankAccounts, setBankAccounts] = useState([]);
  const [syncBank, setSyncBank] = useState('');
  const [syncStatus, setSyncStatus] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exportCategory, setExportCategory] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const [categories, setCategories] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const loadAll = () => {
    client.get('/expenses/recurring/fx-exposure').then(({ data }) => setFxExposure(data));
    client.get('/expenses/budget-vs-actual').then(({ data }) => setBudgetVsActual(data));
    client.get('/expenses/occurrences/unreconciled').then(({ data }) => setUnreconciled(data.occurrences));
    client.get('/accounting/bank-accounts').then(({ data }) => setBankAccounts(data.bankAccounts)).catch(() => {});
    client.get('/accounting/expense-categories').then(({ data }) => setCategories(data.categories)).catch(() => {});
  };
  useEffect(() => { loadAll(); }, []);

  const runExport = async () => {
    setExporting(true);
    setExportError('');
    try {
      const params = { format: exportFormat };
      if (exportFrom) params.from = exportFrom;
      if (exportTo) params.to = exportTo;
      if (exportCategory) params.category_id = exportCategory;
      if (exportStatus) params.status = exportStatus;

      const response = await client.get('/expenses/export', { params, responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: exportFormat === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ethertrack-expenses-${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setExportError('Export failed — please try again.');
    } finally {
      setExporting(false);
    }
  };

  const runBankSync = async () => {
    if (!syncBank) return;
    setSyncing(true);
    setSyncStatus('');
    try {
      const { data: syncResult } = await client.post(`/expenses/bank-accounts/${syncBank}/sync`);
      const { data: matchResult } = await client.post(`/expenses/bank-accounts/${syncBank}/auto-match`);
      setSyncStatus(`Synced ${syncResult.transactionsInserted} new transaction(s). Auto-matched ${matchResult.autoMatched}, ${matchResult.stillUnmatched} still need manual review.`);
      loadAll();
    } catch (err) {
      setSyncStatus(err.response?.data?.error || 'Bank sync failed — Axis Bank API may not be configured yet.');
    } finally {
      setSyncing(false);
    }
  };

  const saveBudget = async (categoryId) => {
    const value = budgetEdits[categoryId];
    if (value === undefined || value === '') return;
    await client.put(`/expenses/category-budgets/${categoryId}`, { monthly_budget_inr: value });
    loadAll();
  };

  const reconcileFromQueue = async (id) => {
    await client.post(`/expenses/occurrences/${id}/reconcile`);
    loadAll();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper sx={{ p: 2.5 }}>
        <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Export</Typography>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
          One row per payment occurrence — due date, paid date, currency, INR amount, category, status, reconciliation. For your CA or your own records.
        </Typography>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={6} sm={2}>
            <TextField select size="small" fullWidth label="Format" value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
              <MenuItem value="xlsx">Excel (.xlsx)</MenuItem>
              <MenuItem value="csv">CSV</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField size="small" fullWidth type="date" label="From" InputLabelProps={{ shrink: true }} value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField size="small" fullWidth type="date" label="To" InputLabelProps={{ shrink: true }} value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField select size="small" fullWidth label="Category" value={exportCategory} onChange={(e) => setExportCategory(e.target.value)}>
              <MenuItem value="">All categories</MenuItem>
              {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField select size="small" fullWidth label="Status" value={exportStatus} onChange={(e) => setExportStatus(e.target.value)}>
              <MenuItem value="">All statuses</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="upcoming">Upcoming</MenuItem>
              <MenuItem value="due">Due</MenuItem>
              <MenuItem value="overdue">Overdue</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="skipped">Skipped</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={1}>
            <Button variant="contained" fullWidth onClick={runExport} disabled={exporting}>{exporting ? '…' : 'Export'}</Button>
          </Grid>
        </Grid>
        {exportError && <Alert severity="error" sx={{ mt: 2 }}>{exportError}</Alert>}
      </Paper>

      {fxExposure && (
        <Paper sx={{ p: 2.5 }}>
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>FX Exposure ({fxExposure.environment})</Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
            {fxExposure.nonInrSharePct.toFixed(1)}% of your monthly recurring spend sits in foreign currency —
            ₹{Number(fxExposure.nonInrExposureInr).toLocaleString(undefined, { maximumFractionDigits: 0 })} of
            ₹{Number(fxExposure.totalMonthlyInr).toLocaleString(undefined, { maximumFractionDigits: 0 })} total.
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Currency</TableCell><TableCell align="right">Monthly (own currency)</TableCell>
                <TableCell align="right">Rate → INR</TableCell><TableCell align="right">Monthly (INR)</TableCell>
                <TableCell align="right">If rate ±5%</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fxExposure.byCurrency.map((e) => (
                <TableRow key={e.currency}>
                  <TableCell>{e.currency}</TableCell>
                  <TableCell align="right" className="figure">{e.monthlyAmountOwnCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                  <TableCell align="right" className="figure">{Number(e.rateToInr).toFixed(2)}</TableCell>
                  <TableCell align="right" className="figure">₹{e.monthlyInr.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    ₹{e.sensitivityMinus5Pct.toLocaleString(undefined, { maximumFractionDigits: 0 })} – ₹{e.sensitivityPlus5Pct.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {budgetVsActual && (
        <Paper sx={{ p: 2.5 }}>
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Budget vs Actual — {budgetVsActual.month}</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Category</TableCell><TableCell align="right">Monthly budget (INR)</TableCell>
                <TableCell align="right">Actual paid</TableCell><TableCell align="right">Variance</TableCell><TableCell align="right">Set budget</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {budgetVsActual.categories.map((c) => (
                <TableRow key={c.category_id} sx={{ bgcolor: c.overBudget ? 'error.light' : undefined }}>
                  <TableCell>{c.category_name}</TableCell>
                  <TableCell align="right" className="figure">{c.monthly_budget_inr != null ? `₹${Number(c.monthly_budget_inr).toLocaleString()}` : '—'}</TableCell>
                  <TableCell align="right" className="figure">₹{Number(c.actual_paid_this_month).toLocaleString()}</TableCell>
                  <TableCell align="right" className="figure" sx={{ color: c.overBudget ? 'error.main' : 'text.primary' }}>
                    {c.variance != null ? `₹${Number(c.variance).toLocaleString()}` : '—'}
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <TextField
                        size="small" type="number" placeholder="Set" sx={{ width: 100 }}
                        value={budgetEdits[c.category_id] ?? ''}
                        onChange={(e) => setBudgetEdits({ ...budgetEdits, [c.category_id]: e.target.value })}
                      />
                      <Button size="small" onClick={() => saveBudget(c.category_id)}>Save</Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Paper sx={{ p: 2.5 }}>
        <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Bank Sync (Axis Bank)</Typography>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
          Pulls recent transactions from Axis and auto-matches them against paid, unreconciled occurrences.
          Requires Axis API credentials to be configured on the backend — until then this will show a clear error.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField select size="small" label="Bank account" value={syncBank} onChange={(e) => setSyncBank(e.target.value)} sx={{ minWidth: 220 }}>
            {bankAccounts.map((b) => <MenuItem key={b.id} value={b.id}>{b.account_name}</MenuItem>)}
          </TextField>
          <Button variant="outlined" onClick={runBankSync} disabled={!syncBank || syncing}>{syncing ? 'Syncing…' : 'Sync + auto-match'}</Button>
        </Box>
        {syncStatus && <Alert severity={syncStatus.includes('failed') || syncStatus.includes('not configured') ? 'warning' : 'success'} sx={{ mt: 2 }}>{syncStatus}</Alert>}
      </Paper>

      <Paper sx={{ p: 2.5 }}>
        <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Unreconciled Payments</Typography>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
          Paid occurrences not yet confirmed against a bank statement.
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>Paid date</TableCell><TableCell>Expense</TableCell><TableCell align="right">Amount</TableCell><TableCell align="right">Action</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {unreconciled.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="figure">{o.paid_date?.slice(0, 10)}</TableCell>
                <TableCell>{o.name}</TableCell>
                <TableCell align="right"><Money amount={o.amount} /></TableCell>
                <TableCell align="right"><Button size="small" onClick={() => reconcileFromQueue(o.id)}>Reconcile</Button></TableCell>
              </TableRow>
            ))}
            {!unreconciled.length && <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>Everything's reconciled.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

export default function Expenses() {
  const [tab, setTab] = useState(0);
  const [fySummary, setFySummary] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [payDialog, setPayDialog] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBank, setSelectedBank] = useState('');
  const [environment, setEnvironment] = useState('testnet');
  const [totals, setTotals] = useState(null);
  const [totalsPeriod, setTotalsPeriod] = useState('monthly'); // 'monthly' | 'yearly'
  const [totalsCurrency, setTotalsCurrency] = useState('inr'); // 'inr' | 'usd'

  const loadTotals = () => client.get('/expenses/recurring/totals').then(({ data }) => setTotals(data));

  useEffect(() => {
    client.get('/expenses/settings/environment').then(({ data }) => setEnvironment(data.environment));
    client.get('/expenses/fy-summary').then(({ data }) => setFySummary(data));
    client.get('/accounting/bank-accounts').then(({ data }) => setBankAccounts(data.bankAccounts)).catch(() => {});
    loadTotals();
  }, []);

  const toggleEnvironment = async () => {
    const next = environment === 'testnet' ? 'production' : 'testnet';
    setEnvironment(next); // optimistic
    try {
      await client.put('/expenses/settings/environment', { environment: next });
      loadTotals();
    } catch {
      setEnvironment(environment); // revert on failure
    }
  };

  const runDailyCheck = async () => {
    setChecking(true);
    try {
      const { data } = await client.post('/expenses/run-daily-check');
      setCheckResult(`Generated ${data.occurrencesCreated} due occurrence(s), sent ${data.remindersFired} reminder(s), flagged ${data.overdueFlagged} as overdue.`);
    } finally {
      setChecking(false);
    }
  };

  const handleMarkPaid = (occurrence, reload) => setPayDialog({ occurrence, reload });

  const [payError, setPayError] = useState('');
  const confirmMarkPaid = async () => {
    setPayError('');
    try {
      await client.post(`/expenses/occurrences/${payDialog.occurrence.id}/mark-paid`, selectedBank ? { bank_account_id: selectedBank } : {});
      payDialog.reload();
      setPayDialog(null);
      setSelectedBank('');
    } catch (err) {
      setPayError(err.response?.data?.error || 'Failed to mark paid');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5">Recurring Expenses</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={<Switch checked={environment === 'production'} onChange={toggleEnvironment} color="warning" />}
            label={<Typography sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }}>{environment}</Typography>}
          />
          <Button variant="outlined" onClick={runDailyCheck} disabled={checking}>{checking ? 'Checking…' : 'Run daily check'}</Button>
        </Box>
      </Box>

      {checkResult && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setCheckResult(null)}>{checkResult}</Alert>}

      {totals && (
        <Paper sx={{ p: 2.5, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                Total {totalsPeriod === 'monthly' ? 'monthly' : 'yearly'} recurring cost — active items ({environment})
              </Typography>
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 700 }} className="figure">
                {totalsCurrency === 'inr' ? '₹' : '$'}
                {Number(totals[totalsPeriod][totalsCurrency]).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: '0.75rem' }}>Monthly</Typography>
                <Switch size="small" checked={totalsPeriod === 'yearly'} onChange={(e) => setTotalsPeriod(e.target.checked ? 'yearly' : 'monthly')} />
                <Typography sx={{ fontSize: '0.75rem' }}>Yearly</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: '0.75rem' }}>INR</Typography>
                <Switch size="small" checked={totalsCurrency === 'usd'} onChange={(e) => setTotalsCurrency(e.target.checked ? 'usd' : 'inr')} />
                <Typography sx={{ fontSize: '0.75rem' }}>USD</Typography>
              </Box>
            </Box>
          </Box>
        </Paper>
      )}

      {fySummary && (
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <Paper sx={{ p: 2.5 }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Total expenses — {fySummary.period.label}</Typography>
              <Money amount={fySummary.totalExpense} size="1.4rem" />
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Paper sx={{ p: 2.5 }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Recurring expenses paid — {fySummary.period.label}</Typography>
              <Money amount={fySummary.recurringExpenseBreakdown.reduce((s, r) => s + Number(r.total_paid), 0)} size="1.4rem" />
            </Paper>
          </Grid>
        </Grid>
      )}

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Calendar" />
        <Tab label="Timeline" />
        <Tab label="Manage" />
        <Tab label="Insights" />
      </Tabs>

      {tab === 0 && <CalendarView />}
      {tab === 1 && <TimelineView onMarkPaid={handleMarkPaid} />}
      {tab === 2 && <RecurringList environment={environment} />}
      {tab === 3 && <InsightsView />}

      <Dialog open={!!payDialog} onClose={() => { setPayDialog(null); setPayError(''); }} maxWidth="xs" fullWidth>
        <DialogTitle>Mark "{payDialog?.occurrence.name}" as paid</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 2 }}>
            If this recurring expense auto-creates bills, pick which bank account it was paid from. If not, this just marks it paid without touching the ledger.
          </Typography>
          <TextField fullWidth select label="Bank account (if applicable)" value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)}>
            {bankAccounts.map((b) => <MenuItem key={b.id} value={b.id}>{b.account_name}</MenuItem>)}
          </TextField>
          {payError && <Alert severity="error" sx={{ mt: 2 }}>{payError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setPayDialog(null); setPayError(''); }}>Cancel</Button>
          <Button variant="contained" onClick={confirmMarkPaid}>Confirm paid</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}