import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, Grid, Skeleton, Alert, Chip, MenuItem, TextField, Table, TableRow, TableCell, TableBody } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, CartesianGrid } from 'recharts';
import client from '../api/client';
import Money from '../components/Money';
import {
  MobileCardGrid,
  MobilePaper,
  MobileChartContainer,
  MobilePageHeader,
  MobileTwoColumnGrid,
  MobileStack,
  MobileButton,
  MobileStatCard,
  MobileDataCard,
  useMobile,
} from '../components/MobileResponsive';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveIcon from '@mui/icons-material/Remove';

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const [breakdownYear, setBreakdownYear] = useState(currentYear);
  const [breakdown, setBreakdown] = useState(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(null);
  const isMobile = useMobile();

  const loadBreakdown = (year) => {
    client.get('/accounting/reports/monthly-breakdown', { params: { year } })
      .then(({ data }) => setBreakdown(data))
      .catch(() => setBreakdown(null));
  };

  useEffect(() => { loadBreakdown(breakdownYear); setSelectedMonthIndex(null); }, [breakdownYear]);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

        const [employeesRes, invoicesRes, pnlRes, runwayRes, revenueGrowthRes, complianceRes] = await Promise.all([
          client.get('/employees', { params: { status: 'active' } }),
          client.get('/invoices'),
          client.get('/accounting/reports/profit-and-loss', { params: { from: monthStart, to: monthEnd } }),
          client.get('/accounting/reports/cashflow-runway', { params: { months: 6 } }),
          client.get('/accounting/reports/revenue-growth', { params: { months: 1 } }).catch(() => ({ data: { months: [] } })),
          client.get('/compliance/due-soon').catch(() => ({ data: { items: [] } })),
        ]);

        const unpaidInvoices = invoicesRes.data.invoices.filter((i) => ['sent', 'partially_paid', 'overdue'].includes(i.status));
        const outstandingAR = unpaidInvoices.reduce((s, i) => s + Number(i.total_amount) - Number(i.amount_paid), 0);

        const thisMonth = revenueGrowthRes.data.months?.[revenueGrowthRes.data.months.length - 1];
        const mrr = thisMonth?.subscriptionRevenue ?? null;

        setData({
          activeEmployees: employeesRes.data.employees.length,
          pnl: pnlRes.data,
          outstandingAR,
          unpaidCount: unpaidInvoices.length,
          avgMonthlyBurn: runwayRes.data.avgMonthlyBurnLast3Mo,
          cashOnHand: runwayRes.data.cashOnHand,
          runwayMonths: runwayRes.data.runwayMonths,
          runwayNote: runwayRes.data.note,
          mrr,
          arr: mrr != null ? mrr * 12 : null,
          compliance: complianceRes.data.items,
        });
      } catch (err) {
        setError('Some dashboard data needs the accounting/employees modules seeded first — this is expected on a fresh install.');
      }
    })();
  }, []);

  if (error) return <Alert severity="info">{error}</Alert>;
  if (!data) {
    return (
      <MobileCardGrid>
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rounded" height={isMobile ? 80 : 100} />)}
      </MobileCardGrid>
    );
  }

  const chartData = breakdown?.months.map((m) => ({ month: m.month, income: m.totalIncome, expense: m.totalExpense })) || [];
  const selectedMonth = selectedMonthIndex != null ? breakdown?.months[selectedMonthIndex] : null;

  const revenueTrend = data.pnl.totalIncome > 0 ? { label: 'Positive', color: 'success', icon: <TrendingUpIcon fontSize="small" /> } : { label: 'No revenue', color: 'default', icon: <RemoveIcon fontSize="small" /> };
  const burnTrend = data.avgMonthlyBurn > 0 ? { label: 'Burning', color: 'error', icon: <TrendingDownIcon fontSize="small" /> } : { label: 'Positive', color: 'success', icon: <TrendingUpIcon fontSize="small" /> };

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ mb: 0 }}>Overview</Typography>
      </MobilePageHeader>

      <MobileCardGrid sx={{ mb: isMobile ? 2 : 3 }}>
        <MobileStatCard
          label="Active headcount"
          value={data.activeEmployees}
          icon={<Typography>👥</Typography>}
        />
        <MobileStatCard
          label="This month's revenue"
          value={<Money amount={data.pnl.totalIncome} />}
          icon={<Typography>💰</Typography>}
        />
        <MobileStatCard
          label="This month's expenses"
          value={<Money amount={data.pnl.totalExpense} />}
          icon={<Typography>💸</Typography>}
        />
        <MobileStatCard
          label="Net profit (MTD)"
          value={<Money amount={data.pnl.netProfit} color={data.pnl.netProfit >= 0 ? 'primary.main' : 'error.main'} />}
          icon={<Typography>📊</Typography>}
          trend={revenueTrend}
        />
      </MobileCardGrid>

      <MobileCardGrid sx={{ mb: isMobile ? 2 : 3 }}>
        <MobileStatCard
          label="MRR"
          value={data.mrr != null ? <Money amount={data.mrr} /> : '—'}
          hint="This month's subscription revenue"
          icon={<Typography>🔄</Typography>}
        />
        <MobileStatCard
          label="ARR"
          value={data.arr != null ? <Money amount={data.arr} /> : '—'}
          hint="MRR × 12"
          icon={<Typography>📅</Typography>}
        />
        <MobileStatCard
          label="Avg. monthly burn"
          value={<Money amount={data.avgMonthlyBurn} color={data.avgMonthlyBurn > 0 ? 'error.main' : 'primary.main'} />}
          hint="Last 3 months"
          icon={<Typography>🔥</Typography>}
          trend={burnTrend}
        />
        <MobileStatCard
          label="Runway"
          value={data.runwayMonths != null ? `${data.runwayMonths} mo` : '—'}
          hint={data.runwayNote || <Money amount={data.cashOnHand} size="0.75rem" />}
          icon={<Typography>⏱️</Typography>}
        />
      </MobileCardGrid>

      <MobileTwoColumnGrid>
        <MobilePaper>
          <MobilePageHeader>
            <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary' }}>
              Income vs expense — {breakdownYear}{breakdown ? ` (₹${breakdown.yearTotalIncome.toLocaleString('en-IN')} in, ₹${breakdown.yearTotalExpense.toLocaleString('en-IN')} out)` : ''}
            </Typography>
            <TextField select size="small" value={breakdownYear} onChange={(e) => setBreakdownYear(Number(e.target.value))} sx={{ minWidth: isMobile ? '80px' : 110 }}>
              {YEAR_OPTIONS.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </TextField>
          </MobilePageHeader>
          <MobileChartContainer>
            <Box sx={{ height: isMobile ? 220 : 260, minWidth: isMobile ? '320px' : '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} onClick={(e) => { if (e?.activeTooltipIndex != null) setSelectedMonthIndex(e.activeTooltipIndex); }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232c26" />
                  <XAxis dataKey="month" stroke="#8fa398" fontSize={isMobile ? 10 : 12} />
                  <YAxis stroke="#8fa398" fontSize={isMobile ? 10 : 12} />
                  <ChartTooltip contentStyle={{ background: '#121815', border: '1px solid #232c26', fontSize: isMobile ? 10 : 12 }} />
                  <Bar dataKey="income" fill="#2fbf71" radius={[4, 4, 0, 0]} cursor="pointer" />
                  <Bar dataKey="expense" fill="#e5484d" radius={[4, 4, 0, 0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </MobileChartContainer>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: 'text.secondary', mt: 1 }}>Click a month's bars to see the account-by-account breakdown below.</Typography>

          {selectedMonth && (
            <Box sx={{ mt: 3 }}>
              <Typography sx={{ fontWeight: 600, mb: 1.5 }}>
                {MONTH_LABELS[selectedMonthIndex]} {breakdownYear} — breakdown
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.78rem', color: 'text.secondary', mb: 0.5 }}>Income</Typography>
                  <Table size="small">
                    <TableBody>
                      {selectedMonth.income.map((a) => (
                        <TableRow key={a.code}>
                          <TableCell sx={{ fontSize: isMobile ? '0.72rem' : '0.8rem' }}>{a.name}</TableCell>
                          <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.72rem' : '0.8rem' }}>₹{Number(a.amount).toLocaleString('en-IN')}</TableCell>
                        </TableRow>
                      ))}
                      {!selectedMonth.income.length && <TableRow><TableCell sx={{ fontSize: isMobile ? '0.72rem' : '0.8rem', color: 'text.secondary' }}>No income this month.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.78rem', color: 'text.secondary', mb: 0.5 }}>Expense</Typography>
                  <Table size="small">
                    <TableBody>
                      {selectedMonth.expenses.map((a) => (
                        <TableRow key={a.code}>
                          <TableCell sx={{ fontSize: isMobile ? '0.72rem' : '0.8rem' }}>{a.name}</TableCell>
                          <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.72rem' : '0.8rem' }}>₹{Number(a.amount).toLocaleString('en-IN')}</TableCell>
                        </TableRow>
                      ))}
                      {!selectedMonth.expenses.length && <TableRow><TableCell sx={{ fontSize: isMobile ? '0.72rem' : '0.8rem', color: 'text.secondary' }}>No expense this month.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </Grid>
              </Grid>
            </Box>
          )}
        </MobilePaper>
        <MobilePaper sx={{ minHeight: isMobile ? 'auto' : 320 }}>
          <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Accounts receivable</Typography>
          <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600 }}>
            <Money amount={data.outstandingAR} />
          </Typography>
          <Typography sx={{ fontSize: isMobile ? '0.72rem' : '0.8rem', color: 'text.secondary', mt: 0.5 }}>
            across {data.unpaidCount} unpaid invoice{data.unpaidCount === 1 ? '' : 's'}
          </Typography>
        </MobilePaper>
      </MobileTwoColumnGrid>

      {/* COMP-03: compliance calendar must be visible on the Dashboard at all times */}
      <MobilePaper sx={{ mt: isMobile ? 2 : 2.5 }}>
        <MobilePageHeader>
          <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary' }}>Compliance — due soon</Typography>
          <Typography component={Link} to="/compliance" sx={{ fontSize: isMobile ? '0.7rem' : '0.78rem', color: 'primary.main', textDecoration: 'none' }}>
            View all →
          </Typography>
        </MobilePageHeader>
        {data.compliance.length === 0 ? (
          <Typography sx={{ fontSize: isMobile ? '0.72rem' : '0.8rem', color: 'text.secondary' }}>Nothing due in the next 30 days.</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {data.compliance.slice(0, 6).map((item) => (
              <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: isMobile ? 1 : 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box>
                  <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem' }}>{item.title}</Typography>
                  <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: 'text.secondary' }}>{item.owner_name || 'Unassigned'} · {item.category}</Typography>
                </Box>
                <Chip
                  size="small"
                  label={item.is_overdue ? 'Overdue' : `${item.days_until_due}d left`}
                  color={item.is_overdue ? 'error' : item.days_until_due <= 7 ? 'warning' : 'default'}
                  variant={item.is_overdue || item.days_until_due <= 7 ? 'filled' : 'outlined'}
                />
              </Box>
            ))}
          </Box>
        )}
      </MobilePaper>
    </Box>
  );
}