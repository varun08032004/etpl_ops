import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Grid, Alert, Chip, Divider, Tabs, Tab, Skeleton, Button, Tooltip,
  IconButton, TableContainer, TablePagination, TableSortLabel,
} from '@mui/material';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip as ChartTooltip, CartesianGrid, PieChart, Pie, Cell,
  AreaChart, Area, ReferenceLine,
} from 'recharts';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Info as InfoIcon,
  ShowChart as ShowChartIcon,
  AttachMoney as AttachMoneyIcon,
  People as PeopleIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import client from '../api/client';
import Money from '../components/Money';
import {
  MobilePaper,
  MobilePageHeader,
  MobileCardGrid,
  MobileStack,
  MobileChartContainer,
  useMobile,
} from '../components/MobileResponsive';

const PLAN_COLORS = { starter: '#5aa9e6', growth: '#2fbf71', corporate: '#e5a54b' };
const CHART_COLORS = ['#2fbf71', '#e5a54b', '#5aa9e6', '#e5484d', '#a78bfa', '#f472b6'];

function KpiCard({ label, value, sub, trend, icon, isMobile, loading }) {
  if (loading) {
    return (
      <MobilePaper>
        <Skeleton variant="text" width="60%" height={isMobile ? 14 : 16} />
        <Skeleton variant="circular" width={isMobile ? 28 : 32} height={isMobile ? 28 : 32} />
        <Skeleton variant="text" width="40%" height={isMobile ? 12 : 14} />
      </MobilePaper>
    );
  }
  return (
    <MobilePaper>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        {icon && <Box sx={{ color: 'primary.main', opacity: 0.7 }}>{icon}</Box>}
        <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', flex: 1 }}>{label}</Typography>
        {trend && <Chip size="small" label={trend} color={trend.startsWith('+') || trend.startsWith('▲') ? 'success' : 'error'} sx={{ fontSize: isMobile ? '0.6rem' : '0.65rem' }} />}
      </Box>
      <Typography className="figure" sx={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 600, mt: 0.5, lineHeight: 1.2 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary', mt: 0.5 }}>{sub}</Typography>}
    </MobilePaper>
  );
}

function formatCurrency(amount, isMobile) {
  if (!amount && amount !== 0) return '—';
  const n = Number(amount);
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatNumber(num, isMobile) {
  if (!num && num !== 0) return '—';
  if (num >= 1e5) return `${(num / 1e5).toFixed(1)}L`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

function TrendIndicator({ current, previous, isMobile }) {
  if (!previous || previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  const isPositive = change >= 0;
  return (
    <Chip
      size="small"
      label={`${isPositive ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}%`}
      color={isPositive ? 'success' : 'error'}
      icon={isPositive ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
      sx={{ fontSize: isMobile ? '0.6rem' : '0.65rem' }}
    />
  );
}

function LoadingCharts({ isMobile, count = 4 }) {
  return (
    <Grid container spacing={3}>
      {Array.from({ length: count }).map((_, i) => (
        <Grid key={i} item xs={12} sm={i < 2 ? 6 : 12} lg={i < 2 ? 6 : 4}>
          <MobilePaper>
            <Skeleton variant="text" width="40%" height={isMobile ? 14 : 16} />
            <Skeleton variant="rectangular" height={isMobile ? 240 : 300} />
          </MobilePaper>
        </Grid>
      ))}
    </Grid>
  );
}

export default function Analytics() {
  const isMobile = useMobile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);
  const [lastFetched, setLastFetched] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/analytics/unified');
      setData(res.data);
      setLastFetched(new Date());
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const mrr = data?.mrr;
  const mrrHistory = data?.mrrHistory || [];
  const churnCohorts = data?.churnCohorts || [];
  const expansion = data?.expansion;
  const unitEcon = data?.unitEconomics;

  // Compute previous period for trends
  const prevMrr = mrrHistory.length > 30 ? mrrHistory[mrrHistory.length - 31]?.mrr : null;
  const prevActive = mrrHistory.length > 30 ? mrrHistory[mrrHistory.length - 31]?.activeSubscriptions : null;

  // MRR trend data from history (last 12 months)
  const mrrTrendData = useMemo(() => {
    const monthly = {};
    mrrHistory.forEach(d => {
      const monthKey = d.date.slice(0, 7); // YYYY-MM
      if (!monthly[monthKey] || new Date(d.date) > new Date(monthly[monthKey].date)) {
        monthly[monthKey] = d;
      }
    });
    return Object.values(monthly)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12)
      .map(d => ({
        month: new Date(d.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        mrr: d.mrr,
        arr: d.arr,
        activeSubscriptions: d.activeSubscriptions,
      }));
  }, [mrrHistory]);

  const planBreakdown = mrr?.byPlan ? Object.entries(mrr.byPlan).map(([plan, value]) => ({
    plan: plan.charAt(0).toUpperCase() + plan.slice(1),
    value,
    color: PLAN_COLORS[plan] || '#888',
  })) : [];

  const expansionData = expansion ? [
    { type: 'New MRR', amount: expansion.newMrr, color: '#2fbf71' },
    { type: 'Expansion', amount: expansion.expansionMrr, color: '#5aa9e6' },
    { type: 'Contraction', amount: -expansion.contractionMrr, color: '#e5a54b' },
    { type: 'Churned', amount: -expansion.churnedMrr, color: '#e5484d' },
    { type: 'Reactivation', amount: expansion.reactivationMrr, color: '#a78bfa' },
  ] : [];

  // Format cohort month for display
  const formatCohortMonth = (cohortMonth) => {
    const [year, month] = cohortMonth.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  if (loading && !data) {
    return (
      <Box>
        <MobilePageHeader>
          <Skeleton variant="text" width="40%" height={isMobile ? 24 : 30} />
          <Skeleton variant="text" width="60%" height={isMobile ? 16 : 18} />
        </MobilePageHeader>
        <MobileCardGrid sx={{ mb: 3 }}>
          {[...Array(5)].map((_, i) => <KpiCard key={i} isMobile={isMobile} loading />)}
        </MobileCardGrid>
        <LoadingCharts isMobile={isMobile} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={
        <Button size="small" onClick={fetchData} startIcon={<RefreshIcon />}>Retry</Button>
      }>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <MobilePageHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ mb: 0 }}>Analytics Dashboard</Typography>
            <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: 'text.secondary', mt: 0.5 }}>
              Real-time subscription metrics from pre-computed daily snapshots
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {lastFetched && (
              <Tooltip title={`Last updated: ${lastFetched.toLocaleString()}`}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <ShowChartIcon fontSize="small" /> Updated {lastFetched.toLocaleTimeString()}
                </Typography>
              </Tooltip>
            )}
            <Button size="small" onClick={fetchData} startIcon={<RefreshIcon />}>Refresh</Button>
          </Box>
        </Box>
      </MobilePageHeader>

      {/* Tab Navigation */}
      <Paper sx={{ mb: 3, overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<ShowChartIcon />} label="Overview" sx={{ minWidth: isMobile ? 80 : 120 }} />
          <Tab icon={<AttachMoneyIcon />} label="MRR & Growth" sx={{ minWidth: isMobile ? 80 : 120 }} />
          <Tab icon={<PeopleIcon />} label="Churn & Retention" sx={{ minWidth: isMobile ? 80 : 120 }} />
          <Tab icon={<SpeedIcon />} label="Unit Economics" sx={{ minWidth: isMobile ? 80 : 120 }} />
        </Tabs>
      </Paper>

      {/* ───────────────── OVERVIEW TAB ───────────────── */}
      {tab === 0 && (
        <Box>
          <MobileCardGrid sx={{ mb: 3 }}>
            <KpiCard
              label="Monthly Recurring Revenue"
              value={formatCurrency(mrr?.mrr, isMobile)}
              sub={`ARR: ${formatCurrency(mrr?.arr, isMobile)}`}
              trend={prevMrr ? `${((mrr?.mrr - prevMrr) / prevMrr * 100).toFixed(1)}% vs 30d ago` : undefined}
              icon={<AttachMoneyIcon />}
              isMobile={isMobile}
              loading={loading}
            />
            <KpiCard
              label="Active Subscriptions"
              value={formatNumber(mrr?.activeSubscriptions, isMobile)}
              sub={`Corporate seats: ${formatNumber(mrr?.corporateSeats, isMobile)}`}
              trend={prevActive ? `${((mrr?.activeSubscriptions - prevActive) / prevActive * 100).toFixed(1)}% vs 30d ago` : undefined}
              icon={<PeopleIcon />}
              isMobile={isMobile}
              loading={loading}
            />
            <KpiCard
              label="Net New MRR (30d)"
              value={formatCurrency(expansion?.netNewMrr, isMobile)}
              sub={`New: ${formatCurrency(expansion?.newMrr, isMobile)} • Churn: ${formatCurrency(expansion?.churnedMrr, isMobile)}`}
              trend={expansion?.netNewMrr >= 0 ? `+${((expansion.netNewMrr / (mrr?.mrr || 1)) * 100).toFixed(1)}%` : `${((expansion.netNewMrr / (mrr?.mrr || 1)) * 100).toFixed(1)}%`}
              icon={<TrendingUpIcon />}
              isMobile={isMobile}
              loading={loading}
            />
            <KpiCard
              label="LTV / CAC"
              value={unitEcon?.ltv ? `₹${unitEcon.ltv.toLocaleString()}` : '—'}
              sub={`Payback: ${unitEcon?.paybackMonths || '—'} mo • LTV:CAC ${unitEcon?.ltvToCac || '—'}x`}
              icon={<SpeedIcon />}
              isMobile={isMobile}
              loading={loading}
            />
            <KpiCard
              label="Avg Revenue/User"
              value={formatCurrency(mrr?.avgRevenuePerUser, isMobile)}
              sub={`Corporate: ${mrr?.byPlan?.corporate || 0} • Growth: ${mrr?.byPlan?.growth || 0} • Starter: ${mrr?.byPlan?.starter || 0}`}
              icon={<AttachMoneyIcon />}
              isMobile={isMobile}
              loading={loading}
            />
          </MobileCardGrid>

          <Divider sx={{ mb: 3 }} />

          {/* MRR Trend + Plan Breakdown */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} lg={8}>
              <MobilePaper>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                  <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary' }}>MRR Trend (12 months)</Typography>
                  <Chip label="Real Data" size="small" color="primary" variant="outlined" sx={{ fontSize: '0.6rem' }} />
                </Box>
                <MobileChartContainer>
                  <Box sx={{ height: isMobile ? 240 : 300, minWidth: isMobile ? '320px' : '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mrrTrendData}>
                        <defs>
                          <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2fbf71" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#2fbf71" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#232c26" />
                        <XAxis dataKey="month" stroke="#8fa398" fontSize={isMobile ? 10 : 11} />
                        <YAxis stroke="#8fa398" fontSize={isMobile ? 10 : 11} tickFormatter={(v) => v >= 1e7 ? `₹${(v/1e7).toFixed(1)}Cr` : v >= 1e5 ? `₹${(v/1e5).toFixed(1)}L` : `₹${v}`} />
                        <ChartTooltip
                          contentStyle={{ background: '#121815', border: '1px solid #232c26', fontSize: isMobile ? 10 : 12 }}
                          formatter={(v, name) => [name === 'mrr' ? new Money({ amount: v }).toString() : formatNumber(v), name === 'mrr' ? 'MRR' : name === 'arr' ? 'ARR' : 'Active Subs']}
                        />
                        <Area type="monotone" dataKey="mrr" stroke="#2fbf71" fillOpacity={1} fill="url(#mrrGradient)" strokeWidth={2} name="MRR" />
                        <Area type="monotone" dataKey="arr" stroke="#5aa9e6" fillOpacity={0} strokeWidth={1.5} strokeDasharray="5 5" name="ARR" />
                        <ReferenceLine y={mrr?.mrr || 0} stroke="#e5a54b" strokeWidth={1} strokeDasharray="3 3" label={{ value: 'Current MRR', position: 'right', fill: '#e5a54b', fontSize: 10 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </MobileChartContainer>
              </MobilePaper>
            </Grid>

            <Grid item xs={12} lg={4}>
              <MobilePaper>
                <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>MRR by Plan</Typography>
                {planBreakdown.length > 0 ? (
                  <MobileChartContainer>
                    <Box sx={{ height: isMobile ? 240 : 300, minWidth: isMobile ? '280px' : '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={planBreakdown}
                            dataKey="value"
                            nameKey="plan"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={isMobile ? 70 : 90}
                            label={({ plan, value, percent }) => `${plan}: ${(percent * 100).toFixed(1)}%`}
                          >
                            {planBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <ChartTooltip contentStyle={{ background: '#121815', border: '1px solid #232c26', fontSize: isMobile ? 10 : 12 }} formatter={(v) => [new Money({ amount: v }).toString(), 'MRR']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </MobileChartContainer>
                ) : (
                  <Typography color="text.secondary">No plan data</Typography>
                )}
              </MobilePaper>
            </Grid>
          </Grid>

          {/* Expansion Waterfall + Key Metrics */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} lg={6}>
              <MobilePaper>
                <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Net New MRR Waterfall (30 days)</Typography>
                {expansionData.length > 0 ? (
                  <MobileChartContainer>
                    <Box sx={{ height: isMobile ? 240 : 300, minWidth: isMobile ? '320px' : '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={expansionData} layout={isMobile ? 'vertical' : 'horizontal'}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#232c26" />
                          <XAxis type="number" stroke="#8fa398" fontSize={isMobile ? 10 : 11} tickFormatter={(v) => new Money({ amount: v }).toString()} />
                          <YAxis type="category" dataKey="type" stroke="#8fa398" fontSize={isMobile ? 10 : 11} width={isMobile ? 80 : 100} />
                          <ChartTooltip contentStyle={{ background: '#121815', border: '1px solid #232c26', fontSize: isMobile ? 10 : 12 }} formatter={(v) => [new Money({ amount: v }).toString(), '']} />
                          <Bar dataKey="amount" fill="#2fbf71">
                            {expansionData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </MobileChartContainer>
                ) : (
                  <Typography color="text.secondary">No expansion data</Typography>
                )}
              </MobilePaper>
            </Grid>

            <Grid item xs={12} lg={6}>
              <MobilePaper>
                <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Quick Metrics</Typography>
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Metric</TableCell>
                        <TableCell align="right">Value</TableCell>
                        <TableCell align="right">30d Ago</TableCell>
                        <TableCell align="right">Change</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>MRR</TableCell>
                        <TableCell align="right">{formatCurrency(mrr?.mrr, isMobile)}</TableCell>
                        <TableCell align="right">{prevMrr ? formatCurrency(prevMrr, isMobile) : '—'}</TableCell>
                        <TableCell align="right"><TrendIndicator current={mrr?.mrr || 0} previous={prevMrr || 0} isMobile={isMobile} /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Active Subscriptions</TableCell>
                        <TableCell align="right">{formatNumber(mrr?.activeSubscriptions, isMobile)}</TableCell>
                        <TableCell align="right">{prevActive ? formatNumber(prevActive, isMobile) : '—'}</TableCell>
                        <TableCell align="right"><TrendIndicator current={mrr?.activeSubscriptions || 0} previous={prevActive || 0} isMobile={isMobile} /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>New MRR (30d)</TableCell>
                        <TableCell align="right">{formatCurrency(expansion?.newMrr, isMobile)}</TableCell>
                        <TableCell align="right">—</TableCell>
                        <TableCell align="right">—</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Churned MRR (30d)</TableCell>
                        <TableCell align="right">{formatCurrency(expansion?.churnedMrr, isMobile)}</TableCell>
                        <TableCell align="right">—</TableCell>
                        <TableCell align="right">—</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Gross MRR Churn Rate</TableCell>
                        <TableCell align="right">{expansion?.grossMrrChurnRate?.toFixed(1) || '—'}%</TableCell>
                        <TableCell align="right">—</TableCell>
                        <TableCell align="right">—</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>LTV:CAC Ratio</TableCell>
                        <TableCell align="right">{unitEcon?.ltvToCac ? unitEcon.ltvToCac.toFixed(1) + 'x' : '—'}</TableCell>
                        <TableCell align="right">—</TableCell>
                        <TableCell align="right">—</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </MobilePaper>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* ───────────────── MRR & GROWTH TAB ───────────────── */}
      {tab === 1 && (
        <Box>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} lg={8}>
              <MobilePaper>
                <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>MRR Trend — Daily (Last 90 Days)</Typography>
                <MobileChartContainer>
                  <Box sx={{ height: isMobile ? 300 : 350, minWidth: isMobile ? '320px' : '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mrrHistory.slice().reverse()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#232c26" />
                        <XAxis dataKey="date" stroke="#8fa398" fontSize={isMobile ? 10 : 11} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} interval="preserveStartEnd" />
                        <YAxis stroke="#8fa398" fontSize={isMobile ? 10 : 11} tickFormatter={(v) => v >= 1e7 ? `₹${(v/1e7).toFixed(1)}Cr` : v >= 1e5 ? `₹${(v/1e5).toFixed(1)}L` : `₹${v}`} />
                        <ChartTooltip contentStyle={{ background: '#121815', border: '1px solid #232c26', fontSize: isMobile ? 10 : 12 }} formatter={(v, name) => [name === 'mrr' ? new Money({ amount: v }).toString() : formatNumber(v), name]} />
                        <Line type="monotone" dataKey="mrr" stroke="#2fbf71" strokeWidth={2} dot={false} name="MRR" />
                        <Line type="monotone" dataKey="arr" stroke="#5aa9e6" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="ARR" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </MobileChartContainer>
              </MobilePaper>
            </Grid>

            <Grid item xs={12} lg={4}>
              <MobilePaper>
                <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>MRR by Plan — Daily Stacked</Typography>
                <MobileChartContainer>
                  <Box sx={{ height: isMobile ? 300 : 350, minWidth: isMobile ? '280px' : '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mrrHistory.slice().reverse()}>
                        <defs>
                          <linearGradient id="starterGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#5aa9e6" stopOpacity={0.3} /><stop offset="95%" stopColor="#5aa9e6" stopOpacity={0} /></linearGradient>
                          <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2fbf71" stopOpacity={0.3} /><stop offset="95%" stopColor="#2fbf71" stopOpacity={0} /></linearGradient>
                          <linearGradient id="corporateGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e5a54b" stopOpacity={0.3} /><stop offset="95%" stopColor="#e5a54b" stopOpacity={0} /></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#232c26" />
                        <XAxis dataKey="date" stroke="#8fa398" fontSize={isMobile ? 10 : 11} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} interval="preserveStartEnd" />
                        <YAxis stroke="#8fa398" fontSize={isMobile ? 10 : 11} tickFormatter={(v) => v >= 1e7 ? `₹${(v/1e7).toFixed(1)}Cr` : v >= 1e5 ? `₹${(v/1e5).toFixed(1)}L` : `₹${v}`} />
                        <ChartTooltip contentStyle={{ background: '#121815', border: '1px solid #232c26', fontSize: isMobile ? 10 : 12 }} formatter={(v, name) => [new Money({ amount: v }).toString(), name]} />
                        <Area type="monotone" dataKey={d => d.byPlan?.starter || 0} stroke="#5aa9e6" fill="url(#starterGrad)" strokeWidth={1.5} name="Starter" />
                        <Area type="monotone" dataKey={d => d.byPlan?.growth || 0} stroke="#2fbf71" fill="url(#growthGrad)" strokeWidth={1.5} name="Growth" />
                        <Area type="monotone" dataKey={d => d.byPlan?.corporate || 0} stroke="#e5a54b" fill="url(#corporateGrad)" strokeWidth={1.5} name="Corporate" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </MobileChartContainer>
              </MobilePaper>
            </Grid>
          </Grid>

          <Divider sx={{ mb: 3 }} />

          {/* Subscription Net New */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} lg={6}>
              <MobilePaper>
                <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Net New Subscriptions (Daily)</Typography>
                <MobileChartContainer>
                  <Box sx={{ height: isMobile ? 240 : 300, minWidth: isMobile ? '320px' : '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={mrrHistory.slice().reverse()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#232c26" />
                        <XAxis dataKey="date" stroke="#8fa398" fontSize={isMobile ? 10 : 11} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} interval="preserveStartEnd" />
                        <YAxis stroke="#8fa398" fontSize={isMobile ? 10 : 11} />
                        <ChartTooltip contentStyle={{ background: '#121815', border: '1px solid #232c26', fontSize: isMobile ? 10 : 12 }} />
                        <Bar dataKey="new_subscriptions" fill="#2fbf71" name="New" />
                        <Bar dataKey="churned_subscriptions" fill="#e5484d" name="Churned" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </MobileChartContainer>
              </MobilePaper>
            </Grid>

            <Grid item xs={12} lg={6}>
              <MobilePaper>
                <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Subscription Growth Breakdown</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Period</TableCell>
                        <TableCell align="right">New</TableCell>
                        <TableCell align="right">Churned</TableCell>
                        <TableCell align="right">Net New</TableCell>
                        <TableCell align="right">Active (End)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {mrrHistory.slice(-30).reverse().map((d, i) => (
                        <TableRow key={i} hover>
                          <TableCell>{new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</TableCell>
                          <TableCell align="right">{formatNumber(d.new_subscriptions, isMobile)}</TableCell>
                          <TableCell align="right">{formatNumber(d.churned_subscriptions, isMobile)}</TableCell>
                          <TableCell align="right"><Chip size="small" label={d.net_new_subscriptions >= 0 ? `+${d.net_new_subscriptions}` : d.net_new_subscriptions} color={d.net_new_subscriptions >= 0 ? 'success' : 'error'} variant="outlined" /></TableCell>
                          <TableCell align="right">{formatNumber(d.active_subscriptions, isMobile)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </MobilePaper>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* ───────────────── CHURN & RETENTION TAB ───────────────── */}
      {tab === 2 && (
        <Box>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} lg={8}>
              <MobilePaper>
                <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Retention Heatmap — Monthly Cohorts</Typography>
                <MobileChartContainer>
                  <Box sx={{ height: isMobile ? 350 : 400, minWidth: isMobile ? '600px' : '100%', overflowX: 'auto' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={churnCohorts.slice().reverse()} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#232c26" />
                        <XAxis type="number" stroke="#8fa398" fontSize={isMobile ? 10 : 11} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                        <YAxis type="category" dataKey="cohortMonth" stroke="#8fa398" fontSize={isMobile ? 10 : 11} width={100} tickFormatter={formatCohortMonth} />
                        <ChartTooltip contentStyle={{ background: '#121815', border: '1px solid #232c26', fontSize: isMobile ? 10 : 12 }} formatter={(v, name) => [`${v.toFixed(1)}%`, name]} />
                        <Bar dataKey="retentionRate" name="Logo Retention" fill="#2fbf71">
                          {churnCohorts.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Bar>
                        <Bar dataKey="netRevenueRetention" name="Net Revenue Retention" fill="#5aa9e6" />
                        <ReferenceLine x={100} stroke="#e5a54b" strokeWidth={1} strokeDasharray="3 3" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </MobileChartContainer>
              </MobilePaper>
            </Grid>

            <Grid item xs={12} lg={4}>
              <MobilePaper>
                <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Cohort Summary</Typography>
                <TableContainer sx={{ maxHeight: 350 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Cohort</TableCell>
                        <TableCell align="right">Started</TableCell>
                        <TableCell align="right">Active</TableCell>
                        <TableCell align="right">Retention</TableCell>
                        <TableCell align="right">NRR</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {churnCohorts.slice().reverse().map((c) => (
                        <TableRow key={c.cohortMonth} hover>
                          <TableCell>{formatCohortMonth(c.cohortMonth)}</TableCell>
                          <TableCell align="right">{c.started}</TableCell>
                          <TableCell align="right">{c.active}</TableCell>
                          <TableCell align="right">
                            <Chip size="small" label={`${c.retentionRate.toFixed(1)}%`} color={c.retentionRate >= 80 ? 'success' : c.retentionRate >= 60 ? 'warning' : 'error'} variant="outlined" />
                          </TableCell>
                          <TableCell align="right">
                            <Chip size="small" label={`${c.netRevenueRetention.toFixed(1)}%`} color={c.netRevenueRetention >= 100 ? 'success' : 'error'} variant="outlined" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </MobilePaper>
            </Grid>
          </Grid>

          <Divider sx={{ mb: 3 }} />

          {/* Churn Detail Table */}
          <MobilePaper>
            <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Churn Cohort Details</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Cohort Month</TableCell>
                    <TableCell align="right">Started</TableCell>
                    <TableCell align="right">Active</TableCell>
                    <TableCell align="right">Churned</TableCell>
                    <TableCell align="right">Expanded</TableCell>
                    <TableCell align="right">Contracted</TableCell>
                    <TableCell align="right">MRR Started</TableCell>
                    <TableCell align="right">MRR Current</TableCell>
                    <TableCell align="right">Logo Retention</TableCell>
                    <TableCell align="right">Net Revenue Retention</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {churnCohorts.map((c) => (
                    <TableRow key={c.cohortMonth} hover>
                      <TableCell>{formatCohortMonth(c.cohortMonth)}</TableCell>
                      <TableCell align="right">{c.started}</TableCell>
                      <TableCell align="right">{c.active}</TableCell>
                      <TableCell align="right">{c.churned}</TableCell>
                      <TableCell align="right">{c.expanded}</TableCell>
                      <TableCell align="right">{c.contracted}</TableCell>
                      <TableCell align="right">{formatCurrency(c.mrrStarted, isMobile)}</TableCell>
                      <TableCell align="right">{formatCurrency(c.mrrCurrent, isMobile)}</TableCell>
                      <TableCell align="right">
                        <Chip size="small" label={`${c.retentionRate.toFixed(1)}%`} color={c.retentionRate >= 80 ? 'success' : c.retentionRate >= 60 ? 'warning' : 'error'} variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <Chip size="small" label={`${c.netRevenueRetention.toFixed(1)}%`} color={c.netRevenueRetention >= 100 ? 'success' : 'error'} variant="outlined" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </MobilePaper>
        </Box>
      )}

      {/* ───────────────── UNIT ECONOMICS TAB ───────────────── */}
      {tab === 3 && (
        <Box>
          <MobileCardGrid sx={{ mb: 3 }}>
            <KpiCard label="Lifetime Value (LTV)" value={unitEcon?.ltv ? `₹${unitEcon.ltv.toLocaleString()}` : '—'} sub="Avg revenue per customer over lifetime" icon={<AttachMoneyIcon />} isMobile={isMobile} loading={loading} />
            <KpiCard label="Customer Acquisition Cost (CAC)" value={unitEcon?.cac ? `₹${unitEcon.cac.toLocaleString()}` : '—'} sub={unitEcon?.marketingSpend ? `Marketing spend: ${formatCurrency(unitEcon.marketingSpend, isMobile)}` : 'Add marketing spend to calculate'} icon={<AttachMoneyIcon />} isMobile={isMobile} loading={loading} />
            <KpiCard label="Payback Period" value={unitEcon?.paybackMonths ? `${unitEcon.paybackMonths} months` : '—'} sub="Months to recover CAC" icon={<SpeedIcon />} isMobile={isMobile} loading={loading} />
            <KpiCard label="LTV:CAC Ratio" value={unitEcon?.ltvToCac ? `${unitEcon.ltvToCac.toFixed(1)}x` : '—'} sub={unitEcon?.ltvToCac >= 3 ? 'Healthy (>3x)' : unitEcon?.ltvToCac > 0 ? 'Needs improvement' : 'No CAC data'} icon={<TrendingUpIcon />} isMobile={isMobile} loading={loading} />
            <KpiCard label="Avg Monthly Churn" value={unitEcon?.avgMonthlyChurn ? `${unitEcon.avgMonthlyChurn.toFixed(1)}%` : '—'} sub="From cohort retention rates" icon={<TrendingDownIcon />} isMobile={isMobile} loading={loading} />
            <KpiCard label="Gross MRR Churn" value={expansion?.grossMrrChurnRate ? `${expansion.grossMrrChurnRate.toFixed(1)}%` : '—'} sub="MRR lost to churn / Total MRR" icon={<TrendingDownIcon />} isMobile={isMobile} loading={loading} />
          </MobileCardGrid>

          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} lg={6}>
              <MobilePaper>
                <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Unit Economics Breakdown</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Metric</TableCell>
                        <TableCell align="right">Value</TableCell>
                        <TableCell>Benchmark</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow><TableCell>LTV</TableCell><TableCell align="right">{unitEcon?.ltv ? `₹${unitEcon.ltv.toLocaleString()}` : '—'}</TableCell><TableCell>{'> 3x CAC'}</TableCell></TableRow>
                      <TableRow><TableCell>CAC</TableCell><TableCell align="right">{unitEcon?.cac ? `₹${unitEcon.cac.toLocaleString()}` : '—'}</TableCell><TableCell>{'< 1/3 LTV'}</TableCell></TableRow>
                      <TableRow><TableCell>Payback Period</TableCell><TableCell align="right">{unitEcon?.paybackMonths ? `${unitEcon.paybackMonths} mo` : '—'}</TableCell><TableCell>{'< 12 months'}</TableCell></TableRow>
                      <TableRow><TableCell>LTV:CAC Ratio</TableCell><TableCell align="right">{unitEcon?.ltvToCac ? `${unitEcon.ltvToCac.toFixed(1)}x` : '—'}</TableCell><TableCell>{'> 3x'}</TableCell></TableRow>
                      <TableRow><TableCell>Avg Monthly Churn</TableCell><TableCell align="right">{unitEcon?.avgMonthlyChurn ? `${unitEcon.avgMonthlyChurn.toFixed(1)}%` : '—'}</TableCell><TableCell>{'< 5%'}</TableCell></TableRow>
                      <TableRow><TableCell>Gross MRR Churn</TableCell><TableCell align="right">{expansion?.grossMrrChurnRate ? `${expansion.grossMrrChurnRate.toFixed(1)}%` : '—'}</TableCell><TableCell>{'< 2%'}</TableCell></TableRow>
                      <TableRow><TableCell>Net Revenue Retention</TableCell><TableCell align="right">{churnCohorts[0]?.netRevenueRetention ? `${churnCohorts[0].netRevenueRetention.toFixed(1)}%` : '—'}</TableCell><TableCell>{'> 100%'}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </MobilePaper>
            </Grid>

            <Grid item xs={12} lg={6}>
              <MobilePaper>
                <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Marketing Spend (for CAC)</Typography>
                <Box sx={{ mb: 2 }}>
                  <Button variant="outlined" startIcon={<AttachMoneyIcon />} size="small" onClick={() => window.open('/admin/marketing-spend', '_blank')}>
                    Manage Marketing Spend
                  </Button>
                </Box>
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Channel</TableCell>
                        <TableCell>Campaign</TableCell>
                        <TableCell align="right">Spend</TableCell>
                        <TableCell align="right">New Customers</TableCell>
                        <TableCell align="right">CAC</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {/* This would come from a separate API call in production */}
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography color="text.secondary">Navigate to Admin → Marketing Spend to record spend data for accurate CAC calculation</Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </MobilePaper>
            </Grid>
          </Grid>
        </Box>
      )}

    </Box>
  );
}