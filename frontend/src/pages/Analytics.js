import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import client from '../api/client';
import Money from '../components/Money';
import {
  MobilePaper,
  MobilePageHeader,
  MobileCardGrid,
  MobileStack,
  MobileChartContainer,
  MobileTwoColumnGrid,
  useMobile,
} from '../components/MobileResponsive';

const PIE_COLORS = ['#2fbf71', '#e5a54b', '#5aa9e6', '#e5484d', '#a78bfa', '#f472b6', '#facc15'];

function KpiCard({ label, value, sub, isMobile }) {
  return (
    <MobilePaper>
      <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Typography>
      <Typography className="figure" sx={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 600, mt: 0.5 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary', mt: 0.5 }}>{sub}</Typography>}
    </MobilePaper>
  );
}

export default function Analytics() {
  const isMobile = useMobile();
  const [trend, setTrend] = useState([]);
  const [headcountTrend, setHeadcountTrend] = useState([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState([]);
  const [salesConversion, setSalesConversion] = useState(null);
  const [arAging, setArAging] = useState(null);

  useEffect(() => {
    client.get('/analytics/revenue-expense-trend', { params: { months: 12 } }).then(({ data }) => setTrend(data.trend));
    client.get('/analytics/headcount-trend', { params: { months: 12 } }).then(({ data }) => setHeadcountTrend(data.trend));
    client.get('/analytics/expense-breakdown').then(({ data }) => setExpenseBreakdown(data.breakdown));
    client.get('/analytics/sales-conversion').then(({ data }) => setSalesConversion(data));
    client.get('/analytics/ar-aging').then(({ data }) => setArAging(data));
  }, []);

  const agingChartData = arAging ? [
    { bucket: 'Current', amount: arAging.buckets.current },
    { bucket: '1-30d', amount: arAging.buckets.days_1_30 },
    { bucket: '31-60d', amount: arAging.buckets.days_31_60 },
    { bucket: '61-90d', amount: arAging.buckets.days_61_90 },
    { bucket: '90d+', amount: arAging.buckets.days_90_plus },
  ] : [];

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ mb: 0 }}>Analytics</Typography>
      </MobilePageHeader>

      {salesConversion && (
        <MobileCardGrid sx={{ mb: 3 }}>
          <KpiCard label="Deals won" value={salesConversion.won} isMobile={isMobile} />
          <KpiCard label="Conversion rate" value={salesConversion.conversionRatePercent != null ? `${salesConversion.conversionRatePercent}%` : '—'} isMobile={isMobile} />
          <KpiCard label="Avg deal cycle" value={salesConversion.avgDealCycleDays != null ? `${salesConversion.avgDealCycleDays}d` : '—'} isMobile={isMobile} />
          <KpiCard label="Open deals" value={salesConversion.open} isMobile={isMobile} />
        </MobileCardGrid>
      )}

      <MobileTwoColumnGrid>
        <MobilePaper sx={{ minHeight: isMobile ? 'auto' : 320 }}>
          <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Revenue vs expense — 12 months</Typography>
          <MobileChartContainer>
            <Box sx={{ height: isMobile ? 220 : 280, minWidth: isMobile ? '320px' : '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232c26" />
                  <XAxis dataKey="month" stroke="#8fa398" fontSize={isMobile ? 10 : 11} />
                  <YAxis stroke="#8fa398" fontSize={isMobile ? 10 : 11} />
                  <ChartTooltip contentStyle={{ background: '#121815', border: '1px solid #232c26', fontSize: isMobile ? 10 : 12 }} />
                  <Line type="monotone" dataKey="revenue" stroke="#2fbf71" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expense" stroke="#e5484d" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </MobileChartContainer>
        </MobilePaper>

        <MobilePaper sx={{ minHeight: isMobile ? 'auto' : 320 }}>
          <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Expense breakdown — this month</Typography>
          {expenseBreakdown.length > 0 ? (
            <MobileChartContainer>
              <Box sx={{ height: isMobile ? 220 : 280, minWidth: isMobile ? '320px' : '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseBreakdown} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={isMobile ? 70 : 80} label={(d) => d.category}>
                      {expenseBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <ChartTooltip contentStyle={{ background: '#121815', border: '1px solid #232c26', fontSize: isMobile ? 10 : 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </MobileChartContainer>
          ) : (
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>No expenses recorded this month yet.</Typography>
          )}
        </MobilePaper>
      </MobileTwoColumnGrid>

      <MobileTwoColumnGrid>
        <MobilePaper sx={{ minHeight: isMobile ? 'auto' : 300 }}>
          <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Headcount — 12 months</Typography>
          <MobileChartContainer>
            <Box sx={{ height: isMobile ? 200 : 260, minWidth: isMobile ? '320px' : '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={headcountTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232c26" />
                  <XAxis dataKey="month" stroke="#8fa398" fontSize={isMobile ? 10 : 11} />
                  <YAxis stroke="#8fa398" fontSize={isMobile ? 10 : 11} allowDecimals={false} />
                  <ChartTooltip contentStyle={{ background: '#121815', border: '1px solid #232c26', fontSize: isMobile ? 10 : 12 }} />
                  <Line type="monotone" dataKey="headcount" stroke="#5aa9e6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </MobileChartContainer>
        </MobilePaper>

        <MobilePaper sx={{ minHeight: isMobile ? 'auto' : 300 }}>
          <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 2 }}>Accounts receivable aging</Typography>
          <MobileChartContainer>
            <Box sx={{ height: isMobile ? 200 : 260, minWidth: isMobile ? '320px' : '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232c26" />
                  <XAxis dataKey="bucket" stroke="#8fa398" fontSize={isMobile ? 10 : 11} />
                  <YAxis stroke="#8fa398" fontSize={isMobile ? 10 : 11} />
                  <ChartTooltip contentStyle={{ background: '#121815', border: '1px solid #232c26', fontSize: isMobile ? 10 : 12 }} />
                  <Bar dataKey="amount" fill="#e5a54b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </MobileChartContainer>
        </MobilePaper>
      </MobileTwoColumnGrid>

      {arAging?.invoices?.length > 0 && (
        <MobilePaper sx={{ mt: isMobile ? 2 : 2.5 }}>
          <Typography sx={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'text.secondary', mb: 1.5 }}>Overdue invoices</Typography>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>Invoice</TableCell><TableCell>Customer</TableCell><TableCell align="right">Outstanding</TableCell><TableCell align="right">Days overdue</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {arAging.invoices.map((inv) => (
                <TableRow key={inv.invoice_number}>
                  <TableCell className="figure">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.customer}</TableCell>
                  <TableCell align="right"><Money amount={inv.outstanding} /></TableCell>
                  <TableCell align="right" className="figure">{inv.days_overdue > 0 ? inv.days_overdue : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MobilePaper>
      )}
    </Box>
  );
}