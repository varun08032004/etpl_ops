import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
  Tabs, Tab, Grid, IconButton, Divider, Tooltip, LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
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

const TIER_COLOR = { healthy: 'success', at_risk: 'warning', critical: 'error' };
const TIER_ICON = { healthy: '✅', at_risk: '⚠️', critical: '🔴' };

function ProgressBar({ value, color, size = 'small' }) {
  return (
    <Box sx={{ height: size === 'small' ? 6 : 10, borderRadius: 3, bgcolor: 'grey.800', overflow: 'hidden' }}>
      <Box
        sx={{
          height: '100%',
          width: `${value}%`,
          bgcolor: color,
          borderRadius: 3,
          transition: 'width 0.3s ease',
        }}
      />
    </Box>
  );
}

export default function HealthScores() {
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
        client.get('/health-scores'),
        client.get('/health-scores/dashboard'),
      ]);
      setScores(scoresRes.data.scores);
      setStats(statsRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load health scores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runScoring = async () => {
    try {
      const result = await client.post('/health-scores/run');
      alert(`Scored ${result.scored} customers`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to run scoring');
    }
  };

  const openDetail = async (s) => {
    try {
      const res = await client.get(`/health-scores/${s.customer_id}`);
      setSelectedScore(res.data);
      setDetailOpen(true);
    } catch (err) {
      alert('Failed to load details');
    }
  };

  const TIER_ORDER = { critical: 0, at_risk: 1, healthy: 2 };
  const TABS = ['All', 'Critical', 'At Risk', 'Healthy'];

  const filtered = scores.filter(s => {
    if (tab === 0) return true;
    if (tab === 1) return s.tier === 'critical';
    if (tab === 2) return s.tier === 'at_risk';
    if (tab === 3) return s.tier === 'healthy';
    return true;
  }).sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);

  if (loading) return <MobileStack gap={2}><Typography>Loading health scores…</Typography></MobileStack>;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Customer Health Scores</Typography>
        <MobileButton variant="outlined" onClick={runScoring} startIcon={<RefreshIcon />}>Refresh Scores</MobileButton>
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stats Cards */}
      <MobileCardGrid sx={{ mb: 3 }}>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Total Customers</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.total || 0}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Healthy</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'success.main' }}>{stats.healthy || 0}</Typography>
          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Avg: {stats.byCategory?.usage || 0}%</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>At Risk</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'warning.main' }}>{stats.at_risk || 0}</Typography>
          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Avg: {stats.byCategory?.support || 0}%</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Critical</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'error.main' }}>{stats.critical || 0}</Typography>
          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Avg: {stats.byCategory?.billing || 0}%</Typography>
        </MobilePaper>
      </MobileCardGrid>

      {/* Category Averages */}
      <MobilePaper sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1.5 }}>Category Averages</Typography>
        <Grid container spacing={2}>
          {[
            { key: 'usage', label: 'Usage (35%)', value: stats.byCategory?.usage || 0 },
            { key: 'support', label: 'Support (25%)', value: stats.byCategory?.support || 0 },
            { key: 'billing', label: 'Billing (25%)', value: stats.byCategory?.billing || 0 },
            { key: 'sentiment', label: 'Sentiment (15%)', value: stats.byCategory?.sentiment || 0 },
          ].map((cat) => (
            <Grid item xs={12} sm={6} md={3} key={cat.key}>
              <MobilePaper>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>{cat.label}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ProgressBar value={cat.value} color={cat.value >= 70 ? 'success.main' : cat.value >= 50 ? 'warning.main' : 'error.main'} size="medium" sx={{ flex: 1 }} />
                  <Typography className="figure" sx={{ fontSize: '1.25rem', fontWeight: 700, minWidth: 50 }}>{cat.value}%</Typography>
                </Box>
              </MobilePaper>
            </Grid>
          ))}
        </Grid>
      </MobilePaper>

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
                <TableCell align="center">Overall</TableCell>
                <TableCell align="center">Tier</TableCell>
                <TableCell align="center">Usage</TableCell>
                <TableCell align="center">Support</TableCell>
                <TableCell align="center">Billing</TableCell>
                <TableCell align="center">Sentiment</TableCell>
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
                  <TableCell align="center">
                    <Typography className="figure" sx={{ fontSize: '1.1rem', fontWeight: 700, color: s.overall_score >= 70 ? 'success.main' : s.overall_score >= 50 ? 'warning.main' : 'error.main' }}>
                      {s.overall_score}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={s.tier} color={TIER_COLOR[s.tier] || 'default'} icon={<Typography sx={{ fontSize: '0.7rem' }}>{TIER_ICON[s.tier]}</Typography>} />
                  </TableCell>
                  <TableCell align="center">
                    <ProgressBar value={s.category_scores?.usage || 0} color={s.category_scores?.usage >= 70 ? 'success.main' : s.category_scores?.usage >= 50 ? 'warning.main' : 'error.main'} />
                    <Typography sx={{ fontSize: '0.7rem', textAlign: 'center' }}>{s.category_scores?.usage || 0}%</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <ProgressBar value={s.category_scores?.support || 0} color={s.category_scores?.support >= 70 ? 'success.main' : s.category_scores?.support >= 50 ? 'warning.main' : 'error.main'} />
                    <Typography sx={{ fontSize: '0.7rem', textAlign: 'center' }}>{s.category_scores?.support || 0}%</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <ProgressBar value={s.category_scores?.billing || 0} color={s.category_scores?.billing >= 70 ? 'success.main' : s.category_scores?.billing >= 50 ? 'warning.main' : 'error.main'} />
                    <Typography sx={{ fontSize: '0.7rem', textAlign: 'center' }}>{s.category_scores?.billing || 0}%</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <ProgressBar value={s.category_scores?.sentiment || 0} color={s.category_scores?.sentiment >= 70 ? 'success.main' : s.category_scores?.sentiment >= 50 ? 'warning.main' : 'error.main'} />
                    <Typography sx={{ fontSize: '0.7rem', textAlign: 'center' }}>{s.category_scores?.sentiment || 0}%</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View details & recommendations">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDetail(s); }}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow>
                  <TableCell colSpan={10} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    No customers in this tier.
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
          {selectedScore?.company_name || selectedScore?.full_name || 'Customer Health Detail'}
          <Chip size="small" label={selectedScore?.tier} color={TIER_COLOR[selectedScore?.tier] || 'default'} sx={{ ml: 2 }} />
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={4}>
              <MobilePaper>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>Overall Health</Typography>
                <Typography className="figure" sx={{ fontSize: '3rem', fontWeight: 700, color: selectedScore.overall_score >= 70 ? 'success.main' : selectedScore.overall_score >= 50 ? 'warning.main' : 'error.main' }}>
                  {selectedScore.overall_score}/100
                </Typography>
                <Chip size="medium" label={selectedScore.tier} color={TIER_COLOR[selectedScore.tier] || 'default'} />
              </MobilePaper>
            </Grid>
            <Grid item xs={12} sm={8}>
              <MobilePaper>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>Category Breakdown</Typography>
                <Grid container spacing={2}>
                  {['usage', 'support', 'billing', 'sentiment'].map((cat) => (
                    <Grid item xs={12} sm={6} md={3} key={cat}>
                      <MobilePaper>
                        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', textTransform: 'uppercase', mb: 0.5 }}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)} {cat === 'usage' ? '(35%)' : cat === 'support' ? '(25%)' : cat === 'billing' ? '(25%)' : '(15%)'}
                        </Typography>
                        <ProgressBar value={selectedScore.category_scores?.[cat] || 0} color={selectedScore.category_scores?.[cat] >= 70 ? 'success.main' : selectedScore.category_scores?.[cat] >= 50 ? 'warning.main' : 'error.main'} size="medium" sx={{ mb: 0.5 }} />
                        <Typography className="figure" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>{selectedScore.category_scores?.[cat] || 0}%</Typography>
                      </MobilePaper>
                    </Grid>
                  ))}
                </Grid>
              </MobilePaper>
            </Grid>

            {/* Recommendations */}
            {selectedScore.recommendations?.length > 0 && (
              <Grid item xs={12}>
                <MobilePaper>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>Recommended Actions</Typography>
                  <MobileStack gap={1.5}>
                    {selectedScore.recommendations.map((rec, i) => (
                      <MobilePaper key={i} sx={{ px: 2, py: 1.5, borderLeft: `4px solid ${rec.priority === 'high' ? '#e5484d' : '#e5a54b'}` }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                          <Typography sx={{ fontWeight: 600 }}>{rec.area}</Typography>
                          <Chip size="small" label={rec.priority} color={rec.priority === 'high' ? 'error' : 'warning'} />
                        </Box>
                        <Typography sx={{ fontSize: '0.85rem', mb: 0.5 }}>{rec.action}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{rec.reason}</Typography>
                      </MobilePaper>
                    ))}
                  </MobileStack>
                </MobilePaper>
              </Grid>
            )}

            {/* Signals */}
            <Grid item xs={12}>
              <MobilePaper>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>Raw Signals</Typography>
                <Grid container spacing={2}>
                  {Object.entries(selectedScore.signals || {}).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => (
                    <Grid item xs={12} sm={6} md={3} key={k}>
                      <MobilePaper sx={{ py: 1 }}>
                        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', textTransform: 'uppercase' }}>{k}</Typography>
                        <Typography className="figure" sx={{ fontSize: '1.25rem', fontWeight: 600 }}>{typeof v === 'number' ? v.toFixed(1) : v}</Typography>
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