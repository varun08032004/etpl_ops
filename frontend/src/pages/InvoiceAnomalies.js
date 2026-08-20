import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
  Tabs, Tab, Grid, IconButton, Divider, Tooltip, LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FilterListIcon from '@mui/icons-material/FilterList';
import client from '../api/client';
import {
  MobilePaper,
  MobilePageHeader,
  MobileButton,
  MobileTextField,
  MobileDialog,
  MobileFormGrid,
  MobileActionButtons,
  MobileStack,
  ResponsiveTableContainer,
  MobileCardGrid,
  useMobile,
} from '../components/MobileResponsive';

const SEVERITY_COLOR = { critical: 'error', high: 'error', medium: 'warning', low: 'info' };
const SEVERITY_ICON = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };

function formatINR(amount) {
  if (!amount) return '₹0';
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)}Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function InvoiceAnomalies() {
  const isMobile = useMobile();
  const [anomalies, setAnomalies] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterType, setFilterType] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [anomaliesRes, statsRes] = await Promise.all([
        client.get('/invoice-anomalies'),
        client.get('/invoice-anomalies/dashboard'),
      ]);
      setAnomalies(anomaliesRes.data.anomalies);
      setStats(statsRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load anomalies');
    } finally {
      setLoading(false);
    }
  };

  const runDetection = async () => {
    try {
      const result = await client.post('/invoice-anomalies/run');
      alert(`Detection complete: ${result.total} anomalies (${result.bySeverity.critical?.length || 0} critical, ${result.bySeverity.high?.length || 0} high)`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to run detection');
    }
  };

  useEffect(() => { load(); }, []);

  const openDetail = (a) => {
    setSelectedAnomaly(a);
    setDetailOpen(true);
  };

  const TABS = ['All', 'Critical', 'High', 'Medium', 'Low'];

  const filtered = anomalies.filter(a => {
    if (tab === 0) return true;
    if (tab === 1) return a.severity === 'critical';
    if (tab === 2) return a.severity === 'high';
    if (tab === 3) return a.severity === 'medium';
    if (tab === 4) return a.severity === 'low';
    return true;
  });

  if (loading) return <MobileStack gap={2}><Typography>Loading anomalies…</Typography></MobileStack>;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Invoice Anomaly Detection</Typography>
        <MobileButton variant="contained" onClick={runDetection} startIcon={<RefreshIcon />}>Run Detection</MobileButton>
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stats Cards */}
      <MobileCardGrid sx={{ mb: 3 }}>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Total</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.total || 0}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Critical</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'error.main' }}>{stats.critical || 0}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>High</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'error.main' }}>{stats.high || 0}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Medium</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'warning.main' }}>{stats.medium || 0}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Low</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'info.main' }}>{stats.low || 0}</Typography>
        </MobilePaper>
      </MobileCardGrid>

      {/* Type Breakdown */}
      {Object.keys(stats.byType || {}).length > 0 && (
        <MobilePaper sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1.5 }}>By Type</Typography>
          <MobileStack direction="row" gap={1.5} flexWrap="wrap">
            {Object.entries(stats.byType).map(([type, count]) => (
              <Chip key={type} label={`${type.replace(/_/g, ' ')}: ${count}`} variant="outlined" size="small" />
            ))}
          </MobileStack>
        </MobilePaper>
      )}

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        {['All', 'Critical', 'High', 'Medium', 'Low'].map((t) => <Tab key={t} label={t} />)}
      </Tabs>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Invoice</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="center">Severity</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={`${a.invoiceId}-${a.type}`} hover onClick={() => openDetail(a)}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.invoiceNumber}</Typography>
                  </TableCell>
                  <TableCell>{a.vendorName}</TableCell>
                  <TableCell align="right" className="figure">{formatINR(a.data?.invoiceAmount || a.amount)}</TableCell>
                  <TableCell className="figure" sx={{ fontSize: '0.8rem' }}>{a.invoiceDate?.slice(0, 10) || a.createdAt?.slice(0, 10)}</TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={a.severity} color={SEVERITY_COLOR[a.severity]} icon={<Typography sx={{ fontSize: '0.6rem' }}>{SEVERITY_ICON[a.severity]}</Typography>} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={a.type.replace(/_/g, ' ')} variant="outlined" />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View details">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDetail(a); }}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    No anomalies in this severity level.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      {/* Detail Dialog */}
      <MobileDialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {selectedAnomaly?.invoiceNumber} — {selectedAnomaly?.type?.replace(/_/g, ' ')}
          <Chip size="small" label={selectedAnomaly?.severity} color={SEVERITY_COLOR[selectedAnomaly?.severity]} sx={{ ml: 2 }} />
        </DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 1 }}>
            <MobileTextField fullWidth label="Invoice" value={selectedAnomaly?.invoiceNumber} disabled />
            <MobileTextField fullWidth label="Vendor" value={selectedAnomaly?.vendorName} disabled />
            <MobileTextField fullWidth label="Amount" value={formatINR(selectedAnomaly?.data?.invoiceAmount)} disabled />
            <MobileTextField fullWidth label="Severity" value={selectedAnomaly?.severity} disabled />
            <MobileTextField fullWidth label="Type" value={selectedAnomaly?.type?.replace(/_/g, ' ')} disabled />
            <MobileTextField fullWidth multiline rows={3} label="Description" value={selectedAnomaly?.description} disabled />
          </MobileFormGrid>

          {selectedAnomaly?.data && Object.keys(selectedAnomaly.data).length > 0 && (
            <MobilePaper sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>Details</Typography>
              <Grid container spacing={2}>
                {Object.entries(selectedAnomaly.data).filter(([, v]) => v !== null).map(([k, v]) => (
                  <Grid item xs={12} sm={6} md={4} key={k}>
                    <MobilePaper sx={{ py: 1 }}>
                      <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', textTransform: 'uppercase' }}>{k}</Typography>
                      <Typography className="figure" sx={{ fontSize: '1rem', fontWeight: 600 }}>{typeof v === 'number' ? v.toFixed(2) : v}</Typography>
                    </MobilePaper>
                  </Grid>
                ))}
              </Grid>
            </MobilePaper>
          )}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setDetailOpen(false)}>Close</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}

function formatINR(amount) {
  if (!amount) return '₹0';
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)}Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}