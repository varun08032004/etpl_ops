import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
  Tabs, Tab, Grid, IconButton, Divider, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
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

const RISK_COLOR = { low: 'success', medium: 'warning', high: 'error', critical: 'error' };
const RISK_ICON = { low: '✅', medium: '⚠️', high: '🚨', critical: '🔴' };

export default function ChurnPrediction() {
  const isMobile = useMobile();
  const [scores, setScores] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [selectedScore, setSelectedScore] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [scoresRes, statsRes] = await Promise.all([
        client.get('/churn-prediction'),
        client.get('/churn-prediction/dashboard'),
      ]);
      setScores(scoresRes.data.scores);
      setStats(statsRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load churn scores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runScoring = async () => {
    try {
      const result = await client.post('/churn-prediction/run');
      alert(`Scored ${result.scored} customers. High risk: ${result.highRisk}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to run scoring');
    }
  };

  const openDetail = (s) => {
    setSelectedScore(s);
    setDetailOpen(true);
  };

  const TABS = ['All', 'Critical', 'High', 'Medium', 'Low'];

  const filtered = scores.filter(s => {
    if (tab === 0) return true;
    if (tab === 1) return s.risk_level === 'critical';
    if (tab === 2) return s.risk_level === 'high';
    if (tab === 3) return s.risk_level === 'medium';
    if (tab === 4) return s.risk_level === 'low';
    return true;
  });

  if (loading) return <MobileStack gap={2}><Typography>Loading churn predictions…</Typography></MobileStack>;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>AI Churn Prediction</Typography>
        <MobileButton variant="outlined" onClick={runScoring} startIcon={<RefreshIcon />}>Run Scoring Now</MobileButton>
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stats Cards */}
      <MobileCardGrid sx={{ mb: 3 }}>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Total Scored</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.total || 0}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Critical Risk</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'error.main' }}>{stats.critical || 0}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>High Risk</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'error.main' }}>{stats.high || 0}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Avg Score</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.avgScore || 0}/100</Typography>
        </MobilePaper>
      </MobileCardGrid>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        {TABS.map((t) => <Tab key={t} label={t} />)}
      </Tabs>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Renewal</TableCell>
                <TableCell>Seats</TableCell>
                <TableCell align="center">Score</TableCell>
                <TableCell align="center">Risk Level</TableCell>
                <TableCell align="center">Key Signals</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.customer_id} hover onClick={() => openDetail(s)}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {s.company_name || s.full_name || s.email}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{s.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={s.subscription_plan} color={s.subscription_plan === 'corporate' ? 'warning' : 'default'} variant="outlined" />
                  </TableCell>
                  <TableCell className="figure" sx={{ fontSize: '0.8rem' }}>{s.subscription_renewal_date || '—'}</TableCell>
                  <TableCell className="figure" sx={{ fontSize: '0.8rem' }}>{s.seats || '—'}</TableCell>
                  <TableCell align="center">
                    <Typography className="figure" sx={{ fontSize: '1.1rem', fontWeight: 700, color: s.score >= 85 ? 'error.main' : s.score >= 70 ? 'error.main' : s.score >= 50 ? 'warning.main' : s.score >= 30 ? 'info.main' : 'success.main' }}>
                      {s.score}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={s.risk_level} color={RISK_COLOR[s.risk_level] || 'default'} icon={<Typography sx={{ fontSize: '0.7rem' }}>{RISK_ICON[s.risk_level]}</Typography>} />
                  </TableCell>
                  <TableCell align="center">
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                      {Object.entries(s.signals || {}).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(1) : v}`).join(' • ')}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View details">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDetail(s); }}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    No customers in this risk category.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      {/* Detail Dialog */}
      <MobileDialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{selectedScore?.company_name || selectedScore?.full_name || 'Customer Details'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <MobilePaper>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>Churn Score</Typography>
                <Typography className="figure" sx={{ fontSize: '3rem', fontWeight: 700, color: selectedScore.score >= 85 ? 'error.main' : selectedScore.score >= 70 ? 'error.main' : selectedScore.score >= 50 ? 'warning.main' : selectedScore.score >= 30 ? 'info.main' : 'success.main' }}>
                  {selectedScore.score}/100
                </Typography>
                <Chip size="medium" label={selectedScore.risk_level} color={RISK_COLOR[selectedScore.risk_level] || 'default'} />
              </MobilePaper>
            </Grid>
            <Grid item xs={12} sm={6}>
              <MobilePaper>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>Customer Info</Typography>
                <Typography><strong>Email:</strong> {selectedScore.email}</Typography>
                <Typography><strong>Plan:</strong> {selectedScore.subscription_plan}</Typography>
                <Typography><strong>Seats:</strong> {selectedScore.seats}</Typography>
                <Typography><strong>Renewal:</strong> {selectedScore.subscription_renewal_date || '—'}</Typography>
              </MobilePaper>
            </Grid>
            <Grid item xs={12}>
              <MobilePaper>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>Signals</Typography>
                <Grid container spacing={2}>
                  {Object.entries(selectedScore.signals || {}).filter(([, v]) => v !== null).map(([k, v]) => (
                    <Grid item xs={12} sm={6} md={4} key={k}>
                      <MobilePaper sx={{ py: 1 }}>
                        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', textTransform: 'uppercase' }}>{k}</Typography>
                        <Typography className="figure" sx={{ fontSize: '1.25rem', fontWeight: 600 }}>{typeof v === 'number' ? v.toFixed(2) : v}</Typography>
                      </MobilePaper>
                    </Grid>
                  ))}
                </Grid>
              </MobilePaper>
            </Grid>
          </Grid>
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setDetailOpen(false)}>Close</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}