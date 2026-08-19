import React, { useState, useEffect } from 'react';
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
  Tooltip,
  Chip,
  Alert,
  Collapse,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Menu,
  InputAdornment,
} from '@mui/material';
import {
  Download as DownloadIcon,
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Error as ErrorIcon,
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

export default function GSTCollectedReport() {
  const isMobile = useMobile();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState({});
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [revenueType, setRevenueType] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from,
        to,
        revenue_type: revenueType,
      });
      const res = await api.get(`/accounting/reports/gst-collected?${params}`);
      setData(res.data.data || []);
      setTotals(res.data.totals || {});
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load GST collected report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [from, to, revenueType]);

  const handleExport = () => {
    const headers = [
      'Date', 'Narration', 'Source', 'Source Type',
      'Subscription Revenue', 'Services Revenue', 'Taxable Value',
      'CGST', 'SGST', 'IGST', 'Total GST', 'Incl. Total'
    ];
    const rows = data.map(r => [
      r.date,
      r.narration,
      r.source,
      r.sourceType,
      r.subscriptionRevenue,
      r.servicesRevenue,
      r.taxableValue,
      r.cgst,
      r.sgst,
      r.igst,
      r.totalGst,
      r.inclusiveTotal,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gst-collected-${from}-to-${to}.csv`;
    link.click();
  };

  const filteredData = search
    ? data.filter(r =>
        r.narration?.toLowerCase().includes(search.toLowerCase()) ||
        r.source?.toLowerCase().includes(search.toLowerCase()) ||
        r.sourceType?.toLowerCase().includes(search.toLowerCase())
      )
    : data;

  const paginatedData = filteredData.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ mb: 0 }}>GST Collected Report (GSTR-1 Ready)</Typography>
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
            <MobileTextField
              select
              label="Revenue Type"
              value={revenueType}
              onChange={e => setRevenueType(e.target.value)}
              options={[
                { value: 'all', label: 'All' },
                { value: 'subscription', label: 'Subscription' },
                { value: 'platform_sync', label: 'Platform Sync' },
              ]}
            />
            <MobileTextField
              placeholder="Search narration..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              label="Search"
              size="small"
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
              }}
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
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant={isMobile ? 'h6' : 'h6'}>
            GST Collected - {totals.total ? formatCurrency(totals.total) : '₹0'}
          </Typography>
          <MobileStack gap={1} direction="row" flexWrap="wrap">
            <MobileButton
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={data.length === 0}
            >
              Export CSV (GSTR-1)
            </MobileButton>
            <MobileButton variant="outlined" startIcon={<FilterListIcon />}>
              Advanced Filters
            </MobileButton>
          </MobileStack>
        </Box>

        <ResponsiveTableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Narration</TableCell>
                <TableCell align="right">Sub. Revenue</TableCell>
                <TableCell align="right">Svc. Revenue</TableCell>
                <TableCell align="right">Taxable Value</TableCell>
                <TableCell align="right">CGST</TableCell>
                <TableCell align="right">SGST</TableCell>
                <TableCell align="right">IGST</TableCell>
                <TableCell align="right">Total GST</TableCell>
                <TableCell align="right">Incl. Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.map((row) => (
                <React.Fragment key={row.journalEntryId}>
                  <TableRow
                    sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                    onClick={() => setExpandedRow(expandedRow === row.journalEntryId ? null : row.journalEntryId)}
                  >
                    <TableCell>{row.date}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="textSecondary">
                        {row.sourceType} · {row.source}
                      </Typography>
                      <Typography variant="body2">{row.narration}</Typography>
                    </TableCell>
                    <TableCell align="right">{formatCurrency(row.subscriptionRevenue)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.servicesRevenue)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.taxableValue)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.cgst)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.sgst)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.igst)}</TableCell>
                    <TableCell align="right"><strong>{formatCurrency(row.totalGst)}</strong></TableCell>
                    <TableCell align="right"><strong>{formatCurrency(row.inclusiveTotal)}</strong></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={10} padding="none">
                      <Collapse in={expandedRow === row.journalEntryId} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 3, bgcolor: 'grey.50' }}>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="body2" color="textSecondary">Journal Entry ID</Typography>
                              <Typography variant="body2" fontFamily="monospace">{row.journalEntryId}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="body2" color="textSecondary">Source / Type</Typography>
                              <Typography variant="body2">{row.source} / {row.sourceType}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="body2" color="textSecondary">Date</Typography>
                              <Typography variant="body2">{row.date}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="body2" color="textSecondary">Full Narration</Typography>
                              <Typography variant="body2">{row.narration}</Typography>
                            </Grid>
                          </Grid>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>
                <TableCell colSpan={2}>TOTALS</TableCell>
                <TableCell align="right">{formatCurrency(totals.subscriptionRevenue || 0)}</TableCell>
                <TableCell align="right">{formatCurrency(totals.servicesRevenue || 0)}</TableCell>
                <TableCell align="right">{formatCurrency(totals.taxableValue || 0)}</TableCell>
                <TableCell align="right">{formatCurrency(totals.cgst || 0)}</TableCell>
                <TableCell align="right">{formatCurrency(totals.sgst || 0)}</TableCell>
                <TableCell align="right">{formatCurrency(totals.igst || 0)}</TableCell>
                <TableCell align="right"><strong>{formatCurrency(totals.totalGst || 0)}</strong></TableCell>
                <TableCell align="right"><strong>{formatCurrency(totals.inclusiveTotal || 0)}</strong></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </ResponsiveTableContainer>

        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, p) => setPage(p)}
          onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        />

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </MobilePaper>
    </Box>
  );
}