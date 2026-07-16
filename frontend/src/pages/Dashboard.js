import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Paper, Typography, Grid, Skeleton, Alert, Chip } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, CartesianGrid } from 'recharts';
import client from '../api/client';
import Money from '../components/Money';

function StatCard({ label, value, hint }) {
  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </Typography>
      <Typography className="figure" sx={{ fontSize: '1.6rem', fontWeight: 600, mt: 0.5 }}>{value}</Typography>
      {hint && <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>{hint}</Typography>}
    </Paper>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

        const [employeesRes, invoicesRes, pnlRes, runwayRes, complianceRes] = await Promise.all([
          client.get('/employees', { params: { status: 'active' } }),
          client.get('/invoices'),
          client.get('/accounting/reports/profit-and-loss', { params: { from: monthStart, to: monthEnd } }),
          client.get('/accounting/reports/cashflow-runway', { params: { months: 6 } }),
          client.get('/compliance/due-soon').catch(() => ({ data: { items: [] } })),
        ]);

        const unpaidInvoices = invoicesRes.data.invoices.filter((i) => ['sent', 'partially_paid', 'overdue'].includes(i.status));
        const outstandingAR = unpaidInvoices.reduce((s, i) => s + Number(i.total_amount) - Number(i.amount_paid), 0);

        setData({
          activeEmployees: employeesRes.data.employees.length,
          pnl: pnlRes.data,
          outstandingAR,
          unpaidCount: unpaidInvoices.length,
          runway: runwayRes.data.months,
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
      <Grid container spacing={2.5}>
        {[1, 2, 3, 4].map((i) => <Grid item xs={12} sm={6} md={3} key={i}><Skeleton variant="rounded" height={100} /></Grid>)}
      </Grid>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>Overview</Typography>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Active headcount" value={data.activeEmployees} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="This month's revenue" value={<Money amount={data.pnl.totalIncome} />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="This month's expenses" value={<Money amount={data.pnl.totalExpense} />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Net profit (MTD)"
            value={<Money amount={data.pnl.netProfit} color={data.pnl.netProfit >= 0 ? 'primary.main' : 'error.main'} />}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2.5, height: 320 }}>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 2 }}>Income vs expense — last 6 months</Typography>
            <ResponsiveContainer width="100%" height="88%">
              <BarChart data={data.runway}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232c26" />
                <XAxis dataKey="month" stroke="#8fa398" fontSize={12} />
                <YAxis stroke="#8fa398" fontSize={12} />
                <ChartTooltip contentStyle={{ background: '#121815', border: '1px solid #232c26', fontSize: 12 }} />
                <Bar dataKey="income" fill="#2fbf71" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#e5484d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, height: 320 }}>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 2 }}>Accounts receivable</Typography>
            <Typography className="figure" sx={{ fontSize: '2rem', fontWeight: 600 }}>
              <Money amount={data.outstandingAR} />
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.5 }}>
              across {data.unpaidCount} unpaid invoice{data.unpaidCount === 1 ? '' : 's'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* COMP-03: compliance calendar must be visible on the Dashboard at all times */}
      <Paper sx={{ p: 2.5, mt: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>Compliance — due soon</Typography>
          <Typography component={Link} to="/compliance" sx={{ fontSize: '0.78rem', color: 'primary.main', textDecoration: 'none' }}>
            View all →
          </Typography>
        </Box>
        {data.compliance.length === 0 ? (
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>Nothing due in the next 30 days.</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {data.compliance.slice(0, 6).map((item) => (
              <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.85rem' }}>{item.title}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{item.owner_name || 'Unassigned'} · {item.category}</Typography>
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
      </Paper>
    </Box>
  );
}