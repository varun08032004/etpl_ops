import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Grid,
  Divider,
  MenuItem,
  Button,
  Alert,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import client from '../api/client';
import Money from '../components/Money';
import PlatformSyncLog from './PlatformSyncLog';
import GSTCollectedReport from './GSTCollectedReport';
import GSTLiabilityReport from './GSTLiabilityReport';
import PlatformSettlementReport from './PlatformSettlementReport';
import {
  MobilePaper,
  MobilePageHeader,
  MobileFormGrid,
  MobileActionButtons,
  MobileDialog,
  ResponsiveTableContainer,
  MobileCardGrid,
  MobileStack,
  MobileButton,
  MobileTextField,
  useMobile,
} from '../components/MobileResponsive';
import { refreshEvents, REFRESH_EVENTS } from '../utils/refreshEvents';

function monthStartEnd() {
  const now = new Date();
  return {
    from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  };
}

function TrialBalance() {
  const isMobile = useMobile();
  const [report, setReport] = useState(null);
  useEffect(() => { client.get('/accounting/reports/trial-balance').then(({ data }) => setReport(data)); }, []);
  if (!report) return <CircularProgress size={22} />;
  return (
    <MobilePaper>
      <ResponsiveTableContainer>
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>Code</TableCell><TableCell>Account</TableCell><TableCell align="right">Debit</TableCell><TableCell align="right">Credit</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {report.lines.map((l) => (
              <TableRow key={l.code}>
                <TableCell className="figure" sx={{ fontSize: isMobile ? '0.7rem' : '0.85rem' }}>{l.code}</TableCell>
                <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{l.name}</TableCell>
                <TableCell align="right">{l.debit > 0 ? <Money amount={l.debit} size={isMobile ? '0.75rem' : '0.875rem'} /> : '—'}</TableCell>
                <TableCell align="right">{l.credit > 0 ? <Money amount={l.credit} size={isMobile ? '0.75rem' : '0.875rem'} /> : '—'}</TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ '& td': { fontWeight: 700, borderTop: '2px solid', borderColor: 'divider' } }}>
              <TableCell colSpan={2}>Total</TableCell>
              <TableCell align="right"><Money amount={report.totalDebit} size={isMobile ? '0.75rem' : '0.875rem'} /></TableCell>
              <TableCell align="right"><Money amount={report.totalCredit} size={isMobile ? '0.75rem' : '0.875rem'} /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </ResponsiveTableContainer>
    </MobilePaper>
  );
}

function ProfitAndLoss() {
  const isMobile = useMobile();
  const [range, setRange] = useState(monthStartEnd());
  const [report, setReport] = useState(null);
  useEffect(() => {
    client.get('/accounting/reports/profit-and-loss', { params: range }).then(({ data }) => setReport(data));
  }, [range]);

  return (
    <Box>
      <MobileFormGrid sx={{ mb: 2 }}>
        <MobileTextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <MobileTextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
      </MobileFormGrid>
      {report && (
        <MobilePaper sx={{ maxWidth: isMobile ? '100%' : 640 }}>
          <Typography sx={{ fontWeight: 600, mb: 1, fontSize: isMobile ? '0.85rem' : '1rem' }}>Income</Typography>
          {report.income.map((a) => (
            <Box key={a.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem', color: 'text.secondary' }}>{a.name}</Typography>
              <Money amount={a.amount} size={isMobile ? '0.75rem' : '0.875rem'} />
            </Box>
          ))}
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.85rem' : '1rem' }}>Total income</Typography>
            <Money amount={report.totalIncome} size={isMobile ? '0.85rem' : '1rem'} />
          </Box>

          <Typography sx={{ fontWeight: 600, mb: 1, fontSize: isMobile ? '0.85rem' : '1rem' }}>Expenses</Typography>
          {report.expenses.map((a) => (
            <Box key={a.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem', color: 'text.secondary' }}>{a.name}</Typography>
              <Money amount={a.amount} size={isMobile ? '0.75rem' : '0.875rem'} />
            </Box>
          ))}
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.85rem' : '1rem' }}>Total expenses</Typography>
            <Money amount={report.totalExpense} size={isMobile ? '0.85rem' : '1rem'} />
          </Box>

          <Divider sx={{ my: 1.5, borderColor: 'primary.main', borderBottomWidth: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 700, fontSize: isMobile ? '0.9rem' : '1rem' }}>Net profit</Typography>
            <Money amount={report.netProfit} size={isMobile ? '0.9rem' : '1.15rem'} color={report.netProfit >= 0 ? 'primary.main' : 'error.main'} />
          </Box>
        </MobilePaper>
      )}
    </Box>
  );
}

function BalanceSheet() {
  const isMobile = useMobile();
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState(null);
  useEffect(() => { client.get('/accounting/reports/balance-sheet', { params: { as_of: asOf } }).then(({ data }) => setReport(data)); }, [asOf]);

  return (
    <Box>
      <MobileTextField size="small" type="date" label="As of" InputLabelProps={{ shrink: true }} value={asOf} onChange={(e) => setAsOf(e.target.value)} sx={{ mb: 2 }} />
      {report && (
        <MobileCardGrid>
          {[['Assets', report.assets, report.totalAssets], ['Liabilities', report.liabilities, report.totalLiabilities], ['Equity', report.equity, report.totalEquity]].map(([label, rows, total]) => (
            <MobilePaper key={label}>
              <Typography sx={{ fontWeight: 600, mb: 1.5, fontSize: isMobile ? '0.85rem' : '1rem' }}>{label}</Typography>
              {rows.map((a) => (
                <Box key={a.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary' }}>{a.name}</Typography>
                  <Money amount={a.amount} size={isMobile ? '0.7rem' : '0.85rem'} />
                </Box>
              ))}
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.85rem' : '1rem' }}>Total</Typography>
                <Money amount={total} size={isMobile ? '0.85rem' : '1rem'} />
              </Box>
            </MobilePaper>
          ))}
        </MobileCardGrid>
      )}
    </Box>
  );
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function PlatformSync() {
  const isMobile = useMobile();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [lastSync, setLastSync] = useState(null);

  const loadHistory = () => client.get('/platform-sync/history').then(({ data }) => setHistory(data.runs)).catch(() => {});

  const loadLatestSync = useCallback(() => {
    client.get('/platform-sync/latest', { params: { month, year } })
      .then(({ data }) => {
        if (data.run) {
          setLastSync({
            date: data.run.run_at,
            recordsSynced: data.run.records_synced,
            totalAmount: data.run.total_amount_inr,
            runBy: data.run.run_by_email,
          });
        } else {
          setLastSync(null);
        }
      })
      .catch(() => setLastSync(null));
  }, [month, year]);

  useEffect(() => {
    loadHistory();
    loadLatestSync();
  }, [loadHistory, loadLatestSync]);

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
      const idempotencyKey = `sync-${month}-${year}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const { data } = await client.post('/platform-sync/run', { month, year }, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });
      setResult(data);
      const { data: p } = await client.get('/platform-sync/preview', { params: { month, year } });
      setPreview(p);
      loadHistory();
      loadLatestSync();
      refreshEvents.emit(REFRESH_EVENTS.SYNC_COMPLETE, { month, year, ...data });
      refreshEvents.emit(REFRESH_EVENTS.REVENUE_UPDATED, { month, year, ...data });
    } catch (e) {
      setError(e.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const formatDateTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
           d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box sx={{ maxWidth: isMobile ? '100%' : 900 }}>
      <Typography sx={{ color: 'text.secondary', mb: 2, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
        Pulls subscription and trade-fee revenue from the EtherTrack platform and posts it into this ledger.
        Safe to click more than once: anything already synced is skipped automatically.
      </Typography>

      {lastSync && (
        <Box sx={{ mb: 1.5, p: 1, borderRadius: 1, borderLeft: '3px solid', borderColor: 'success.main', bgcolor: 'success.50', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CheckCircleIcon fontSize="small" color="success.main" />
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Last synced
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {formatDateTime(lastSync.date)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <Typography variant="caption" color="text.secondary">Records:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                {lastSync.recordsSynced}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <Typography variant="caption" color="text.secondary">Revenue:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                <Money amount={lastSync.totalAmount} size="0.8rem" />
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <Typography variant="caption" color="text.secondary">By:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                {lastSync.runBy || '—'}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      <MobileFormGrid sx={{ mb: 2, alignItems: 'center' }}>
        <MobileTextField
          select
          size="small"
          label="Month"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
        />
        <MobileTextField
          select
          size="small"
          label="Year"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          options={years.map((y) => ({ value: y, label: String(y) }))}
        />
      </MobileFormGrid>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loadingPreview && <CircularProgress size={22} sx={{ my: 2 }} />}

      {!loadingPreview && preview && (
        <MobilePaper sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.85rem' : '1rem' }}>{MONTHS[month - 1]} {year}</Typography>
            <Chip size="small" label={`${preview.newRecords} new · ${preview.alreadySynced} already synced`} color={preview.newRecords > 0 ? 'primary' : 'default'} variant="outlined" />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
            <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: 'text.secondary' }}>Subscriptions</Typography>
            <Money amount={preview.bySource?.subscription || 0} size={isMobile ? '0.75rem' : '0.85rem'} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
            <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: 'text.secondary' }}>Trade fees</Typography>
            <Money amount={preview.bySource?.trade_fee || 0} size={isMobile ? '0.75rem' : '0.85rem'} />
          </Box>
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.85rem' : '1rem' }}>Total to import</Typography>
            <Money amount={preview.totalNewAmount} size={isMobile ? '0.85rem' : '1rem'} />
          </Box>
          <MobileActionButtons>
            <MobileButton
              variant="contained"
              startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncOutlinedIcon />}
              disabled={syncing || preview.newRecords === 0}
              onClick={runSync}
            >
              {preview.newRecords === 0 ? 'Nothing new to sync' : `Sync ${preview.newRecords} record${preview.newRecords === 1 ? '' : 's'}`}
            </MobileButton>
          </MobileActionButtons>
        </MobilePaper>
      )}

      {result && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Posted {result.synced} journal {result.synced === 1 ? 'entry' : 'entries'} totalling{' '}
          <Money amount={result.totalAmount} size="0.85rem" /> · {result.skipped} skipped (already synced)
          {result.failed > 0 ? ` · ${result.failed} failed` : ''}.
        </Alert>
      )}

      {history.length > 0 && (
        <>
          <Typography sx={{ fontWeight: 600, mb: 1.5, mt: 3, fontSize: isMobile ? '0.85rem' : '1rem' }}>Sync history</Typography>
          <MobilePaper>
            <ResponsiveTableContainer>
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
                      <TableCell align="right"><Money amount={r.total_amount_inr} size={isMobile ? '0.7rem' : '0.8rem'} /></TableCell>
                      <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary' }}>{r.run_by_email || '—'}</TableCell>
                      <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary' }}>{new Date(r.run_at).toLocaleString('en-IN')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </MobilePaper>
        </>
      )}

      <Divider sx={{ my: 3 }} />
      <Typography sx={{ fontWeight: 600, mb: 0.5, fontSize: isMobile ? '0.85rem' : '1rem' }}>Synced records</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: isMobile ? '0.7rem' : '0.8rem', mb: 2 }}>
        Every individually posted record for a period. If something was imported by mistake, void it here — this posts a reversing entry.
      </Typography>
      <PlatformSyncLog />
    </Box>
  );
}

const CATEGORY_OPTIONS = ['productive', 'unproductive', 'neutral', 'blocked'];
const CATEGORY_COLOR = { productive: 'success', unproductive: 'error', blocked: 'error', neutral: 'default' };

function MrrCard() {
  const isMobile = useMobile();
  const [mrr, setMrr] = useState(null);
  const [error, setError] = useState(null);

  const fetchMrr = useCallback(() => {
    client.get('/platform-sync/mrr')
      .then(({ data }) => setMrr(data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load MRR'));
  }, []);

  useEffect(() => {
    fetchMrr();
    const cleanup = refreshEvents.on(REFRESH_EVENTS.REVENUE_UPDATED, fetchMrr);
    return cleanup;
  }, [fetchMrr]);

  if (error) return <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>;
  if (!mrr) return null;

  const planLabels = { starter: 'Starter', growth: 'Growth', corporate: 'Corporate' };

  return (
    <MobilePaper sx={{ mb: 3 }}>
      <MobileCardGrid sx={{ mb: mrr.note ? 2 : 0 }}>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>MRR</Typography>
          <Money amount={mrr.mrr} size={isMobile ? '1.1rem' : '1.3rem'} />
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>ARR</Typography>
          <Money amount={mrr.arr} size={isMobile ? '1.1rem' : '1.3rem'} />
        </MobilePaper>
        {Object.entries(mrr.byPlan || {}).map(([plan, amount]) => (
          <MobilePaper key={plan}>
            <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>{planLabels[plan] || plan} MRR</Typography>
            <Money amount={amount} size={isMobile ? '0.9rem' : '1.05rem'} />
          </MobilePaper>
        ))}
      </MobileCardGrid>

      <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary', mb: mrr.note ? 1.5 : 0 }}>
        {mrr.activeSubscribers} active paid subscriber{mrr.activeSubscribers === 1 ? '' : 's'} — includes Corporate at real contract value.
      </Typography>
      {mrr.note && <Alert severity="warning">{mrr.note}</Alert>}
    </MobilePaper>
  );
}

function RevenueGrowth() {
  const isMobile = useMobile();
  const [months, setMonths] = useState(12);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [gstRange, setGstRange] = useState(monthStartEnd());
  const [gst, setGst] = useState(null);
  const [gstError, setGstError] = useState(null);

  const fetchRevenueGrowth = useCallback(() => {
    setError(null);
    client.get('/accounting/reports/revenue-growth', { params: { months } })
      .then(({ data }) => setData(data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load revenue trend'));
  }, [months]);

  const fetchGst = useCallback(() => {
    setGstError(null);
    client.get('/accounting/reports/gst-summary', { params: gstRange })
      .then(({ data }) => setGst(data))
      .catch((e) => setGstError(e.response?.data?.error || 'Failed to load GST summary'));
  }, [gstRange]);

  useEffect(() => {
    fetchRevenueGrowth();
    const cleanup = refreshEvents.on(REFRESH_EVENTS.REVENUE_UPDATED, fetchRevenueGrowth);
    return cleanup;
  }, [fetchRevenueGrowth]);

  useEffect(() => {
    fetchGst();
    const cleanup = refreshEvents.on(REFRESH_EVENTS.REVENUE_UPDATED, fetchGst);
    return cleanup;
  }, [fetchGst]);

  const maxMonthTotal = data ? Math.max(...data.months.map((m) => m.totalRevenue), 1) : 1;

  return (
    <Box sx={{ maxWidth: isMobile ? '100%' : 900 }}>
      <MrrCard />

      <MobileFormGrid sx={{ mb: 2, alignItems: 'center' }}>
        <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.85rem' : '1rem' }}>Revenue trend</Typography>
        <MobileTextField
          select
          size="small"
          label="Range"
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          options={[{ value: 6, label: 'Last 6 months' }, { value: 12, label: 'Last 12 months' }, { value: 24, label: 'Last 24 months' }]}
        />
      </MobileFormGrid>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {data && (
        <MobilePaper sx={{ mb: 3 }}>
          {data.momGrowthPercent !== null && (
            <MobileStack gap={1} sx={{ mb: 2.5 }}>
              {data.momGrowthPercent >= 0
                ? <TrendingUpIcon fontSize="small" color="success" />
                : <TrendingDownIcon fontSize="small" color="error" />}
              <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>
                <strong>{data.momGrowthPercent >= 0 ? '+' : ''}{data.momGrowthPercent}%</strong> month-over-month
              </Typography>
            </MobileStack>
          )}

          {data.months.map((m) => (
            <Box key={m.month} sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.78rem', color: 'text.secondary' }}>{m.month}</Typography>
                <Money amount={m.totalRevenue} size={isMobile ? '0.7rem' : '0.8rem'} />
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

          <MobileStack gap={3} sx={{ mt: 2 }}>
            <MobileStack gap={0.75}>
              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: 'primary.main' }} />
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Subscriptions</Typography>
            </MobileStack>
            <MobileStack gap={0.75}>
              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: 'secondary.main' }} />
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Trade fees</Typography>
            </MobileStack>
          </MobileStack>
        </MobilePaper>
      )}

      <Typography sx={{ fontWeight: 600, mb: 2, fontSize: isMobile ? '0.85rem' : '1rem' }}>GST filing summary</Typography>
      <MobileFormGrid sx={{ mb: 2, alignItems: 'center' }}>
        <MobileTextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={gstRange.from} onChange={(e) => setGstRange({ ...gstRange, from: e.target.value })} />
        <MobileTextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={gstRange.to} onChange={(e) => setGstRange({ ...gstRange, to: e.target.value })} />
      </MobileFormGrid>
      {gstError && <Alert severity="error" sx={{ mb: 2 }}>{gstError}</Alert>}
      {gst && (
        <MobilePaper sx={{ maxWidth: isMobile ? '100%' : 420 }}>
          {[['CGST', gst.cgst], ['SGST', gst.sgst], ['IGST', gst.igst]].map(([label, val]) => (
            <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
              <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: 'text.secondary' }}>{label} output payable</Typography>
              <Money amount={val} size={isMobile ? '0.75rem' : '0.85rem'} />
            </Box>
          ))}
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.85rem' : '1rem' }}>Total</Typography>
            <Money amount={gst.total} size={isMobile ? '0.9rem' : '1.05rem'} />
          </Box>
        </MobilePaper>
      )}
    </Box>
  );
}

function FiscalYearClose() {
  const isMobile = useMobile();
  const [periods, setPeriods] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ label: '', start_date: '', end_date: '' });
  const [error, setError] = useState('');
  const [previewFor, setPreviewFor] = useState(null);
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
    if (!window.confirm(`Reopen "${period.label}"? This does not undo the closing journal entry.`)) return;
    await client.post(`/accounting/fiscal-periods/${period.id}/reopen`);
    load();
  };

  return (
    <Box>
      <Alert severity="warning" sx={{ mb: 2 }}>
        Closing a period posts a journal entry that zeroes every income/expense account's balance and rolls net profit into Retained Earnings.
        It also locks the period — no new or edited entries can be dated inside it afterwards. Always check the preview before confirming.
      </Alert>

      <MobileStack gap={1} sx={{ mb: 2, justifyContent: 'flex-end' }}>
        <MobileButton variant="contained" size="small" onClick={() => setCreateOpen(true)}>New fiscal period</MobileButton>
      </MobileStack>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
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
                    <MobileStack gap={1} direction="row">
                      {p.is_closed
                        ? <MobileButton size="small" color="warning" onClick={() => reopen(p)}>Reopen</MobileButton>
                        : <MobileButton size="small" variant="outlined" onClick={() => openPreview(p)}>Preview & close</MobileButton>}
                    </MobileStack>
                  </TableCell>
                </TableRow>
              ))}
              {!periods.length && <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No fiscal periods yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New fiscal period</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField fullWidth label="Label" placeholder="e.g. FY2025-26" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            <MobileTextField fullWidth type="date" label="Start date" InputLabelProps={{ shrink: true }} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            <MobileTextField fullWidth type="date" label="End date" InputLabelProps={{ shrink: true }} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setCreateOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={createPeriod} disabled={!form.label || !form.start_date || !form.end_date}>Create</MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      <MobileDialog open={Boolean(previewFor)} onClose={() => setPreviewFor(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Close {previewFor?.label}?</DialogTitle>
        <DialogContent>
          {!preview ? <CircularProgress size={24} /> : (
            <>
              <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: 'text.secondary', mb: 1.5 }}>
                This is exactly what will be posted — nothing happens until you click Confirm below.
              </Typography>
              {preview.income.map((a) => (
                <Box key={a.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}>
                  <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{a.name} (zero out)</Typography>
                  <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }} className="figure">Dr <Money amount={a.amount} /></Typography>
                </Box>
              ))}
              {preview.expenses.map((a) => (
                <Box key={a.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}>
                  <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{a.name} (zero out)</Typography>
                  <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }} className="figure">Cr <Money amount={a.amount} /></Typography>
                </Box>
              ))}
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.85rem' : '1rem' }}>Net {preview.netProfit >= 0 ? 'profit' : 'loss'} → Retained Earnings</Typography>
                <Typography sx={{ fontWeight: 600 }} className="figure">
                  {preview.netProfit >= 0 ? 'Cr' : 'Dr'} <Money amount={Math.abs(preview.netProfit)} />
                </Typography>
              </Box>
              {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            </>
          )}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setPreviewFor(null)}>Cancel</MobileButton>
          <MobileButton variant="contained" color="warning" onClick={confirmClose} disabled={!preview || closing}>
            {closing ? 'Closing…' : 'Confirm close'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}

export default function Accounting() {
  const isMobile = useMobile();
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Accounting</Typography>
      </MobilePageHeader>
      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }} variant="scrollable" scrollButtons="auto">
        <Tab label="Trial Balance" />
        <Tab label="Profit & Loss" />
        <Tab label="Balance Sheet" />
        <Tab label="Platform Sync" />
        <Tab label="GST Collected" />
        <Tab label="GST Liability" />
        <Tab label="Platform Settlement" />
        <Tab label="Growth" />
        <Tab label="Year-End Close" />
      </Tabs>
      {tab === 0 && <TrialBalance />}
      {tab === 1 && <ProfitAndLoss />}
      {tab === 2 && <BalanceSheet />}
      {tab === 3 && <PlatformSync />}
      {tab === 4 && <GSTCollectedReport />}
      {tab === 5 && <GSTLiabilityReport />}
      {tab === 6 && <PlatformSettlementReport />}
      {tab === 7 && <RevenueGrowth />}
      {tab === 8 && <FiscalYearClose />}
    </Box>
  );
}