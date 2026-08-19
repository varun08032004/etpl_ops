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
  TablePagination,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  Alert,
  LinearProgress,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import api from '../api/client';
import { formatCurrency } from '../utils/format';
import {
  MobilePaper,
  MobilePageHeader,
  MobileButton,
  MobileTextField,
  MobileStack,
  ResponsiveTableContainer,
  useMobile,
} from '../components/MobileResponsive';

const round2 = (n) => Math.round((n || 0) * 100) / 100;

export default function GSTLiabilityReport() {
  const isMobile = useMobile();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/accounting/reports/gst-liability?from=${from}&to=${to}`);
      setData(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load GST liability report');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = () => {
    const headers = [
      'Month', 'Output CGST', 'Output SGST', 'Output IGST', 'Total Output',
      'Input CGST', 'Input SGST', 'Input IGST', 'Total Input',
      'Net CGST', 'Net SGST', 'Net IGST', 'Net Payable'
    ];
    const rows = data.map(r => [
      r.month,
      r.output.cgst, r.output.sgst, r.output.igst, r.output.total,
      r.input.cgst, r.input.sgst, r.input.igst, r.input.total,
      r.net.cgst, r.net.sgst, r.net.igst, r.net.total,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gst-liability-${from}-to-${to}.csv`;
    link.click();
  };

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ mb: 0 }}>GST Liability vs ITC (GSTR-3B Style)</Typography>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 2 }}>
        <MobileStack direction="column" gap={2} sx={{ mb: 1 }}>
          <MobileStack gap={1.5} direction="row" flexWrap="wrap">
            <MobileTextField
              type="date"
              label="From Date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <MobileTextField
              type="date"
              label="To Date"
              value={to}
              onChange={e => setTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </MobileStack>
          <MobileStack gap={1} direction="row" flexWrap="wrap">
            <MobileButton
              variant="contained"
              onClick={fetchData}
              disabled={loading}
              startIcon={loading ? <LinearProgress size={18} color="inherit" /> : <RefreshIcon />}
            >
              {loading ? 'Loading...' : 'Load Report'}
            </MobileButton>
          </MobileStack>
        </MobileStack>
      </MobilePaper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Month</TableCell>
                <TableCell colSpan={3} align="center"><strong>OUTPUT GST (Liability)</strong></TableCell>
                <TableCell colSpan={3} align="center"><strong>INPUT GST (ITC)</strong></TableCell>
                <TableCell colSpan={3} align="center"><strong>NET PAYABLE</strong></TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Month</TableCell>
                <TableCell align="right">CGST</TableCell>
                <TableCell align="right">SGST</TableCell>
                <TableCell align="right">IGST</TableCell>
                <TableCell align="right">CGST</TableCell>
                <TableCell align="right">SGST</TableCell>
                <TableCell align="right">IGST</TableCell>
                <TableCell align="right">CGST</TableCell>
                <TableCell align="right">SGST</TableCell>
                <TableCell align="right">IGST</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.month} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                  <TableCell>{row.month}</TableCell>
                  <TableCell align="right">{formatCurrency(row.output.cgst)}</TableCell>
                  <TableCell align="right">{formatCurrency(row.output.sgst)}</TableCell>
                  <TableCell align="right">{formatCurrency(row.output.igst)}</TableCell>
                  <TableCell align="right">{formatCurrency(row.input.cgst)}</TableCell>
                  <TableCell align="right">{formatCurrency(row.input.sgst)}</TableCell>
                  <TableCell align="right">{formatCurrency(row.input.igst)}</TableCell>
                  <TableCell align="right">
                    <Chip label={formatCurrency(row.net.cgst)} size="small" variant="outlined" color={row.net.cgst >= 0 ? 'error' : 'success'} />
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={formatCurrency(row.net.sgst)} size="small" variant="outlined" color={row.net.sgst >= 0 ? 'error' : 'success'} />
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={formatCurrency(row.net.igst)} size="small" variant="outlined" color={row.net.igst >= 0 ? 'error' : 'success'} />
                  </TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>
                <TableCell>TOTAL</TableCell>
                <TableCell align="right">{formatCurrency(data.reduce((s, r) => s + r.output.cgst, 0))}</TableCell>
                <TableCell align="right">{formatCurrency(data.reduce((s, r) => s + r.output.sgst, 0))}</TableCell>
                <TableCell align="right">{formatCurrency(data.reduce((s, r) => s + r.output.igst, 0))}</TableCell>
                <TableCell align="right">{formatCurrency(data.reduce((s, r) => s + r.input.cgst, 0))}</TableCell>
                <TableCell align="right">{formatCurrency(data.reduce((s, r) => s + r.input.sgst, 0))}</TableCell>
                <TableCell align="right">{formatCurrency(data.reduce((s, r) => s + r.input.igst, 0))}</TableCell>
                <TableCell align="right">
                  <Chip label={formatCurrency(data.reduce((s, r) => s + r.net.cgst, 0))} size="small" variant="outlined" />
                </TableCell>
                <TableCell align="right">
                  <Chip label={formatCurrency(data.reduce((s, r) => s + r.net.sgst, 0))} size="small" variant="outlined" />
                </TableCell>
                <TableCell align="right">
                  <Chip label={formatCurrency(data.reduce((s, r) => s + r.net.igst, 0))} size="small" variant="outlined" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </ResponsiveTableContainer>

        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" component="h2">
            Net GST Payable: {formatCurrency(
              data.reduce((s, r) => s + r.net.cgst + r.net.sgst + r.net.igst, 0)
            )}
          </Typography>
          <MobileButton variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport} disabled={data.length === 0}>
            Export CSV (GSTR-3B)
          </MobileButton>
        </Box>
      </MobilePaper>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </Box>
  );
}