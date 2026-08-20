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
import SpeedIcon from '@mui/icons-material/Speed';
import PeopleIcon from '@mui/icons-material/People';
import SourceIcon from '@mui/icons-material/Source';
import WarningIcon from '@mui/icons-material/Warning';
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

const STAGE_ORDER = ['new', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost'];
const STAGE_LABEL = { new: 'New', qualified: 'Qualified', proposal_sent: 'Proposal Sent', negotiation: 'Negotiation', won: 'Won', lost: 'Lost' };
const STAGE_COLOR = { new: 'default', qualified: 'info', proposal_sent: 'primary', negotiation: 'warning', won: 'success', lost: 'error' };

function ProgressBar({ value, color, size = 'small' }) {
  return (
    <Box sx={{ height: size === 'small' ? 6 : 10, borderRadius: 3, bgcolor: 'grey.800', overflow: 'hidden' }}>
      <Box sx={{ height: '100%', width: `${value}%`, bgcolor: color, borderRadius: 3, transition: 'width 0.3s ease' }} />
    </Box>
  );
}

export default function PipelineAnalytics() {
  const isMobile = useMobile();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [stalledThreshold, setStalledThreshold] = useState(30);
  const [stalledDeals, setStalledDeals] = useState([]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await client.get('/pipeline-analytics/dashboard');
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load pipeline analytics');
    } finally {
      setLoading(false);
    }
  };

  const loadStalled = async () => {
    try {
      const res = await client.get(`/pipeline-analytics/stalled?days=${stalledThreshold}`);
      setStalledDeals(res.data.deals);
    } catch (err) {
      console.error('[stalled]', err);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadStalled(); }, [stalledThreshold]);

  const TABS = ['Overview', 'Velocity', 'Reps', 'Sources', 'Forecast', 'Stalled', 'Win/Loss'];

  if (loading) return <MobileStack gap={2}><Typography>Loading pipeline analytics…</Typography></MobileStack>;

  const { velocity, conversion, reps, sources, forecast, winLoss } = data;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Deal Velocity & Pipeline Analytics</Typography>
        <MobileButton variant="outlined" onClick={load} startIcon={<RefreshIcon />}>Refresh</MobileButton>
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Overview Stats */}
      <MobileCardGrid sx={{ mb: 3 }}>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Total Pipeline</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {forecast?.summary?.totalPipeline ? `₹${(forecast.summary.totalPipeline / 1e7).toFixed(1)}Cr` : '—'}
          </Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Weighted Pipeline</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'primary.main' }}>
            {forecast?.summary?.weightedPipeline ? `₹${(forecast.summary.weightedPipeline / 1e7).toFixed(1)}Cr` : '—'}
          </Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Avg Days to Close</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {velocity?.length ? `${Math.round(velocity.reduce((a, b) => a + (b.avg_days || 0), 0) / velocity.length)}d` : '—'}
          </Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Stalled Deals</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'error.main' }}>
            {forecast?.summary?.atRisk || 0}
          </Typography>
        </MobilePaper>
      </MobileCardGrid>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        {TABS.map((t) => <Tab key={t} label={t} />)}
      </Tabs>

      {/* OVERVIEW TAB */}
      {tab === 0 && (
        <Box>
          {/* Funnel */}
          <MobilePaper sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Pipeline Funnel</Typography>
            <Grid container spacing={2} sx={{ px: 1 }}>
              {STAGE_ORDER.map((stage) => (
                <Grid item xs={12} sm={4} md={2} key={stage}>
                  <MobilePaper sx={{ textAlign: 'center', py: 2 }}>
                    <Chip size="small" label={STAGE_LABEL[stage]} color={STAGE_COLOR[stage]} variant="outlined" sx={{ mb: 1 }} />
                    <Typography className="figure" sx={{ fontSize: '2rem', fontWeight: 700, color: STAGE_COLOR[stage] }}>
                      {conversion?.funnel?.[stage] || 0}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{STAGE_LABEL[stage]}</Typography>
                    {conversion?.conversionRates?.[`${stage}_to_${STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1]}`] && (
                      <Typography sx={{ fontSize: '0.7rem', color: 'success.main', mt: 0.5 }}>
                        {conversion.conversionRates[`${stage}_to_${STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1]}`]}%
                      </Typography>
                    )}
                  </MobilePaper>
                </Grid>
              ))}
            </Grid>
          </MobilePaper>

          {/* Pipeline by Stage */}
          <MobilePaper>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Pipeline Value by Stage</Typography>
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Stage</TableCell>
                    <TableCell align="right">Deals</TableCell>
                    <TableCell align="right">Total Value</TableCell>
                    <TableCell align="right">Weighted Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {STAGE_ORDER.filter(s => s !== 'won' && s !== 'lost').map((stage) => (
                    <TableRow key={stage}>
                      <TableCell>
                        <Chip size="small" label={STAGE_LABEL[stage]} color={STAGE_COLOR[stage]} variant="outlined" />
                      </TableCell>
                      <TableCell align="right" className="figure">
                        {forecast?.deals?.filter(d => d.stage === stage).length || 0}
                      </TableCell>
                      <TableCell align="right" className="figure">
                        {forecast?.summary?.byStage?.[stage] ? `₹${(forecast.summary.byStage[stage] / 1e5).toFixed(1)}L` : '—'}
                      </TableCell>
                      <TableCell align="right" className="figure">
                        {forecast?.summary?.byStage?.[stage] ? `₹${((forecast.summary.byStage[stage] * (STAGE_PROBABILITY[stage] || 0)) / 1e5).toFixed(1)}L` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </MobilePaper>
        </Box>
      )}

      {/* VELOCITY TAB */}
      {tab === 1 && (
        <MobilePaper>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Deal Velocity by Stage (Avg Days)</Typography>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Stage</TableCell>
                  <TableCell align="right">Deals</TableCell>
                  <TableCell align="right">Avg Days</TableCell>
                  <TableCell align="right">Median Days</TableCell>
                  <TableCell align="right">Min</TableCell>
                  <TableCell align="right">Max</TableCell>
                  <TableCell align="right">Total Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {velocity?.map((v) => (
                  <TableRow key={v.stage}>
                    <TableCell><Chip size="small" label={STAGE_LABEL[v.stage]} color={STAGE_COLOR[v.stage]} variant="outlined" /></TableCell>
                    <TableCell align="right" className="figure">{v.deal_count}</TableCell>
                    <TableCell align="right" className="figure">{parseFloat(v.avg_days || 0).toFixed(1)}</TableCell>
                    <TableCell align="right" className="figure">{parseFloat(v.median_days || 0).toFixed(1)}</TableCell>
                    <TableCell align="right" className="figure">{v.min_days}</TableCell>
                    <TableCell align="right" className="figure">{v.max_days}</TableCell>
                    <TableCell align="right" className="figure">{v.total_value ? `₹${(v.total_value / 1e5).toFixed(1)}L` : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {/* REPS TAB */}
      {tab === 2 && (
        <MobilePaper>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Rep Performance (12 months)</Typography>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Rep</TableCell>
                  <TableCell align="right">Total Deals</TableCell>
                  <TableCell align="right">Won</TableCell>
                  <TableCell align="right">Win Rate</TableCell>
                  <TableCell align="right">Avg Deal Size</TableCell>
                  <TableCell align="right">Total Revenue</TableCell>
                  <TableCell align="right">Avg Days to Close</TableCell>
                  <TableCell align="right">Inbound</TableCell>
                  <TableCell align="right">Outbound</TableCell>
                  <TableCell align="right">Referral</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reps?.map((r) => (
                  <TableRow key={r.rep_id}>
                    <TableCell><Typography sx={{ fontWeight: 600 }}>{r.rep_name}</Typography></TableCell>
                    <TableCell align="right" className="figure">{r.total_deals}</TableCell>
                    <TableCell align="right" className="figure">{r.won_deals}</TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={`${r.winRate}%`} color={r.winRate >= 30 ? 'success' : r.winRate >= 15 ? 'warning' : 'error'} variant="outlined" />
                    </TableCell>
                    <TableCell align="right" className="figure">{r.avg_deal_size ? `₹${(r.avg_deal_size / 1e5).toFixed(1)}L` : '—'}</TableCell>
                    <TableCell align="right" className="figure">{r.total_revenue ? `₹${(r.total_revenue / 1e7).toFixed(1)}Cr` : '—'}</TableCell>
                    <TableCell align="right" className="figure">{r.avg_days_to_close ? `${parseFloat(r.avg_days_to_close).toFixed(1)}d` : '—'}</TableCell>
                    <TableCell align="right" className="figure">{r.inbound_deals}</TableCell>
                    <TableCell align="right" className="figure">{r.outbound_deals}</TableCell>
                    <TableCell align="right" className="figure">{r.referral_deals}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {/* SOURCES TAB */}
      {tab === 3 && (
        <MobilePaper>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Source Performance</Typography>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Source</TableCell>
                  <TableCell align="right">Total Deals</TableCell>
                  <TableCell align="right">Won</TableCell>
                  <TableCell align="right">Win Rate</TableCell>
                  <TableCell align="right">Avg Deal Size</TableCell>
                  <TableCell align="right">Total Revenue</TableCell>
                  <TableCell align="right">Avg Days to Close</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sources?.map((s) => (
                  <TableRow key={s.source}>
                    <TableCell><Typography sx={{ fontWeight: 600, textTransform: 'capitalize' }}>{s.source}</Typography></TableCell>
                    <TableCell align="right" className="figure">{s.total_deals}</TableCell>
                    <TableCell align="right" className="figure">{s.won}</TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={`${s.winRate}%`} color={s.winRate >= 30 ? 'success' : s.winRate >= 15 ? 'warning' : 'error'} variant="outlined" />
                    </TableCell>
                    <TableCell align="right" className="figure">{s.avg_deal_size ? `₹${(s.avg_deal_size / 1e5).toFixed(1)}L` : '—'}</TableCell>
                    <TableCell align="right" className="figure">{s.total_revenue ? `₹${(s.total_revenue / 1e7).toFixed(1)}Cr` : '—'}</TableCell>
                    <TableCell align="right" className="figure">{s.avg_days_to_close ? `${parseFloat(s.avg_days_to_close).toFixed(1)}d` : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {/* FORECAST TAB */}
      {tab === 4 && (
        <Box>
          <MobilePaper sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Pipeline Forecast</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <MobilePaper>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Total Pipeline</Typography>
                  <Typography className="figure" sx={{ fontSize: '2rem', fontWeight: 700 }}>
                    {forecast?.summary?.totalPipeline ? `₹${(forecast.summary.totalPipeline / 1e7).toFixed(1)}Cr` : '—'}
                  </Typography>
                </MobilePaper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <MobilePaper>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Weighted Pipeline</Typography>
                  <Typography className="figure" sx={{ fontSize: '2rem', fontWeight: 700, color: 'primary.main' }}>
                    {forecast?.summary?.weightedPipeline ? `₹${(forecast.summary.weightedPipeline / 1e7).toFixed(1)}Cr` : '—'}
                  </Typography>
                </MobilePaper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <MobilePaper>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>At Risk Deals</Typography>
                  <Typography className="figure" sx={{ fontSize: '2rem', fontWeight: 700, color: 'error.main' }}>
                    {forecast?.summary?.atRisk || 0}
                  </Typography>
                </MobilePaper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <MobilePaper>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>By Stage</Typography>
                  <MobileStack gap={1} sx={{ mt: 1 }}>
                    {STAGE_ORDER.filter(s => s !== 'won' && s !== 'lost').map((stage) => (
                      <MobilePaper key={stage} sx={{ px: 1.5, py: 1 }}>
                        <Grid container justifyContent="space-between">
                          <Grid item>
                            <Chip size="small" label={STAGE_LABEL[stage]} color={STAGE_COLOR[stage]} variant="outlined" />
                          </Grid>
                          <Grid item>
                            <Typography className="figure" sx={{ fontWeight: 600 }}>
                              {forecast?.summary?.byStage?.[stage] ? `₹${(forecast.summary.byStage[stage] / 1e5).toFixed(1)}L` : '—'}
                            </Typography>
                          </Grid>
                        </Grid>
                      </MobilePaper>
                    ))}
                  </MobileStack>
                </MobilePaper>
              </Grid>
            </Grid>
          </MobilePaper>

          {/* Top Deals */}
          <MobilePaper>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Top Pipeline Deals (Weighted)</Typography>
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Deal</TableCell>
                    <TableCell>Stage</TableCell>
                    <TableCell>Owner</TableCell>
                    <TableCell align="right">Value</TableCell>
                    <TableCell align="right">Probability</TableCell>
                    <TableCell align="right">Weighted</TableCell>
                    <TableCell align="right">Days in Stage</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {forecast?.deals?.slice(0, 20).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{d.company_name}</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{d.contact_name || ''}</Typography>
                      </TableCell>
                      <TableCell><Chip size="small" label={STAGE_LABEL[d.stage]} color={STAGE_COLOR[d.stage]} variant="outlined" /></TableCell>
                      <TableCell>{d.owner_name}</TableCell>
                      <TableCell align="right" className="figure">{d.deal_value ? `₹${(d.deal_value / 1e5).toFixed(1)}L` : '—'}</TableCell>
                      <TableCell align="right" className="figure">{(STAGE_PROBABILITY[d.stage] * 100).toFixed(0)}%</TableCell>
                      <TableCell align="right" className="figure">{d.weightedValue ? `₹${(d.weightedValue / 1e5).toFixed(1)}L` : '—'}</TableCell>
                      <TableCell align="right" className="figure">{d.daysInStage}d</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </MobilePaper>
        </Box>
      )}

      {/* STALLED TAB */}
      {tab === 5 && (
        <Box>
          <MobilePaper sx={{ mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item>
                <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Stalled Threshold:</Typography>
              </Grid>
              <Grid item>
                <MobileTextField
                  type="number"
                  label="Days"
                  value={stalledThreshold}
                  onChange={(e) => setStalledThreshold(parseInt(e.target.value) || 30)}
                  size="small"
                  sx={{ width: 120 }}
                />
              </Grid>
              <Grid item>
                <MobileButton variant="contained" onClick={loadStalled} startIcon={<RefreshIcon />}>Refresh</MobileButton>
              </Grid>
              <Grid item>
                <Tooltip title="Deals stuck in stage longer than threshold">
                  <IconButton size="small"><WarningIcon fontSize="small" color="warning" /></IconButton>
                </Tooltip>
              </Grid>
            </Grid>
          </MobilePaper>

          <MobilePaper>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>
              Stalled Deals (> {stalledThreshold} days in stage) — {stalledDeals.length} deals
            </Typography>
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Deal</TableCell>
                    <TableCell>Stage</TableCell>
                    <TableCell>Owner</TableCell>
                    <TableCell align="right">Value</TableCell>
                    <TableCell align="right">Days in Stage</TableCell>
                    <TableCell align="right">Source</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stalledDeals.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{d.company_name}</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{d.contact_name || ''}</Typography>
                      </TableCell>
                      <TableCell><Chip size="small" label={STAGE_LABEL[d.stage]} color={STAGE_COLOR[d.stage]} variant="outlined" /></TableCell>
                      <TableCell>{d.owner_name}</TableCell>
                      <TableCell align="right" className="figure">{d.deal_value ? `₹${(d.deal_value / 1e5).toFixed(1)}L` : '—'}</TableCell>
                      <TableCell align="right" className="figure">
                        <Typography sx={{ color: d.days_in_stage > 60 ? 'error.main' : d.days_in_stage > 30 ? 'warning.main' : 'inherit', fontWeight: 600 }}>
                          {parseFloat(d.days_in_stage).toFixed(1)}d
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{d.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </MobilePaper>
        </Box>
      )}

      {/* WIN/LOSS TAB */}
      {tab === 6 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <MobilePaper>
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Loss Reasons</Typography>
              <ResponsiveTableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Reason</TableCell>
                      <TableCell align="right">Count</TableCell>
                      <TableCell align="right">Avg Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {winLoss?.lossReasons?.map((r) => (
                      <TableRow key={r.lost_reason}>
                        <TableCell><Typography sx={{ fontWeight: 600 }}>{r.lost_reason}</Typography></TableCell>
                        <TableCell align="right" className="figure">{r.count}</TableCell>
                        <TableCell align="right" className="figure">{r.avg_value ? `₹${(r.avg_value / 1e5).toFixed(1)}L` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTableContainer>
            </MobilePaper>
          </Grid>
          <Grid item xs={12} md={6}>
            <MobilePaper>
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Win Drivers</Typography>
              <ResponsiveTableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Reason</TableCell>
                      <TableCell align="right">Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {winLoss?.winReasons?.map((r) => (
                      <TableRow key={r.lost_reason}>
                        <TableCell><Typography sx={{ fontWeight: 600 }}>{r.lost_reason}</Typography></TableCell>
                        <TableCell align="right" className="figure">{r.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTableContainer>
            </MobilePaper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

const STAGE_PROBABILITY = { new: 0.10, qualified: 0.25, proposal_sent: 0.50, negotiation: 0.75, won: 1.0, lost: 0.0 };