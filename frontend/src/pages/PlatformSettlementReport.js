import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  Typography,
  Paper,
  LinearProgress,
  Chip,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  AccountBalance as AccountBalanceIcon,
} from '@mui/icons-material';
import api from '../api/client';
import { formatCurrency } from '../utils/format';

const round2 = (n) => Math.round((n || 0) * 100) / 100;

export default function PlatformSettlementReport() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState({});
  const [currentBalance, setCurrentBalance] = useState(0);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/accounting/reports/platform-settlement?from=${from}&to=${to}`);
      setData(res.data.data || []);
      setTotals(res.data.totals || {});
      setCurrentBalance(res.data.currentBalance || 0);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load platform settlement report');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = () => {
    const headers = [
      'Date', 'Narration', 'Total Collected', 'Our Revenue',
      'CGST', 'SGST', 'IGST', 'Total GST', 'Net Receivable'
    ];
    const rows = data.map(r => [
      r.date,
      r.narration,
      r.totalCollected,
      r.ourRevenue,
      r.gst.cgst,
      r.gst.sgst,
      r.gst.igst,
      r.gst.total,
      r.netReceivable,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `platform-settlement-${from}-to-${to}.csv`;
    link.click();
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        <AccountBalanceIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Platform Settlement Reconciliation
      </Typography>

      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={12} sm={3}>
            <TextField
              type="date"
              label="From Date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              type="date"
              label="To Date"
              value={to}
              onChange={e => setTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button
              variant="contained"
              onClick={fetchData}
              disabled={loading}
              startIcon={loading ? <LinearProgress size={18} color="inherit" /> : <RefreshIcon />}
              fullWidth
            >
              {loading ? 'Loading...' : 'Load Report'}
            </Button>
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport} disabled={data.length === 0} fullWidth>
              Export CSV
            </Button>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Paper elevation={0} variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: currentBalance >= 0 ? 'success.light' : 'error.light' }}>
              <Typography variant="caption" color="textSecondary">Current 1120 Balance</Typography>
              <Typography variant="h5" component="div" color={currentBalance >= 0 ? 'success.main' : 'error.main'}>
                {formatCurrency(currentBalance)}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper elevation={1}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" component="h2">
            Settlements: {totals.totalCollected ? formatCurrency(totals.totalCollected) : '₹0'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport} disabled={data.length === 0}>
              Export CSV
            </Button>
          </Box>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Narration</TableCell>
                <TableCell align="right">Total Collected</TableCell>
                <TableCell align="right">Our Revenue</TableCell>
                <TableCell align="right">CGST</TableCell>
                <TableCell align="right">SGST</TableCell>
                <TableCell align="right">IGST</TableCell>
                <TableCell align="right">Total GST</TableCell>
                <TableCell align="right">
                  <Tooltip title="What platform owes after deducting GST">
                    <Chip label="Net Receivable" size="small" color="primary" variant="outlined" />
                  </Tooltip>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.date} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="textSecondary">Platform Sync</Typography>
                    <Typography variant="body2">{row.narration}</Typography>
                  </TableCell>
                  <TableCell align="right">{formatCurrency(row.totalCollected)}</TableCell>
                  <TableCell align="right">{formatCurrency(row.ourRevenue)}</TableCell>
                  <TableCell align="right">{formatCurrency(row.gst.cgst)}</TableCell>
                  <TableCell align="right">{formatCurrency(row.gst.sgst)}</TableCell>
                  <TableCell align="right">{formatCurrency(row.gst.igst)}</TableCell>
                  <TableCell align="right">
                    <Chip label={formatCurrency(row.gst.total)} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={row.netReceivable >= 0 ? 'success.main' : 'error.main'}
                      sx={{ fontWeight: 600 }}
                    >
                      {formatCurrency(row.netReceivable)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>
                <TableCell colSpan={2}>TOTALS</TableCell>
                <TableCell align="right">{formatCurrency(totals.totalCollected || 0)}</TableCell>
                <TableCell align="right">{formatCurrency(totals.ourRevenue || 0)}</TableCell>
                <TableCell align="right">{formatCurrency(totals.cgst || 0)}</TableCell>
                <TableCell align="right">{formatCurrency(totals.sgst || 0)}</TableCell>
                <TableCell align="right">{formatCurrency(totals.igst || 0)}</TableCell>
                <TableCell align="right">
                  <Chip label={formatCurrency(totals.totalGst || 0)} size="small" variant="outlined" />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={600} color={totals.netReceivable >= 0 ? 'success.main' : 'error.main'}>
                    {formatCurrency(totals.netReceivable || 0)}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" component="h2">
            Net Receivable from Platform: <strong>{formatCurrency(totals.netReceivable || 0)}</strong>
          </Typography>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => {}}>
            Export CSV
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </Box>
  );
}