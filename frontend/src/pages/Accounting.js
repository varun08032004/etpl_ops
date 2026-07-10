import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody, TextField, Grid, Divider } from '@mui/material';
import client from '../api/client';
import Money from '../components/Money';

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

export default function Accounting() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>Accounting</Typography>
      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Trial Balance" />
        <Tab label="Profit & Loss" />
        <Tab label="Balance Sheet" />
      </Tabs>
      {tab === 0 && <TrialBalance />}
      {tab === 1 && <ProfitAndLoss />}
      {tab === 2 && <BalanceSheet />}
    </Box>
  );
}
