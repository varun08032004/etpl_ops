import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
  Tabs, Tab, Grid, IconButton, Divider, Tooltip, LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
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

const CATEGORY_COLOR = {
  cloud_infrastructure: 'primary',
  saas_productivity: 'info',
  monitoring_observability: 'warning',
  data_analytics: 'secondary',
  crm_sales: 'success',
  design_creative: 'warning',
  payments_finance: 'info',
  hr_operations: 'primary',
  communication: 'success',
  other: 'default',
};

const STATUS_COLOR = { above_market: 'error', at_market: 'warning', below_market: 'success' };

function formatINR(amount) {
  if (!amount) return '₹0';
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)}Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function VendorIntelligence() {
  const isMobile = useMobile();
  const [vendors, setVendors] = useState([]);
  const [stats, setStats] = useState({});
  const [duplicates, setDuplicates] = useState([]);
  const [renewals, setRenewals] = useState([]);
  const [benchmarks, setBenchmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [negotiationOpen, setNegotiationOpen] = useState(false);
  const [negotiationPack, setNegotiationPack] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [vendorsRes, statsRes, duplicatesRes, renewalsRes, benchmarksRes] = await Promise.all([
        client.get('/vendor-intelligence?months=12'),
        client.get('/vendor-intelligence/dashboard'),
        client.get('/vendor-intelligence/duplicates'),
        client.get('/vendor-intelligence/renewals?months=6'),
        client.get('/vendor-intelligence/benchmarks'),
      ]);
      setVendors(vendorsRes.data.vendors);
      setStats(statsRes.data);
      setDuplicates(duplicatesRes.data.duplicates);
      setRenewals(renewalsRes.data.renewals);
      setBenchmarks(benchmarksRes.data.comparisons);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load vendor intelligence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openDetail = (v) => {
    setSelectedVendor(v);
    setDetailOpen(true);
  };

  const openNegotiation = async (vendorName) => {
    try {
      const res = await client.get(`/vendor-intelligence/negotiation/${vendorName}`);
      setNegotiationPack(res.data);
      setNegotiationOpen(true);
    } catch (err) {
      alert('Failed to load negotiation pack');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const TABS = ['Overview', 'Spend Analysis', 'Duplicates', 'Renewals', 'Benchmarks', 'Savings'];

  if (loading) return <MobileStack gap={2}><Typography>Loading vendor intelligence…</Typography></MobileStack>;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Vendor Spend Intelligence</Typography>
        <MobileButton variant="outlined" onClick={load} startIcon={<RefreshIcon />}>Refresh</MobileButton>
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Savings Summary */}
      <MobileCardGrid sx={{ mb: 3 }}>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Total Potential Savings</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'success.main' }}>
            {formatINR(stats.savings)}
          </Typography>
          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Annual</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Benchmark Savings</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'primary.main' }}>
            {formatINR(stats.benchmark_savings)}
          </Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Consolidation Savings</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'warning.main' }}>
            {formatINR(stats.consolidation_savings)}
          </Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Renewal Risk</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'error.main' }}>
            {formatINR(stats.renewal_risk)}
          </Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Duplicate Vendors</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.duplicate_count || 0}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Upcoming Renewals</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'warning.main' }}>{stats.upcoming_renewals || 0}</Typography>
        </MobilePaper>
      </MobileCardGrid>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        {['Overview', 'Spend Analysis', 'Duplicates', 'Renewals', 'Benchmarks', 'Savings'].map((t) => <Tab key={t} label={t} />)}
      </Tabs>

      {/* OVERVIEW */}
      {tab === 0 && (
        <Box>
          {/* Top Opportunities */}
          <MobilePaper sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Top Savings Opportunities</Typography>
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Current Spend</TableCell>
                    <TableCell align="right">Benchmark</TableCell>
                    <TableCell align="right">Potential Savings</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.top_opportunities?.slice(0, 10).map((c) => (
                    <TableRow key={c.vendor}>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.vendor}</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                          <Chip size="small" label={c.category} color={CATEGORY_COLOR[c.category] || 'default'} variant="outlined" />
                        </Typography>
                      </TableCell>
                      <TableCell><Chip size="small" label={c.category} color={CATEGORY_COLOR[c.category] || 'default'} variant="outlined" /></TableCell>
                      <TableCell align="right" className="figure">{formatINR(c.current_spend)}</TableCell>
                      <TableCell align="right" className="figure">{formatINR(c.benchmark_p50)}</TableCell>
                      <TableCell align="right" className="figure" sx={{ color: 'success.main', fontWeight: 600 }}>
                        {formatINR(c.potential_savings)}
                      </TableCell>
                      <TableCell align="right">
                        <MobileButton size="small" variant="outlined" onClick={() => {}}>Negotiate</MobileButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </MobilePaper>

          {/* Upcoming Renewals */}
          <MobilePaper>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Upcoming Renewals (60 days)</Typography>
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Days Left</TableCell>
                    <TableCell align="right">Annual Spend</TableCell>
                    <TableCell>Leverage</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.upcoming_renewals_detail?.slice(0, 10).map((r) => (
                    <TableRow key={r.vendor}>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.vendor}</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{r.category}</Typography>
                      </TableCell>
                      <TableCell className="figure" sx={{ color: r.days_left <= 30 ? 'error.main' : r.days_left <= 60 ? 'warning.main' : 'inherit', fontWeight: 600 }}>
                        {r.days_left}d
                      </TableCell>
                      <TableCell align="right" className="figure">{formatINR(r.annual_spend)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={r.leverage} color={r.leverage === 'high' ? 'success' : r.leverage === 'medium' ? 'warning' : 'default'} />
                      </TableCell>
                      <TableCell><Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{r.suggested_action}</Typography></TableCell>
                      <TableCell align="right">
                        <MobileButton size="small" onClick={() => openNegotiation(r.vendor)}>Prep Pack</MobileButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </MobilePaper>
        </Box>
      )}

      {/* SPEND ANALYSIS */}
      {tab === 1 && (
        <MobilePaper>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Vendor Spend Analysis (12 months)</Typography>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Total Spend</TableCell>
                  <TableCell align="right">Invoices</TableCell>
                  <TableCell align="right">Avg Invoice</TableCell>
                  <TableCell align="right">Monthly Avg</TableCell>
                  <TableCell>First Invoice</TableCell>
                  <TableCell>Last Invoice</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {vendors.slice(0, 50).map((v) => (
                  <TableRow key={v.canonical_name} hover onClick={() => openDetail(v)}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{v.canonical_name}</Typography>
                      {v.original_names.length > 1 && (
                        <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                          Also: {v.original_names.slice(1, 3).join(', ')}{v.original_names.length > 3 ? '...' : ''}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={v.category} color={CATEGORY_COLOR[v.category] || 'default'} variant="outlined" />
                    </TableCell>
                    <TableCell align="right" className="figure">{formatINR(v.total_spend)}</TableCell>
                    <TableCell align="right" className="figure">{v.invoice_count}</TableCell>
                    <TableCell align="right" className="figure">{formatINR(v.avg_invoice_amount)}</TableCell>
                    <TableCell align="right" className="figure">{formatINR(v.total_spend / 12)}</TableCell>
                    <TableCell className="figure" sx={{ fontSize: '0.8rem' }}>{v.first_invoice_date?.slice(0, 10)}</TableCell>
                    <TableCell className="figure" sx={{ fontSize: '0.8rem' }}>{v.last_invoice_date?.slice(0, 10)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="View details">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDetail(v); }}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Negotiation prep">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); openNegotiation(v.canonical_name); }}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {/* DUPLICATES */}
      {tab === 2 && (
        <MobilePaper>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Potential Duplicate Vendors ({duplicates.length})</Typography>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Vendor 1</TableCell>
                  <TableCell>Vendor 2</TableCell>
                  <TableCell align="center">Similarity</TableCell>
                  <TableCell align="right">Combined Spend</TableCell>
                  <TableCell>Recommendation</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {duplicates.map((d) => (
                  <TableRow key={`${d.vendor1.canonical_name}-${d.vendor2.canonical_name}`}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>{d.vendor1.canonical_name}</Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{formatINR(d.vendor1.total_spend)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>{d.vendor2.canonical_name}</Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{formatINR(d.vendor2.total_spend)}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={`${d.similarity}%`} color={d.similarity >= 95 ? 'error' : d.similarity >= 90 ? 'warning' : 'info'} variant="outlined" />
                    </TableCell>
                    <TableCell align="right" className="figure">{formatINR(d.combined_spend)}</TableCell>
                    <TableCell><Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{d.recommendation}</Typography></TableCell>
                    <TableCell align="right">
                      <MobileButton size="small" variant="outlined" onClick={() => {}}>Merge</MobileButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {/* RENEWALS */}
      {tab === 3 && (
        <MobilePaper>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Upcoming Renewals (6 months)</Typography>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Days Left</TableCell>
                  <TableCell>Est. Renewal</TableCell>
                  <TableCell align="right">Annual Spend</TableCell>
                  <TableCell>Leverage</TableCell>
                  <TableCell>Suggested Action</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {renewals.map((r) => (
                  <TableRow key={r.vendor}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.vendor}</Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                        <Chip size="small" label={r.category} color={CATEGORY_COLOR[r.category] || 'default'} variant="outlined" />
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={r.category} color={CATEGORY_COLOR[r.category] || 'default'} variant="outlined" />
                    </TableCell>
                    <TableCell align="right" className="figure" sx={{ fontWeight: 600, color: r.days_until_renewal <= 30 ? 'error.main' : r.days_until_renewal <= 60 ? 'warning.main' : 'inherit' }}>
                      {r.days_until_renewal}d
                    </TableCell>
                    <TableCell className="figure" sx={{ fontSize: '0.8rem' }}>{r.estimated_renewal}</TableCell>
                    <TableCell align="right" className="figure">{formatINR(r.annual_spend)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={r.negotiation_leverage.level} color={r.negotiation_leverage.level === 'high' ? 'success' : r.negotiation_leverage.level === 'medium' ? 'warning' : 'default'} />
                    </TableCell>
                    <TableCell><Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{r.suggested_action}</Typography></TableCell>
                    <TableCell align="right">
                      <MobileButton size="small" onClick={() => openNegotiation(r.vendor)}>Prep Pack</MobileButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {/* BENCHMARKS */}
      {tab === 4 && (
        <MobilePaper>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Benchmark Comparison</Typography>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Monthly Spend</TableCell>
                  <TableCell align="right">P50 Benchmark</TableCell>
                  <TableCell align="right">vs P50</TableCell>
                  <TableCell align="right">P75 Benchmark</TableCell>
                  <TableCell align="right">vs P75</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Savings</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {benchmarks.map((b) => (
                  <TableRow key={b.vendor}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{b.vendor}</Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                        <Chip size="small" label={b.category} color={CATEGORY_COLOR[b.category] || 'default'} variant="outlined" />
                      </Typography>
                    </TableCell>
                    <TableCell><Chip size="small" label={b.category} color={CATEGORY_COLOR[b.category] || 'default'} variant="outlined" /></TableCell>
                    <TableCell align="right" className="figure">{formatINR(b.monthly_spend)}</TableCell>
                    <TableCell align="right" className="figure">{formatINR(b.benchmark_p50)}</TableCell>
                    <TableCell align="right" className="figure" sx={{ color: b.vs_p50_pct > 0 ? 'error.main' : 'success.main' }}>
                      {b.vs_p50_pct > 0 ? '+' : ''}{b.vs_p50_pct}%
                    </TableCell>
                    <TableCell align="right" className="figure">{formatINR(b.benchmark_p75)}</TableCell>
                    <TableCell align="right" className="figure" sx={{ color: b.vs_p75_pct > 0 ? 'error.main' : 'success.main' }}>
                      {b.vs_p75_pct > 0 ? '+' : ''}{b.vs_p75_pct}%
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={b.status.replace('_', ' ')} color={STATUS_COLOR[b.status] || 'default'} variant="outlined" />
                    </TableCell>
                    <TableCell align="right" className="figure" sx={{ color: b.savings_opportunity > 0 ? 'success.main' : 'inherit' }}>
                      {formatINR(b.savings_opportunity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {/* SAVINGS */}
      {tab === 5 && (
        <Box>
          <MobilePaper sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Savings Breakdown</Typography>
            <MobileCardGrid>
              <MobilePaper>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Benchmark Savings</Typography>
                <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'primary.main' }}>
                  {formatINR(stats.benchmark_savings)}
                </Typography>
              </MobilePaper>
              <MobilePaper>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Consolidation</Typography>
                <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'warning.main' }}>
                  {formatINR(stats.consolidation_savings)}
                </Typography>
              </MobilePaper>
              <MobilePaper>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Renewal Risk</Typography>
                <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'error.main' }}>
                  {formatINR(stats.renewal_risk)}
                </Typography>
              </MobilePaper>
              <MobilePaper>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Total Potential</Typography>
                <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'success.main' }}>
                  {formatINR(stats.savings)}
                </Typography>
              </MobilePaper>
            </MobileCardGrid>
          </MobilePaper>

          {/* Top Savings */}
          <MobilePaper>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>Top Savings Opportunities</Typography>
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Current Monthly</TableCell>
                    <TableCell align="right">Market Rate</TableCell>
                    <TableCell align="right">Potential Savings</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.top_opportunities?.map((c) => (
                    <TableRow key={c.vendor}>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.vendor}</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                          <Chip size="small" label={c.category} color={CATEGORY_COLOR[c.category] || 'default'} variant="outlined" />
                        </Typography>
                      </TableCell>
                      <TableCell><Chip size="small" label={c.category} color={CATEGORY_COLOR[c.category] || 'default'} variant="outlined" /></TableCell>
                      <TableCell align="right" className="figure">{formatINR(c.current_spend)}</TableCell>
                      <TableCell align="right" className="figure">{formatINR(c.benchmark_p50)}</TableCell>
                      <TableCell align="right" className="figure" sx={{ color: 'success.main', fontWeight: 600 }}>
                        {formatINR(c.potential_savings)}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Generate negotiation pack">
                          <IconButton size="small" onClick={() => openNegotiation(c.vendor)}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </MobilePaper>
        </Box>
      )}

      {/* Vendor Detail Dialog */}
      <MobileDialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{selectedVendor?.canonical_name}</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <MobilePaper>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>Summary</Typography>
                <Typography><strong>Canonical:</strong> {selectedVendor?.canonical_name}</Typography>
                <Typography><strong>Category:</strong> <Chip size="small" label={selectedVendor?.category} color={CATEGORY_COLOR[selectedVendor?.category] || 'default'} /></Typography>
                <Typography><strong>Total Spend (24m):</strong> {formatINR(selectedVendor?.total_spend)}</Typography>
                <Typography><strong>Monthly Avg:</strong> {formatINR(selectedVendor?.total_spend / 12)}</Typography>
                <Typography><strong>Invoices:</strong> {selectedVendor?.invoice_count}</Typography>
                <Typography><strong>Avg Invoice:</strong> {formatINR(selectedVendor?.avg_invoice_amount)}</Typography>
              </MobilePaper>
            </Grid>
            <Grid item xs={12} sm={6}>
              <MobilePaper>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>Aliases</Typography>
                <Typography sx={{ fontSize: '0.85rem' }}>
                  {selectedVendor?.original_names?.join(', ')}
                </Typography>
              </MobilePaper>
            </Grid>
            <Grid item xs={12}>
              <MobileButton onClick={() => openNegotiation(selectedVendor?.canonical_name)} variant="contained" startIcon={<ContentCopyIcon />}>
                Generate Negotiation Pack
              </MobileButton>
            </Grid>
          </Grid>
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setDetailOpen(false)}>Close</MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      {/* Negotiation Pack Dialog */}
      <MobileDialog open={negotiationOpen} onClose={() => setNegotiationOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Negotiation Pack: {negotiationPack?.vendor}</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <MobilePaper>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>Leverage</Typography>
                <Chip size="medium" label={negotiationPack?.leverage?.level} color={negotiationPack?.leverage?.level === 'high' ? 'success' : negotiationPack?.leverage?.level === 'medium' ? 'warning' : 'default'} />
                <Typography sx={{ fontSize: '0.75rem', mt: 1, color: 'text.secondary' }}>Score: {negotiationPack?.leverage?.score}/100</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  {negotiationPack?.leverage?.factors?.join(', ')}
                </Typography>
              </MobilePaper>
            </Grid>
            <Grid item xs={12} sm={6}>
              <MobilePaper>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>Benchmark</Typography>
                <Typography><strong>Monthly Spend:</strong> {formatINR(negotiationPack?.monthly_spend)}</Typography>
                <Typography><strong>P50 Benchmark:</strong> {formatINR(negotiationPack?.benchmark?.p50)}</Typography>
                <Typography><strong>P75 Benchmark:</strong> {formatINR(negotiationPack?.benchmark?.p75)}</Typography>
                <Typography><strong>vs P50:</strong> {negotiationPack?.current_vs_benchmark?.p50_diff_pct}%</Typography>
              </MobilePaper>
            </Grid>
            <Grid item xs={12}>
              <MobilePaper>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>Negotiation Points</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {negotiationPack?.negotiation_points?.map((p, i) => (
                    <Typography key={i} sx={{ fontSize: '0.85rem', py: 0.5 }}>• {p}</Typography>
                  ))}
                </Box>
              </MobilePaper>
            </Grid>
            <Grid item xs={12}>
              <MobilePaper sx={{ border: '2px solid', borderColor: 'primary.main' }}>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>Recommended Ask</Typography>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: 'primary.main' }}>
                  {negotiationPack?.recommended_ask?.discount_pct}% discount
                </Typography>
                <Typography>{negotiationPack?.recommended_ask?.terms}</Typography>
                <Typography><strong>Est. Annual Savings:</strong> {formatINR(negotiationPack?.recommended_ask?.estimated_annual_savings)}</Typography>
                <MobileButton size="small" variant="outlined" onClick={() => copyToClipboard(
                  `Negotiation Pack for ${negotiationPack.vendor}:\n` +
                  `Ask: ${negotiationPack.recommended_ask.discount_pct}% discount\n` +
                  `Terms: ${negotiationPack.recommended_ask.terms}\n` +
                  `Savings: ${formatINR(negotiationPack.recommended_ask.estimated_annual_savings)}/yr\n\n` +
                  `Points:\n${negotiationPack.negotiation_points.map(p => '• ' + p).join('\n')}`
                )}>
                  Copy to Clipboard
                </MobileButton>
              </MobilePaper>
            </Grid>
          </Grid>
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setNegotiationOpen(false)}>Close</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}