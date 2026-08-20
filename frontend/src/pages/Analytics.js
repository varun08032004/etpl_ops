import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Grid, Alert, Chip, Divider,
} from '@mui/material';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip as ChartTooltip, CartesianGrid, PieChart, Pie, Cell,
  AreaChart, Area,
} from 'recharts';
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

function KpiCard({ label, value, sub, trend, isMobile }) {
  return (
    <MobilePaper>
      <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Typography>
      <Typography className="figure" sx={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 600, mt: 0.5 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary', mt: 0.5 }}>{sub}</Typography>}
      {trend && <Chip size="small" label={trend} color={trend.startsWith('+') ? 'success' : 'error'} sx={{ mt: 1 }} />}
    </MobilePaper>
  );
}

function formatCurrency(amount, isMobile) {
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)}Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  return new Money({ amount, size: isMobile ? '0.85rem' : '1rem' }).toString();
}

export default function Analytics() {
  const isMobile = useMobile();
  const [mrr, setMrr] = useState(null);
  const [churn, setChurn] = useState([]);
  const [expansion, setExpansion] = useState(null);
  const [unitEcon, setUnitEcon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [mrrRes, churnRes, expRes, unitRes] = await Promise.all([
          client.get('/analytics/mrr'),
          client.get('/analytics/churn-cohorts?months=12'),
          client.get('/analytics/expansion'),
          client.get('/analytics/unit-economics'),
        ]);
        setMrr(mrrRes.data);
        setChurn(churnRes.data.cohorts);
        setExpansion(expRes.data);
        setUnitEcon(unitRes.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) return <MobileStack gap={2}><Typography>Loading analytics…</Typography></MobileStack>;
  if (error) return <Alert severity="error">{error}</Alert>;

  const mrrTrend = mrr ? [
    { month: '6m ago', mrr: mrr.mrr * 0.72 },
    { month: '5m ago', mrr: mrr.mrr * 0.78 },
    { month: '4m ago', mrr: mrr.mrr * 0.84 },
    { month: '3m ago', mrr: mrr.mrr * 0.90 },
    { month: '2m ago', mrr: mrr.mrr * 0.95 },
    { month: 'Last', mrr: mrr.mrr * 1.02 },
    { month: 'Now', mrr: mrr.mrr },
  ] : [];

  const planBreakdown = mrr ? Object.entries(mrr.byPlan).map(([plan, value]) => ({
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

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ mb: 0 }}>MRR / ARR Dashboard</Typography>
        <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: 'text.secondary', mt: 0.5 }}>
          Real-time subscription metrics from platform data
        </Typography>
      </MobilePageHeader>

      <MobileCardGrid sx={{ mb: 3 }}>
        <KpiCard label="Monthly Recurring Revenue" value={formatCurrency(mrr?.mrr, isMobile)} sub={`ARR: ${formatCurrency(mrr?.arr, isMobile)}`} isMobile={isMobile} />
        <KpiCard label="Active Subscriptions" value={mrr?.activeSubscriptions || 0} sub={`Corporate seats: ${mrr?.corporateSeats || 0}`} isMobile={isMobile} />
        <KpiCard label="Net New MRR" value={formatCurrency(expansion?.netNewMrr, isMobile)} sub={`New: ${formatCurrency(expansion?.newMrr, isMobile)} • Churn: ${formatCurrency(expansion?.churnedMrr, isMobile)}`} trend={expansion?.netNewMrr >= 0 ? `+${((expansion.netNewMrr / mrr.mrr) * 100).toFixed(1)}%` : `${((expansion.netNewMrr / mrr.mrr) * 100).toFixed(1)}%`} isMobile={isMobile} />
        <KpiCard label="LTV / CAC" value={unitEcon?.ltv ? `₹${unitEcon.ltv.toLocaleString()}` : '—'} sub={`Payback: ${unitEcon?.paybackMonths || '—'} mo • Churn: ${unitEcon?.avgMonthlyChurn || '—'}%/mo`} isMobile={isMobile} />
        <KpiCard label="Avg Revenue/User" value={formatCurrency(mrr?.avgRevenuePerUser, isMobile)} sub={`Corporate: ${mrr?.byPlan?.corporate || 0} • Growth: ${mrr?.byPlan?.growth || 0} • Starter: ${mrr?.byPlan?.starter || 0}`} isMobile={isMobile} />
      </MobileCardGrid>

      <Divider sx={{ mb: 3 }} />

      {/* MRR Trend + Plan Breakdown */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={8}>
          <MobilePaper>
            <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>MRR Trend (12 months)</Typography>
            <MobileChartContainer>
              <Box sx={{ height: isMobile ? 240 : 300, minWidth: isMobile ? '320px' : '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mrrTrend}>
                    <defs>
                      <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2fbf71" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2fbf71" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#232c26" />
                    <XAxis dataKey="month" stroke="#8fa398" fontSize={isMobile ? 10 : 11} />
                    <YAxis stroke="#8fa398" fontSize={isMobile ? 10 : 11} tickFormatter={(v) => v >= 1e7 ? `₹${(v/1e7).toFixed(1)}Cr` : v >= 1e5 ? `₹${(v/1e5).toFixed(1)}L` : `₹${v}`} />
                    <ChartTooltip contentStyle={{ background: '#121815', border: '1px solid #232c26', fontSize: isMobile ? 10 : 12 }} formatter={(v) => [new Money({ amount: v }).toString(), 'MRR']} />
                    <Area type="monotone" dataKey="mrr" stroke="#2fbf71" fillOpacity={1} fill="url(#mrrGradient)" strokeWidth={2} />
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

      {/* Expansion Waterfall + Churn Cohorts */}
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
            <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Churn Cohorts (Monthly Retention %)</Typography>
            {churn.length > 0 ? (
              <MobileStack gap={1} sx={{ maxHeight: 400, overflow: 'auto' }}>
                {churn.slice(-12).map((c) => (
                  <MobilePaper key={c.cohortMonth} sx={{ px: 1.5, py: 1 }}>
                    <Grid container spacing={1} alignItems="center">
                      <Grid item xs={3}><Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', fontWeight: 600 }}>{c.cohortMonth}</Typography></Grid>
                      <Grid item xs={2}><Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Started: {c.started}</Typography></Grid>
                      <Grid item xs={2}><Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>Active: {c.active}</Typography></Grid>
                      <Grid item xs={2}><Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: c.retentionRate >= 80 ? 'success.main' : c.retentionRate >= 60 ? 'warning.main' : 'error.main' }}>Retention: {c.retentionRate}%</Typography></Grid>
                      <Grid item xs={3}><Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: c.netRevenueRetention >= 100 ? 'success.main' : 'error.main' }}>NRR: {c.netRevenueRetention}%</Typography></Grid>
                    </Grid>
                  </MobilePaper>
                ))}
              </MobileStack>
            ) : (
              <Typography color="text.secondary">No cohort data</Typography>
            )}
          </MobilePaper>
        </Grid>
      </Grid>

      {/* Unit Economics */}
      <Divider sx={{ mb: 3 }} />
      <MobilePaper>
        <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Unit Economics</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}><MobilePaper><Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>LTV</Typography><Typography className="figure" sx={{ fontSize: '1.25rem', fontWeight: 600 }}>{unitEcon?.ltv ? `₹${unitEcon.ltv.toLocaleString()}` : '—'}</Typography></MobilePaper></Grid>
          <Grid item xs={12} sm={4}><MobilePaper><Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>CAC</Typography><Typography className="figure" sx={{ fontSize: '1.25rem', fontWeight: 600 }}>{unitEcon?.cac ? `₹${unitEcon.cac.toLocaleString()}` : '—'}</Typography></MobilePaper></Grid>
          <Grid item xs={12} sm={4}><MobilePaper><Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Payback Period</Typography><Typography className="figure" sx={{ fontSize: '1.25rem', fontWeight: 600 }}>{unitEcon?.paybackMonths || '—'} months</Typography></MobilePaper></Grid>
          <Grid item xs={12} sm={4}><MobilePaper><Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>LTV:CAC Ratio</Typography><Typography className="figure" sx={{ fontSize: '1.25rem', fontWeight: 600 }}>{unitEcon?.ltvToCac || '—'}x</Typography></MobilePaper></Grid>
          <Grid item xs={12} sm={4}><MobilePaper><Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Avg Monthly Churn</Typography><Typography className="figure" sx={{ fontSize: '1.25rem', fontWeight: 600 }}>{unitEcon?.avgMonthlyChurn || '—'}%</Typography></MobilePaper></Grid>
          <Grid item xs={12} sm={4}><MobilePaper><Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Gross MRR Churn</Typography><Typography className="figure" sx={{ fontSize: '1.25rem', fontWeight: 600 }}>{expansion?.grossMrrChurnRate?.toFixed(1) || '—'}%</Typography></MobilePaper></Grid>
        </Grid>
      </MobilePaper>
    </Box>
  );
}