import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody, TextField, Grid, Divider, MenuItem, Button, Alert, Chip, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import client from '../api/client';
import Money from '../components/Money';
import PlatformSyncLog from './PlatformSyncLog';

function monthStartEnd() {
  const now = new Date();
  return {
    from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  };
}

function TrialBalance() {
  const [report, setReport] = useState(null);
  useEffect(() => { client.get('/accounting/reports/trial-balance').then(({ data }) => setReport(data)); }, []);
  if (!report) return null;
  return (
    <Paper>
      <Table>
        <TableHead>
          <TableRow><TableCell>Code</TableCell><TableCell>Account</TableCell><TableCell align="right">Debit</TableCell><TableCell align="right">Credit</TableCell></TableRow>
        </TableHead>
        <TableBody>
          {report.lines.map((l) => (
            <TableRow key={l.code}>
              <TableCell className="figure">{l.code}</TableCell>
              <TableCell>{l.name}</TableCell>
              <TableCell align="right">{l.debit > 0 ? <Money amount={l.debit} /> : '—'}</TableCell>
              <TableCell align="right">{l.credit > 0 ? <Money amount={l.credit} /> : '—'}</TableCell>
            </TableRow>
          ))}
          <TableRow sx={{ '& td': { fontWeight: 700, borderTop: '2px solid', borderColor: 'divider' } }}>
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell align="right"><Money amount={report.totalDebit} /></TableCell>
            <TableCell align="right"><Money amount={report.totalCredit} /></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Paper>
  );
}

function ProfitAndLoss() {
  const [range, setRange] = useState(monthStartEnd());
  const [report, setReport] = useState(null);
  useEffect(() => {
    client.get('/accounting/reports/profit-and-loss', { params: range }).then(({ data }) => setReport(data));
  }, [range]);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
        <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
      </Box>
      {report && (
        <Paper sx={{ p: 3, maxWidth: 640 }}>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>Income</Typography>
          {report.income.map((a) => (
            <Box key={a.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>{a.name}</Typography>
              <Money amount={a.amount} />
            </Box>
          ))}
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography sx={{ fontWeight: 600 }}>Total income</Typography>
            <Money amount={report.totalIncome} size="1rem" />
          </Box>

          <Typography sx={{ fontWeight: 600, mb: 1 }}>Expenses</Typography>
          {report.expenses.map((a) => (
            <Box key={a.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>{a.name}</Typography>
              <Money amount={a.amount} />
            </Box>
          ))}
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontWeight: 600 }}>Total expenses</Typography>
            <Money amount={report.totalExpense} size="1rem" />
          </Box>

          <Divider sx={{ my: 1.5, borderColor: 'primary.main', borderBottomWidth: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 700 }}>Net profit</Typography>
            <Money amount={report.netProfit} size="1.15rem" color={report.netProfit >= 0 ? 'primary.main' : 'error.main'} />
          </Box>
        </Paper>
      )}
    </Box>
  );
}

function BalanceSheet() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState(null);
  useEffect(() => { client.get('/accounting/reports/balance-sheet', { params: { as_of: asOf } }).then(({ data }) => setReport(data)); }, [asOf]);

  return (
    <Box>
      <TextField size="small" type="date" label="As of" InputLabelProps={{ shrink: true }} value={asOf} onChange={(e) => setAsOf(e.target.value)} sx={{ mb: 2.5 }} />
      {report && (
        <Grid container spacing={2.5}>
          {[['Assets', report.assets, report.totalAssets], ['Liabilities', report.liabilities, report.totalLiabilities], ['Equity', report.equity, report.totalEquity]].map(([label, rows, total]) => (
            <Grid item xs={12} md={4} key={label}>
              <Paper sx={{ p: 2.5 }}>
                <Typography sx={{ fontWeight: 600, mb: 1.5 }}>{label}</Typography>
                {rows.map((a) => (
                  <Box key={a.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{a.name}</Typography>
                    <Money amount={a.amount} size="0.85rem" />
                  </Box>
                ))}
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontWeight: 600 }}>Total</Typography>
                  <Money amount={total} />
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function PlatformSync() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  const loadHistory = () => client.get('/platform-sync/history').then(({ data }) => setHistory(data.runs)).catch(() => {});

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    setError(null);
    setResult(null);
    setLoadingPreview(true);
    client.get('/platform-sync/preview', { params: { month, year } })
      .then(({ data }) => setPreview(data))
      .catch((e) => setError(e.response?.data?.error || 'Could not reach the platform API'))
      .finally(() => setLoadingPreview(false));
  }, [month, year]);

  const runSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const { data } = await client.post('/platform-sync/run', { month, year });
      setResult(data);
      // Refresh preview + history — the just-synced records now show as already-synced.
      const { data: p } = await client.get('/platform-sync/preview', { params: { month, year } });
      setPreview(p);
      loadHistory();
    } catch (e) {
      setError(e.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Typography sx={{ color: 'text.secondary', mb: 2.5, fontSize: '0.875rem' }}>
        Pulls subscription and trade-fee revenue from the EtherTrack platform (read-only) and posts it
        into this ledger — Platform Settlement Account debited, Subscription/Trade Fee Revenue and
        GST payable credited. Safe to click more than once: anything already synced is skipped automatically.
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2.5 }}>
        <TextField select size="small" label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))} sx={{ minWidth: 160 }}>
          {MONTHS.map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 120 }}>
          {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
        </TextField>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}

      {loadingPreview && <CircularProgress size={22} />}

      {!loadingPreview && preview && (
        <Paper sx={{ p: 2.5, mb: 2.5, maxWidth: 720 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography sx={{ fontWeight: 600 }}>{MONTHS[month - 1]} {year}</Typography>
            <Chip size="small" label={`${preview.newRecords} new · ${preview.alreadySynced} already synced`} color={preview.newRecords > 0 ? 'primary' : 'default'} variant="outlined" />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>Subscriptions</Typography>
            <Money amount={preview.bySource?.subscription || 0} size="0.85rem" />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>Trade fees</Typography>
            <Money amount={preview.bySource?.trade_fee || 0} size="0.85rem" />
          </Box>
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontWeight: 600 }}>Total to import</Typography>
            <Money amount={preview.totalNewAmount} />
          </Box>
          <Button
            variant="contained"
            startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncOutlinedIcon />}
            disabled={syncing || preview.newRecords === 0}
            onClick={runSync}
          >
            {preview.newRecords === 0 ? 'Nothing new to sync' : `Sync ${preview.newRecords} record${preview.newRecords === 1 ? '' : 's'}`}
          </Button>
        </Paper>
      )}

      {result && (
        <Alert severity="success" sx={{ mb: 2.5 }}>
          Posted {result.synced} journal {result.synced === 1 ? 'entry' : 'entries'} totalling{' '}
          <Money amount={result.totalAmount} size="0.85rem" /> · {result.skipped} skipped (already synced)
          {result.failed > 0 ? ` · ${result.failed} failed` : ''}.
        </Alert>
      )}

      {history.length > 0 && (
        <>
          <Typography sx={{ fontWeight: 600, mb: 1.5, mt: 3 }}>Sync history</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Period</TableCell>
                <TableCell align="right">Synced</TableCell>
                <TableCell align="right">Skipped</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>By</TableCell>
                <TableCell>When</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{MONTHS[r.period_month - 1]} {r.period_year}</TableCell>
                  <TableCell align="right">{r.records_synced}</TableCell>
                  <TableCell align="right">{r.records_skipped}</TableCell>
                  <TableCell align="right"><Money amount={r.total_amount_inr} size="0.8rem" /></TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{r.run_by_email || '—'}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{new Date(r.run_at).toLocaleString('en-IN')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      <Divider sx={{ my: 4 }} />
      <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Synced records</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 2 }}>
        Every individually posted record for a period. If something was imported by mistake, void it
        here — this posts a reversing entry, it never deletes anything.
      </Typography>
      <PlatformSyncLog />
    </Box>
  );
}

// ── Growth: revenue trend + mix, and a GST filing summary ──────────────────
// Pure ledger data, no guessed numbers — subscriptions vs trade fees off
// accounts 4100/4110, GST off 2210/2220/2230. If a period includes a voided
// (reversed) record, it nets out automatically since the reversal is just
// another journal entry in the same accounts.
function MrrCard() {
  const [mrr, setMrr] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    client.get('/platform-sync/mrr')
      .then(({ data }) => setMrr(data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load MRR'));
  }, []);

  if (error) return <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>;
  if (!mrr) return null;

  const planLabels = { starter: 'Starter', growth: 'Growth', corporate: 'Corporate' };

  return (
    <Paper sx={{ p: 2.5, mb: 3 }}>
      <Grid container spacing={3} sx={{ mb: mrr.note ? 2.5 : 0 }}>
        <Grid item xs={6} sm={3}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>MRR</Typography>
          <Money amount={mrr.mrr} size="1.3rem" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>ARR</Typography>
          <Money amount={mrr.arr} size="1.3rem" />
        </Grid>
        {Object.entries(mrr.byPlan || {}).map(([plan, amount]) => (
          <Grid item xs={6} sm={3} key={plan}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{planLabels[plan] || plan} MRR</Typography>
            <Money amount={amount} size="1.05rem" />
          </Grid>
        ))}
      </Grid>

      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: mrr.note ? 1.5 : 0 }}>
        {mrr.activeSubscribers} active paid subscriber{mrr.activeSubscribers === 1 ? '' : 's'} — includes Corporate at real contract value.
      </Typography>
      {mrr.note && <Alert severity="warning">{mrr.note}</Alert>}
    </Paper>
  );
}

function RevenueGrowth() {
  const [months, setMonths] = useState(12);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const [gstRange, setGstRange] = useState(monthStartEnd());
  const [gst, setGst] = useState(null);
  const [gstError, setGstError] = useState(null);

  useEffect(() => {
    setError(null);
    client.get('/accounting/reports/revenue-growth', { params: { months } })
      .then(({ data }) => setData(data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load revenue trend'));
  }, [months]);

  useEffect(() => {
    setGstError(null);
    client.get('/accounting/reports/gst-summary', { params: gstRange })
      .then(({ data }) => setGst(data))
      .catch((e) => setGstError(e.response?.data?.error || 'Failed to load GST summary'));
  }, [gstRange]);

  const maxMonthTotal = data ? Math.max(...data.months.map((m) => m.totalRevenue), 1) : 1;

  return (
    <Box sx={{ maxWidth: 900 }}>
      <MrrCard />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontWeight: 600 }}>Revenue trend</Typography>
        <TextField select size="small" label="Range" value={months} onChange={(e) => setMonths(Number(e.target.value))} sx={{ minWidth: 140 }}>
          <MenuItem value={6}>Last 6 months</MenuItem>
          <MenuItem value={12}>Last 12 months</MenuItem>
          <MenuItem value={24}>Last 24 months</MenuItem>
        </TextField>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}

      {data && (
        <Paper sx={{ p: 2.5, mb: 3 }}>
          {data.momGrowthPercent !== null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              {data.momGrowthPercent >= 0
                ? <TrendingUpIcon fontSize="small" color="success" />
                : <TrendingDownIcon fontSize="small" color="error" />}
              <Typography sx={{ fontSize: '0.85rem' }}>
                <strong>{data.momGrowthPercent >= 0 ? '+' : ''}{data.momGrowthPercent}%</strong> month-over-month
              </Typography>
            </Box>
          )}

          {data.months.map((m) => (
            <Box key={m.month} sx={{ mb: 1.75 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{m.month}</Typography>
                <Money amount={m.totalRevenue} size="0.8rem" />
              </Box>
              <Box sx={{ display: 'flex', height: 10, borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover' }}>
                <Box sx={{
                  width: `${(m.subscriptionRevenue / maxMonthTotal) * 100}%`,
                  bgcolor: 'primary.main', transition: 'width 0.3s',
                }} />
                <Box sx={{
                  width: `${(m.tradeFeeRevenue / maxMonthTotal) * 100}%`,
                  bgcolor: 'secondary.main', transition: 'width 0.3s',
                }} />
              </Box>
            </Box>
          ))}

          <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: 'primary.main' }} />
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Subscriptions</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: 'secondary.main' }} />
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Trade fees</Typography>
            </Box>
          </Box>
        </Paper>
      )}

      <Typography sx={{ fontWeight: 600, mb: 2 }}>GST filing summary</Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
        <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={gstRange.from} onChange={(e) => setGstRange({ ...gstRange, from: e.target.value })} />
        <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={gstRange.to} onChange={(e) => setGstRange({ ...gstRange, to: e.target.value })} />
      </Box>
      {gstError && <Alert severity="error" sx={{ mb: 2.5 }}>{gstError}</Alert>}
      {gst && (
        <Paper sx={{ p: 2.5, maxWidth: 420 }}>
          {[['CGST', gst.cgst], ['SGST', gst.sgst], ['IGST', gst.igst]].map(([label, val]) => (
            <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>{label} output payable</Typography>
              <Money amount={val} size="0.85rem" />
            </Box>
          ))}
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 600 }}>Total</Typography>
            <Money amount={gst.total} size="1.05rem" />
          </Box>
        </Paper>
      )}
    </Box>
  );
}

function FiscalYearClose() {
  const [periods, setPeriods] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ label: '', start_date: '', end_date: '' });
  const [error, setError] = useState('');
  const [previewFor, setPreviewFor] = useState(null); // period being previewed/closed
  const [preview, setPreview] = useState(null);
  const [closing, setClosing] = useState(false);

  const load = () => client.get('/accounting/fiscal-periods').then(({ data }) => setPeriods(data.fiscalPeriods)).catch(() => setPeriods([]));
  useEffect(() => { load(); }, []);

  const createPeriod = async () => {
    setError('');
    try {
      await client.post('/accounting/fiscal-periods', form);
      setCreateOpen(false);
      setForm({ label: '', start_date: '', end_date: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create period');
    }
  };

  const openPreview = async (period) => {
    setPreviewFor(period);
    setPreview(null);
    const { data } = await client.get(`/accounting/fiscal-periods/${period.id}/close-preview`);
    setPreview(data.preview);
  };

  const confirmClose = async () => {
    setClosing(true);
    setError('');
    try {
      await client.post(`/accounting/fiscal-periods/${previewFor.id}/close`);
      setPreviewFor(null);
      setPreview(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to close period');
    } finally {
      setClosing(false);
    }
  };

  const reopen = async (period) => {
    if (!window.confirm(`Reopen "${period.label}"? This does not undo the closing journal entry — use Reverse on that entry separately if it was posted in error.`)) return;
    await client.post(`/accounting/fiscal-periods/${period.id}/reopen`);
    load();
  };

  return (
    <Box>
      <Alert severity="warning" sx={{ mb: 2.5 }}>
        Closing a period posts a real journal entry that zeroes every income/expense account's
        balance for that period and rolls net profit (or loss) into Retained Earnings. It also
        locks the period — no new or edited entries can be dated inside it afterwards. Always
        check the preview before confirming.
      </Alert>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>New fiscal period</Button>
      </Box>

      <Paper>
        <Table>
          <TableHead>
            <TableRow><TableCell>Period</TableCell><TableCell>Dates</TableCell><TableCell>Status</TableCell><TableCell align="right"></TableCell></TableRow>
          </TableHead>
          <TableBody>
            {periods.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.label}</TableCell>
                <TableCell className="figure">{p.start_date?.slice(0, 10)} → {p.end_date?.slice(0, 10)}</TableCell>
                <TableCell>
                  <Chip size="small" label={p.is_closed ? 'Closed' : 'Open'} color={p.is_closed ? 'default' : 'success'} />
                </TableCell>
                <TableCell align="right">
                  {p.is_closed
                    ? <Button size="small" color="warning" onClick={() => reopen(p)}>Reopen</Button>
                    : <Button size="small" variant="outlined" onClick={() => openPreview(p)}>Preview & close</Button>}
                </TableCell>
              </TableRow>
            ))}
            {!periods.length && <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No fiscal periods yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New fiscal period</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Label" placeholder="e.g. FY2025-26" margin="normal" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <TextField fullWidth type="date" label="Start date" InputLabelProps={{ shrink: true }} margin="normal" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <TextField fullWidth type="date" label="End date" InputLabelProps={{ shrink: true }} margin="normal" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createPeriod} disabled={!form.label || !form.start_date || !form.end_date}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(previewFor)} onClose={() => setPreviewFor(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Close {previewFor?.label}?</DialogTitle>
        <DialogContent>
          {!preview ? <CircularProgress size={24} /> : (
            <>
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 1.5 }}>
                This is exactly what will be posted — nothing happens until you click Confirm below.
              </Typography>
              {preview.income.map((a) => (
                <Box key={a.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}>
                  <Typography sx={{ fontSize: '0.85rem' }}>{a.name} (zero out)</Typography>
                  <Typography sx={{ fontSize: '0.85rem' }} className="figure">Dr <Money amount={a.amount} /></Typography>
                </Box>
              ))}
              {preview.expenses.map((a) => (
                <Box key={a.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}>
                  <Typography sx={{ fontSize: '0.85rem' }}>{a.name} (zero out)</Typography>
                  <Typography sx={{ fontSize: '0.85rem' }} className="figure">Cr <Money amount={a.amount} /></Typography>
                </Box>
              ))}
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 600 }}>Net {preview.netProfit >= 0 ? 'profit' : 'loss'} → Retained Earnings</Typography>
                <Typography sx={{ fontWeight: 600 }} className="figure">
                  {preview.netProfit >= 0 ? 'Cr' : 'Dr'} <Money amount={Math.abs(preview.netProfit)} />
                </Typography>
              </Box>
              {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewFor(null)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={confirmClose} disabled={!preview || closing}>
            {closing ? 'Closing…' : 'Confirm close'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function Accounting() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>Accounting</Typography>
      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Trial Balance" />
        <Tab label="Profit & Loss" />
        <Tab label="Balance Sheet" />
        <Tab label="Platform Sync" />
        <Tab label="Growth" />
        <Tab label="Year-End Close" />
      </Tabs>
      {tab === 0 && <TrialBalance />}
      {tab === 1 && <ProfitAndLoss />}
      {tab === 2 && <BalanceSheet />}
      {tab === 3 && <PlatformSync />}
      {tab === 4 && <RevenueGrowth />}
      {tab === 5 && <FiscalYearClose />}
    </Box>
  );
}