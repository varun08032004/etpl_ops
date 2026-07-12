import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, IconButton, Divider, Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
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

export default function Sales() {
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