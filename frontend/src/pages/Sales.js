import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, IconButton, Divider, Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
  Tabs, Tab, CircularProgress, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import client from '../api/client';
import Money from '../components/Money';
import StatusChip from '../components/StatusChip';

const STAGES = [
  { key: 'new', label: 'New' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'proposal_sent', label: 'Proposal Sent' },
  { key: 'negotiation', label: 'Negotiation' },
];

const emptyDealForm = { company_name: '', contact_name: '', contact_email: '', contact_phone: '', source: '', deal_value: '', expected_close_date: '', notes: '' };
const emptyQuoteItem = { description: '', quantity: 1, unit_price: '' };

function DealCard({ deal, onOpen }) {
  return (
    <Paper onClick={() => onOpen(deal)} sx={{ p: 1.75, mb: 1.5, cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{deal.company_name}</Typography>
      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1 }}>{deal.contact_name || 'No contact set'}</Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Money amount={deal.deal_value} size="0.9rem" />
        <Chip size="small" label={`${deal.probability_percent}%`} variant="outlined" />
      </Box>
    </Paper>
  );
}

function PipelineBoard({ deals, onOpen, onNewDeal }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
      {STAGES.map((s) => {
        const stageDeals = deals.filter((d) => d.stage === s.key);
        const stageTotal = stageDeals.reduce((sum, d) => sum + Number(d.deal_value), 0);
        return (
          <Box key={s.key} sx={{ minWidth: 260, flex: '0 0 260px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {s.label} · {stageDeals.length}
              </Typography>
              {s.key === 'new' && (
                <IconButton size="small" onClick={onNewDeal}><AddIcon fontSize="small" /></IconButton>
              )}
            </Box>
            <Typography className="figure" sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1.5, px: 0.5 }}>
              <Money amount={stageTotal} size="0.75rem" />
            </Typography>
            {stageDeals.map((d) => <DealCard key={d.id} deal={d} onOpen={onOpen} />)}
            {!stageDeals.length && <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', px: 0.5 }}>No deals</Typography>}
          </Box>
        );
      })}
    </Box>
  );
}

function DealDetail({ dealId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteItems, setQuoteItems] = useState([{ ...emptyQuoteItem }]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [lostDialogOpen, setLostDialogOpen] = useState(false);

  const load = () => client.get(`/sales/deals/${dealId}`).then(({ data }) => setData(data));
  useEffect(() => { load(); }, [dealId]);

  if (!data) return null;
  const { deal, quotations, tasks } = data;

  const moveStage = async (stage) => {
    await client.post(`/sales/deals/${dealId}/move-stage`, { stage });
    load(); onChanged();
  };

  const markWon = async () => {
    await client.post(`/sales/deals/${dealId}/mark-won`);
    load(); onChanged();
  };

  const markLost = async () => {
    await client.post(`/sales/deals/${dealId}/mark-lost`, { reason: lostReason });
    setLostDialogOpen(false);
    load(); onChanged();
  };

  const subtotal = quoteItems.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.unit_price || 0)), 0);
  const total = subtotal - (subtotal * discountPercent / 100);

  const createQuote = async () => {
    setSaving(true);
    setError('');
    try {
      const { data: res } = await client.post(`/sales/deals/${dealId}/quotations`, {
        items: quoteItems, discount_percent: discountPercent,
      });
      setQuoteOpen(false);
      setQuoteItems([{ ...emptyQuoteItem }]);
      setDiscountPercent(0);
      if (res.note) setError(res.note);
      load(); onChanged();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create quote');
    } finally {
      setSaving(false);
    }
  };

  const approveQuote = async (quoteId) => { await client.post(`/sales/quotations/${quoteId}/approve`); load(); };
  const sendQuote = async (quoteId) => { await client.post(`/sales/quotations/${quoteId}/send`); load(); onChanged(); };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {deal.company_name}
        <StatusChip status={deal.stage} />
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6}><Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Value</Typography><Money amount={deal.deal_value} size="1.05rem" /></Grid>
          <Grid item xs={6}><Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Contact</Typography><Typography>{deal.contact_name || '—'} {deal.contact_email ? `(${deal.contact_email})` : ''}</Typography></Grid>
        </Grid>

        {deal.stage !== 'won' && deal.stage !== 'lost' && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2.5 }}>
            {STAGES.map((s) => (
              <Button key={s.key} size="small" variant={deal.stage === s.key ? 'contained' : 'outlined'} onClick={() => moveStage(s.key)}>
                {s.label}
              </Button>
            ))}
            <Button size="small" color="success" variant="outlined" onClick={markWon}>Mark Won</Button>
            <Button size="small" color="error" variant="outlined" onClick={() => setLostDialogOpen(true)}>Mark Lost</Button>
          </Box>
        )}
        {deal.stage === 'won' && <Alert severity="success" sx={{ mb: 2 }}>Won — converted to a customer in Invoices.</Alert>}
        {deal.stage === 'lost' && <Alert severity="error" sx={{ mb: 2 }}>Lost{deal.lost_reason ? `: ${deal.lost_reason}` : ''}</Alert>}

        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Quotations</Typography>
          <Button size="small" onClick={() => setQuoteOpen(true)}>+ New quote</Button>
        </Box>
        {quotations.map((q) => (
          <Paper key={q.id} sx={{ p: 1.5, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography className="figure" sx={{ fontSize: '0.8rem' }}>{q.quote_number}</Typography>
              <Money amount={q.total_amount} size="0.95rem" />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <StatusChip status={q.status} />
              {q.status === 'pending_approval' && <Button size="small" onClick={() => approveQuote(q.id)}>Approve</Button>}
              {q.status === 'draft' && <Button size="small" onClick={() => sendQuote(q.id)}>Send</Button>}
            </Box>
          </Paper>
        ))}
        {!quotations.length && <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>No quotations yet.</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      <Dialog open={quoteOpen} onClose={() => setQuoteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New quotation</DialogTitle>
        <DialogContent>
          {quoteItems.map((item, i) => (
            <Grid container spacing={1.5} key={i} sx={{ mb: 1.5, alignItems: 'center' }}>
              <Grid item xs={5}><TextField fullWidth size="small" placeholder="Description" value={item.description} onChange={(e) => { const it = [...quoteItems]; it[i].description = e.target.value; setQuoteItems(it); }} /></Grid>
              <Grid item xs={2}><TextField fullWidth size="small" type="number" label="Qty" value={item.quantity} onChange={(e) => { const it = [...quoteItems]; it[i].quantity = e.target.value; setQuoteItems(it); }} /></Grid>
              <Grid item xs={3}><TextField fullWidth size="small" type="number" label="Unit price" value={item.unit_price} onChange={(e) => { const it = [...quoteItems]; it[i].unit_price = e.target.value; setQuoteItems(it); }} /></Grid>
              <Grid item xs={2}>
                <IconButton size="small" onClick={() => setQuoteItems(quoteItems.filter((_, idx) => idx !== i))} disabled={quoteItems.length === 1}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Grid>
            </Grid>
          ))}
          <Button size="small" onClick={() => setQuoteItems([...quoteItems, { ...emptyQuoteItem }])}>+ Add line</Button>

          <Divider sx={{ my: 2 }} />
          <TextField label="Discount %" type="number" size="small" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} sx={{ width: 140 }} />
          <Typography sx={{ mt: 2 }}>Subtotal: <Money amount={subtotal} /></Typography>
          <Typography sx={{ fontWeight: 600 }}>Total after discount: <Money amount={total} size="1.05rem" /></Typography>

          {error && <Alert severity="info" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuoteOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createQuote} disabled={saving}>{saving ? 'Creating…' : 'Create quote'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={lostDialogOpen} onClose={() => setLostDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Mark deal as lost</DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline rows={2} label="Reason" value={lostReason} onChange={(e) => setLostReason(e.target.value)} margin="normal" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLostDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={markLost}>Mark lost</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

function Pipeline() {
  const [deals, setDeals] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [form, setForm] = useState(emptyDealForm);
  const [openDealId, setOpenDealId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    client.get('/sales/deals').then(({ data }) => setDeals(data.deals));
    client.get('/sales/forecast').then(({ data }) => setForecast(data));
  };
  useEffect(() => { load(); }, []);

  const handleCreateDeal = async () => {
    setSaving(true);
    try {
      await client.post('/sales/deals', form);
      setNewDealOpen(false);
      setForm(emptyDealForm);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Sales Pipeline</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewDealOpen(true)}>New deal</Button>
      </Box>

      {forecast && (
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 2 }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Weighted pipeline</Typography>
              <Money amount={forecast.totalWeightedPipeline} size="1.3rem" />
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 2 }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Open pipeline (raw)</Typography>
              <Money amount={forecast.totalOpenPipeline} size="1.3rem" />
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 2 }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Won this month</Typography>
              <Money amount={forecast.wonThisMonth} size="1.3rem" color="primary.main" />
            </Paper>
          </Grid>
        </Grid>
      )}

      <PipelineBoard deals={deals} onOpen={(d) => setOpenDealId(d.id)} onNewDeal={() => setNewDealOpen(true)} />

      {openDealId && <DealDetail dealId={openDealId} onClose={() => setOpenDealId(null)} onChanged={load} />}

      <Dialog open={newDealOpen} onClose={() => setNewDealOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New deal</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField fullWidth label="Company name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Contact name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Contact email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Deal value (₹)" value={form.deal_value} onChange={(e) => setForm({ ...form, deal_value: e.target.value })} /></Grid>
            <Grid item xs={6}>
              <TextField fullWidth select label="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {['referral', 'outbound', 'inbound', 'event', 'other'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}><TextField fullWidth type="date" label="Expected close date" InputLabelProps={{ shrink: true }} value={form.expected_close_date} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDealOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateDeal} disabled={saving || !form.company_name}>{saving ? 'Creating…' : 'Create deal'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function downloadCsv(filename, headers, rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((r) => r.map(cell).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Read-only sales register pulled from the platform — separate from the
// Platform Sync tab in Accounting, which posts these same records to the
// ledger. This view is for browsing/exporting, not booking.
function PlatformSalesRecords() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all' | 'trade_fee' | 'subscription'
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    client.get('/platform-sync/records', { params: { month, year } })
      .then(({ data }) => setRecords(data.records))
      .catch((e) => setError(e.response?.data?.error || 'Could not reach the platform API'))
      .finally(() => setLoading(false));
  }, [month, year]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  // Client-side filter — source toggle + search — applied on top of the
  // month/year server fetch. Export always exports exactly what's on screen.
  const filtered = (records || []).filter((r) => {
    if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = [r.customer_email, r.buyer_email, r.seller_email, r.project_name, r.description]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const total = filtered.reduce((s, r) => s + Number(r.amount_inr), 0);

  const exportCsv = () => {
    const headers = ['Date','Source','Customer / Buyer','Seller','Project','Quantity (tCO2)','Amount (INR)','GST (INR)','Description'];
    const rows = filtered.map((r) => [
      new Date(r.date).toISOString().slice(0, 10), r.source,
      r.customer_email || r.buyer_email || '', r.seller_email || '',
      r.project_name || '', r.quantity_tco2 || '',
      Number(r.amount_inr).toFixed(2), Number(r.gst_inr || 0).toFixed(2), r.description,
    ]);
    const sourceLabel = sourceFilter === 'all' ? 'all' : sourceFilter;
    downloadCsv(`sales_records_${sourceLabel}_${MONTHS[month - 1]}_${year}.csv`, headers, rows);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <TextField select size="small" label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))} sx={{ minWidth: 160 }}>
          {MONTHS.map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 120 }}>
          {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
        </TextField>
        <ToggleButtonGroup
          size="small"
          value={sourceFilter}
          exclusive
          onChange={(e, val) => val && setSourceFilter(val)}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="trade_fee">Trades</ToggleButton>
          <ToggleButton value="subscription">Subscriptions</ToggleButton>
        </ToggleButtonGroup>
        <TextField size="small" label="Search" placeholder="Email, project…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 200 }} />
        <Button variant="outlined" onClick={exportCsv} disabled={!filtered.length} sx={{ ml: 'auto' }}>
          Export CSV
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}
      {loading && <CircularProgress size={22} />}

      {!loading && records && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
              {filtered.length} record{filtered.length === 1 ? '' : 's'}
              {sourceFilter !== 'all' && ` · ${sourceFilter === 'trade_fee' ? 'Trades' : 'Subscriptions'}`}
              {records.length !== filtered.length && ` (of ${records.length} total)`}
            </Typography>
            <Money amount={total} />
          </Box>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Customer / Buyer</TableCell>
                  <TableCell>Project</TableCell>
                  <TableCell align="right">Qty (tCO2)</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={`${r.source}-${r.ref_id}`}>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{new Date(r.date).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell><Chip size="small" label={r.source === 'trade_fee' ? 'Trade' : 'Subscription'} variant="outlined" /></TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{r.customer_email || r.buyer_email || '—'}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{r.project_name || (r.plan ? `${r.plan} (${r.cycle})` : '—')}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.8rem' }}>{r.quantity_tco2 || '—'}</TableCell>
                    <TableCell align="right"><Money amount={r.amount_inr} size="0.85rem" /></TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', color: 'text.secondary', py: 3 }}>
                    {records.length === 0 ? `No records for ${MONTHS[month - 1]} ${year}` : 'No records match this filter'}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </Box>
  );
}

// Read-only customer roster with subscription status + lifetime trade
// activity — account health at a glance: who's active, who's overdue for
// renewal, who's a heavy trader worth an upsell call, who's gone quiet.
function PlatformCustomers() {
  const [customers, setCustomers] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    client.get('/platform-sync/customers').then(({ data }) => setCustomers(data.customers)).catch((e) => setError(e.response?.data?.error || 'Could not reach the platform API'));
  }, []);

  const filtered = (customers || []).filter((c) =>
    !search || c.email?.toLowerCase().includes(search.toLowerCase()) || c.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  const renewalSoon = (dateStr) => {
    if (!dateStr) return false;
    const days = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 14;
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}
      <TextField size="small" label="Search by email or company" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2.5, minWidth: 280 }} />
      {!customers && !error && <CircularProgress size={22} />}
      {customers && (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>KYC</TableCell>
                <TableCell>Renewal</TableCell>
                <TableCell align="right">Trades</TableCell>
                <TableCell align="right">Volume</TableCell>
                <TableCell>Last trade</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Typography sx={{ fontSize: '0.85rem' }}>{c.company_name || c.full_name || c.email}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{c.email}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{c.subscription_plan || '—'}{c.corporate_managed ? ' · corp' : ''}</TableCell>
                  <TableCell><StatusChip status={c.kyc_status} /></TableCell>
                  <TableCell>
                    {c.subscription_renewal_date ? (
                      <Chip size="small" label={new Date(c.subscription_renewal_date).toLocaleDateString('en-IN')} color={renewalSoon(c.subscription_renewal_date) ? 'warning' : 'default'} variant="outlined" />
                    ) : '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.8rem' }}>{c.trade_count}</TableCell>
                  <TableCell align="right"><Money amount={c.trade_volume_inr} size="0.85rem" /></TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{c.last_trade_at ? new Date(c.last_trade_at).toLocaleDateString('en-IN') : 'Never'}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', color: 'text.secondary', py: 3 }}>No customers match "{search}"</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}

export default function Sales() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Pipeline" />
        <Tab label="Platform Sales" />
        <Tab label="Platform Customers" />
      </Tabs>
      {tab === 0 && <Pipeline />}
      {tab === 1 && <PlatformSalesRecords />}
      {tab === 2 && <PlatformCustomers />}
    </Box>
  );
}