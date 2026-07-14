import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Tabs, Tab, IconButton, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Alert, Table, TableHead, TableRow, TableCell,
  TableBody, Switch, Tooltip,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import Money from '../components/Money';
import StatusChip from '../components/StatusChip';

const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly', 'custom_days'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'SGD'];
const emptyForm = { name: '', category_id: '', amount: '', currency: 'INR', frequency: 'monthly', custom_interval_days: '', start_date: new Date().toISOString().slice(0, 10), end_date: '', reminder_days_before: 3, auto_create_bill: false, notes: '' };

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
  const load = () => client.get('/expenses/timeline').then(({ data }) => setOccurrences(data.occurrences));
  useEffect(() => { load(); }, []);

  return (
    <Paper>
      <Table>
        <TableHead>
          <TableRow><TableCell>Date</TableCell><TableCell>Expense</TableCell><TableCell>Frequency</TableCell><TableCell align="right">Amount</TableCell><TableCell>Status</TableCell><TableCell align="right">Action</TableCell></TableRow>
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
              <TableCell><StatusChip status={o.status} /></TableCell>
              <TableCell align="right">
                {['upcoming', 'due', 'overdue'].includes(o.status) && (
                  <Button size="small" onClick={() => onMarkPaid(o, load)}>Mark paid</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {!occurrences.length && <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>Nothing in the next 90 days or last 30 days.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Paper>
  );
}

function RecurringList({ onMarkPaid }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => client.get('/expenses/recurring').then(({ data }) => setItems(data.recurringExpenses));
  useEffect(() => {
    load();
    client.get('/accounting/expense-categories').then(({ data }) => setCategories(data.categories)).catch(() => {});
  }, []);

  const toggle = async (id) => { await client.post(`/expenses/recurring/${id}/toggle`); load(); };

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post('/expenses/recurring', form);
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>New recurring expense</Button>
      </Box>
      <Paper>
        <Table>
          <TableHead>
            <TableRow><TableCell>Name</TableCell><TableCell>Frequency</TableCell><TableCell align="right">Amount</TableCell><TableCell>Next due</TableCell><TableCell align="right">Active</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>{r.frequency.replace('_', ' ')}</TableCell>
                <TableCell align="right">
                  {r.currency !== 'INR' ? (
                    <>
                      <Typography sx={{ fontSize: '0.8rem' }} className="figure">{r.currency} {Number(r.amount).toLocaleString()}</Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>≈ converted to INR at due date</Typography>
                    </>
                  ) : <Money amount={r.amount} />}
                </TableCell>
                <TableCell className="figure">{r.next_due_date?.slice(0, 10)}</TableCell>
                <TableCell align="right"><Switch checked={r.is_active} onChange={() => toggle(r.id)} size="small" /></TableCell>
              </TableRow>
            ))}
            {!items.length && <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No recurring expenses set up yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New recurring expense</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField fullWidth label="Name (e.g. AWS, Figma, Office rent)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Grid>
            <Grid item xs={4}><TextField fullWidth type="number" label="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Grid>
            <Grid item xs={2}>
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
              <TextField fullWidth select label="Category (optional)" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <MenuItem value="">None</MenuItem>
                {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
            </Grid>
            {form.frequency === 'custom_days' && (
              <Grid item xs={6}><TextField fullWidth type="number" label="Repeat every N days" value={form.custom_interval_days} onChange={(e) => setForm({ ...form, custom_interval_days: e.target.value })} /></Grid>
            )}
            <Grid item xs={6}><TextField fullWidth type="date" label="Start date" InputLabelProps={{ shrink: true }} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="date" label="End date (optional)" InputLabelProps={{ shrink: true }} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Remind me N days before" value={form.reminder_days_before} onChange={(e) => setForm({ ...form, reminder_days_before: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Grid>
          </Grid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !form.name || !form.amount}>{saving ? 'Creating…' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
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

  useEffect(() => {
    client.get('/expenses/fy-summary').then(({ data }) => setFySummary(data));
    client.get('/accounting/bank-accounts').then(({ data }) => setBankAccounts(data.bankAccounts)).catch(() => {});
  }, []);

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

  const confirmMarkPaid = async () => {
    await client.post(`/expenses/occurrences/${payDialog.occurrence.id}/mark-paid`, selectedBank ? { bank_account_id: selectedBank } : {});
    payDialog.reload();
    setPayDialog(null);
    setSelectedBank('');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Recurring Expenses</Typography>
        <Button variant="outlined" onClick={runDailyCheck} disabled={checking}>{checking ? 'Checking…' : 'Run daily check'}</Button>
      </Box>

      {checkResult && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setCheckResult(null)}>{checkResult}</Alert>}

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
      </Tabs>

      {tab === 0 && <CalendarView />}
      {tab === 1 && <TimelineView onMarkPaid={handleMarkPaid} />}
      {tab === 2 && <RecurringList onMarkPaid={handleMarkPaid} />}

      <Dialog open={!!payDialog} onClose={() => setPayDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Mark "{payDialog?.occurrence.name}" as paid</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 2 }}>
            If this recurring expense auto-creates bills, pick which bank account it was paid from. If not, this just marks it paid without touching the ledger.
          </Typography>
          <TextField fullWidth select label="Bank account (if applicable)" value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)}>
            {bankAccounts.map((b) => <MenuItem key={b.id} value={b.id}>{b.account_name}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmMarkPaid}>Confirm paid</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}