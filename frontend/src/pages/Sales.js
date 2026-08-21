import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Chip, Button, DialogTitle, DialogContent,
  TextField, MenuItem, Alert, IconButton, Divider, Table, TableHead, TableRow, TableCell, TableBody,
  Tabs, Tab, CircularProgress,
} from '@mui/material';
import client from '../api/client';
import Money from '../components/Money';
import StatusChip from '../components/StatusChip';
import {
  MobilePaper,
  MobilePageHeader,
  MobileFormGrid,
  MobileActionButtons,
  MobileDialog,
  MobileCardGrid,
  MobileStack,
  MobileTextField,
  ResponsiveTableContainer,
  MobileButton,
  useMobile,
  useBreakpoint
} from '../components/MobileResponsive';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';

const STAGES = [
  { key: 'new', label: 'New' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'proposal_sent', label: 'Proposal Sent' },
  { key: 'negotiation', label: 'Negotiation' },
];

const emptyDealForm = { company_name: '', contact_name: '', contact_email: '', contact_phone: '', source: '', deal_value: '', expected_close_date: '', notes: '' };
const emptyQuoteItem = { description: '', quantity: 1, unit_price: '' };

function DealCard({ deal, onOpen, isMobile }) {
  return (
    <MobilePaper onClick={() => onOpen(deal)} sx={{ mb: 1, cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}>
      <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.8125rem' : '0.875rem' }}>{deal.company_name}</Typography>
      <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary', mb: 1 }}>{deal.contact_name || 'No contact set'}</Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Money amount={deal.deal_value} size={isMobile ? '0.8rem' : '0.9rem'} />
        <Chip size="small" label={`${deal.probability_percent}%`} variant="outlined" />
      </Box>
    </MobilePaper>
  );
}

function PipelineBoard({ deals, onOpen, onNewDeal }) {
  const isMobile = useMobile();
  const breakpoint = useBreakpoint();

  if (breakpoint === 'mobile') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {STAGES.map((s) => {
          const stageDeals = deals.filter((d) => d.stage === s.key);
          const stageTotal = stageDeals.reduce((sum, d) => sum + Number(d.deal_value), 0);
          return (
            <MobilePaper key={s.key}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {s.label} · {stageDeals.length}
                </Typography>
                {s.key === 'new' && (
                  <IconButton size="small" onClick={onNewDeal}><AddIcon fontSize="small" /></IconButton>
                )}
              </Box>
              <Typography className="figure" sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary', mb: 1.5 }}>
                <Money amount={stageTotal} size={isMobile ? '0.7rem' : '0.75rem'} />
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {stageDeals.map((d) => <DealCard key={d.id} deal={d} onOpen={onOpen} isMobile={isMobile} />)}
                {!stageDeals.length && <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>No deals</Typography>}
              </Box>
            </MobilePaper>
          );
        })}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
      {STAGES.map((s) => {
        const stageDeals = deals.filter((d) => d.stage === s.key);
        const stageTotal = stageDeals.reduce((sum, d) => sum + Number(d.deal_value), 0);
        return (
          <Box key={s.key} sx={{ minWidth: 280, flex: '0 0 280px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {s.label} · {stageDeals.length}
              </Typography>
              {s.key === 'new' && (
                <IconButton size="small" onClick={onNewDeal}><AddIcon fontSize="small" /></IconButton>
              )}
            </Box>
            <Typography className="figure" sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary', mb: 1.5, px: 0.5 }}>
              <Money amount={stageTotal} size={isMobile ? '0.7rem' : '0.75rem'} />
            </Typography>
            {stageDeals.map((d) => <DealCard key={d.id} deal={d} onOpen={onOpen} isMobile={isMobile} />)}
            {!stageDeals.length && <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary', px: 0.5 }}>No deals</Typography>}
          </Box>
        );
      })}
    </Box>
  );
}

function DealDetail({ dealId, onClose, onChanged }) {
  const isMobile = useMobile();
  const [data, setData] = useState(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteItems, setQuoteItems] = useState([{ ...emptyQuoteItem }]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [lostDialogOpen, setLostDialogOpen] = useState(false);

  const load = useCallback(() => client.get(`/sales/deals/${dealId}`).then(({ data }) => setData(data)), [dealId]);
  useEffect(() => { load(); }, [load]);

  if (!data) return null;
  const { deal, quotations } = data;

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
    <MobileDialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {deal.company_name}
        <StatusChip status={deal.stage} />
      </DialogTitle>
      <DialogContent>
        <MobileFormGrid sx={{ mb: 2 }}>
          <Box><Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Value</Typography><Money amount={deal.deal_value} size="1.05rem" /></Box>
          <Box><Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Contact</Typography><Typography>{deal.contact_name || '—'} {deal.contact_email ? `(${deal.contact_email})` : ''}</Typography></Box>
        </MobileFormGrid>

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
          <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.9rem' }}>Quotations</Typography>
          <Button size="small" onClick={() => setQuoteOpen(true)}>+ New quote</Button>
        </Box>
        {quotations.map((q) => (
          <MobilePaper key={q.id} sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography className="figure" sx={{ fontSize: isMobile ? '0.72rem' : '0.8rem' }}>{q.quote_number}</Typography>
              <Money amount={q.total_amount} size={isMobile ? '0.85rem' : '0.95rem'} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <StatusChip status={q.status} />
              {q.status === 'pending_approval' && <Button size="small" onClick={() => approveQuote(q.id)}>Approve</Button>}
              {q.status === 'draft' && <Button size="small" onClick={() => sendQuote(q.id)}>Send</Button>}
            </Box>
          </MobilePaper>
        ))}
        {!quotations.length && <Typography sx={{ fontSize: isMobile ? '0.72rem' : '0.8rem', color: 'text.secondary' }}>No quotations yet.</Typography>}
      </DialogContent>
      <MobileActionButtons>
        <Button onClick={onClose}>Close</Button>
      </MobileActionButtons>

      <MobileDialog open={quoteOpen} onClose={() => setQuoteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New quotation</DialogTitle>
        <DialogContent>
          {quoteItems.map((item, i) => (
            <MobileFormGrid key={i} sx={{ mb: 1.5, alignItems: 'center' }}>
              <TextField fullWidth size="small" placeholder="Description" value={item.description} onChange={(e) => { const it = [...quoteItems]; it[i].description = e.target.value; setQuoteItems(it); }} />
              <TextField fullWidth size="small" type="number" label="Qty" value={item.quantity} onChange={(e) => { const it = [...quoteItems]; it[i].quantity = e.target.value; setQuoteItems(it); }} />
              <TextField fullWidth size="small" type="number" label="Unit price" value={item.unit_price} onChange={(e) => { const it = [...quoteItems]; it[i].unit_price = e.target.value; setQuoteItems(it); }} />
              <Box>
                <IconButton size="small" onClick={() => setQuoteItems(quoteItems.filter((_, idx) => idx !== i))} disabled={quoteItems.length === 1}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            </MobileFormGrid>
          ))}
          <Button size="small" onClick={() => setQuoteItems([...quoteItems, { ...emptyQuoteItem }])}>+ Add line</Button>

          <Divider sx={{ my: 2 }} />
          <TextField label="Discount %" type="number" size="small" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} sx={{ width: isMobile ? '100%' : 140 }} />
          <Typography sx={{ mt: 2 }}>Subtotal: <Money amount={subtotal} /></Typography>
          <Typography sx={{ fontWeight: 600 }}>Total after discount: <Money amount={total} size="1.05rem" /></Typography>

          {error && <Alert severity="info" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <Button onClick={() => setQuoteOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createQuote} disabled={saving}>{saving ? 'Creating…' : 'Create quote'}</Button>
        </MobileActionButtons>
      </MobileDialog>

      <MobileDialog open={lostDialogOpen} onClose={() => setLostDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Mark deal as lost</DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline rows={2} label="Reason" value={lostReason} onChange={(e) => setLostReason(e.target.value)} margin="normal" />
        </DialogContent>
        <MobileActionButtons>
          <Button onClick={() => setLostDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={markLost}>Mark lost</Button>
        </MobileActionButtons>
      </MobileDialog>
    </MobileDialog>
  );
}

function Pipeline() {
  const isMobile = useMobile();
  const [deals, setDeals] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [form, setForm] = useState(emptyDealForm);
  const [openDealId, setOpenDealId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    client.get('/sales/deals').then(({ data }) => setDeals(data.deals));
    client.get('/sales/forecast').then(({ data }) => setForecast(data));
  }, []);
  useEffect(() => { load(); }, [load]);

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
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Sales Pipeline</Typography>
        <MobileButton variant="contained" startIcon={<AddIcon />} onClick={() => setNewDealOpen(true)}>New deal</MobileButton>
      </MobilePageHeader>

      {forecast && (
        <MobileCardGrid sx={{ mb: 3 }}>
          <MobilePaper>
            <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Weighted pipeline</Typography>
            <Money amount={forecast.totalWeightedPipeline} size={isMobile ? '1.1rem' : '1.3rem'} />
          </MobilePaper>
          <MobilePaper>
            <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Open pipeline (raw)</Typography>
            <Money amount={forecast.totalOpenPipeline} size={isMobile ? '1.1rem' : '1.3rem'} />
          </MobilePaper>
          <MobilePaper>
            <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>Won this month</Typography>
            <Money amount={forecast.wonThisMonth} size={isMobile ? '1.1rem' : '1.3rem'} color="primary.main" />
          </MobilePaper>
        </MobileCardGrid>
      )}

      <PipelineBoard deals={deals} onOpen={(d) => setOpenDealId(d.id)} onNewDeal={() => setNewDealOpen(true)} />

      {openDealId && <DealDetail dealId={openDealId} onClose={() => setOpenDealId(null)} onChanged={load} />}

      <MobileDialog open={newDealOpen} onClose={() => setNewDealOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New deal</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth label="Company name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required />
            <MobileTextField fullWidth label="Contact name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            <MobileTextField fullWidth label="Contact email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            <MobileTextField fullWidth type="number" label="Deal value (₹)" value={form.deal_value} onChange={(e) => setForm({ ...form, deal_value: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Source"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              options={['referral', 'outbound', 'inbound', 'event', 'other'].map((s) => ({ value: s, label: s }))}
            />
            <MobileTextField fullWidth type="date" label="Expected close date" InputLabelProps={{ shrink: true }} value={form.expected_close_date} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} />
          </MobileFormGrid>
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setNewDealOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleCreateDeal} disabled={saving || !form.company_name}>{saving ? 'Creating…' : 'Create deal'}</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
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

function PlatformSalesRecords() {
  const isMobile = useMobile();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [sourceFilter, setSourceFilter] = useState('all');
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
    const headers = ['Date','Source','Customer / Buyer','Seller','Project','Quantity (tCO2)','Amount (INR)','GST (INR)','Invoice #','Description'];
    const rows = filtered.map((r) => [
      new Date(r.date).toISOString().slice(0, 10), r.source,
      r.customer_email || r.buyer_email || '', r.seller_email || '',
      r.project_name || '', r.quantity_tco2 || '',
      Number(r.amount_inr).toFixed(2), Number(r.gst_inr || 0).toFixed(2), r.invoice_number || '', r.description,
    ]);
    const sourceLabel = sourceFilter === 'all' ? 'all' : sourceFilter;
    downloadCsv(`sales_records_${sourceLabel}_${MONTHS[month - 1]}_${year}.csv`, headers, rows);
  };

  const downloadInvoice = async (record) => {
    try {
      const { data } = await client.get(
        `/platform-sync/records/${record.source}/${record.ref_id}/invoice`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${record.invoice_number || record.ref_id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Could not download this invoice — it may not have finished generating on the platform yet.');
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    client.get('/platform-sync/records', { params: { month, year } })
      .then(({ data }) => setRecords(data.records))
      .catch((e) => setError(e.response?.data?.error || 'Could not reach the platform API'))
      .finally(() => setLoading(false));
  };

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ mb: 0 }}>Platform Sales Records</Typography>
        <MobileButton variant="outlined" onClick={handleRefresh} disabled={loading} startIcon={<RefreshIcon />}>
          {loading ? 'Loading…' : 'Refresh'}
        </MobileButton>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 2 }}>
        <MobileStack direction="column" gap={2} sx={{ mb: 1 }}>
          <MobileStack gap={1} direction="row" flexWrap="wrap">
            <MobileTextField
              select
              size="small"
              label="Month"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
            />
            <MobileTextField
              select
              size="small"
              label="Year"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              options={years.map((y) => ({ value: y, label: String(y) }))}
            />
            <MobileTextField
              size="small"
              label="Search"
              placeholder="Email, project…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <MobileButton variant="outlined" onClick={exportCsv} disabled={!filtered.length}>Export CSV</MobileButton>
          </MobileStack>
          <MobileStack gap={1} direction="row" flexWrap="wrap">
            <MobileTextField
              select
              size="small"
              label="Source"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              options={[{ value: 'all', label: 'All' }, { value: 'trade_fee', label: 'Trades' }, { value: 'subscription', label: 'Subscriptions' }]}
            />
          </MobileStack>
        </MobileStack>
      </MobilePaper>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          {error}
          <MobileButton size="small" variant="outlined" onClick={handleRefresh} sx={{ ml: 2 }}>
            Retry
          </MobileButton>
        </Alert>
      )}
      {loading && <CircularProgress size={22} />}

      {!loading && records && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
              {filtered.length} record{filtered.length === 1 ? '' : 's'}
              {sourceFilter !== 'all' && ` · ${sourceFilter === 'trade_fee' ? 'Trades' : 'Subscriptions'}`}
              {records.length !== filtered.length && ` (of ${records.length} total)`}
            </Typography>
            <Money amount={total} />
          </Box>
          <MobilePaper>
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Customer / Buyer</TableCell>
                    <TableCell>Project</TableCell>
                    <TableCell align="right">Qty (tCO2)</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Invoice</TableCell>
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
                      <TableCell align="right">
                        {r.invoice_number ? (
                          <Button
                            size="small"
                            onClick={() => downloadInvoice(r)}
                            sx={{ fontSize: '0.72rem', minWidth: 0, textTransform: 'none' }}
                          >
                            {r.invoice_number}
                          </Button>
                        ) : (
                          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', color: 'text.secondary', py: 3 }}>
                      {records.length === 0 ? `No records for ${MONTHS[month - 1]} ${year}` : 'No records match this filter'}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </MobilePaper>
        </>
      )}
    </Box>
  );
}

function PlatformCustomers() {
  const isMobile = useMobile();
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
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ mb: 0 }}>Platform Customers</Typography>
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}
      <MobilePaper sx={{ mb: 2 }}>
        <MobileTextField
          size="small"
          label="Search by email or company"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </MobilePaper>
      {!customers && !error && <CircularProgress size={22} />}
      {customers && (
        <MobilePaper>
          <ResponsiveTableContainer>
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
          </ResponsiveTableContainer>
        </MobilePaper>
      )}
    </Box>
  );
}

export default function Sales() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }} variant="scrollable" scrollButtons="auto">
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