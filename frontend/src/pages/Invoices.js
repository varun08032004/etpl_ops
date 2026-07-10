import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField,
  IconButton, MenuItem, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import Money from '../components/Money';

const emptyItem = { description: '', hsn_sac_code: '', quantity: 1, unit_price: '', gst_rate: 18 };

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [parties, setParties] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ party_id: '', invoice_date: new Date().toISOString().slice(0, 10), due_date: '', items: [{ ...emptyItem }] });

  const load = () => client.get('/invoices').then(({ data }) => setInvoices(data.invoices));

  useEffect(() => {
    load();
    // Fetches from the dedicated parties router (routes/parties.js), not nested under invoices.
    client.get('/parties', { params: { type: 'customer' } }).then(({ data }) => setParties(data.parties || [])).catch(() => setParties([]));
  }, []);

  const updateItem = (i, key, val) => {
    const items = [...form.items];
    items[i] = { ...items[i], [key]: val };
    setForm({ ...form, items });
  };

  const subtotal = form.items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.unit_price || 0)), 0);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await client.post('/invoices', form);
      setOpen(false);
      setForm({ party_id: '', invoice_date: new Date().toISOString().slice(0, 10), due_date: '', items: [{ ...emptyItem }] });
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Invoices</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>New invoice</Button>
      </Box>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Invoice #</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Due</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Paid</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id} hover>
                <TableCell className="figure">{inv.invoice_number}</TableCell>
                <TableCell>{inv.party_name}</TableCell>
                <TableCell className="figure">{inv.invoice_date?.slice(0, 10)}</TableCell>
                <TableCell className="figure">{inv.due_date?.slice(0, 10)}</TableCell>
                <TableCell align="right"><Money amount={inv.total_amount} /></TableCell>
                <TableCell align="right"><Money amount={inv.amount_paid} /></TableCell>
                <TableCell><StatusChip status={inv.status} /></TableCell>
              </TableRow>
            ))}
            {!invoices.length && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No invoices yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>New invoice</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={4}>
              <TextField fullWidth select label="Customer" value={form.party_id} onChange={(e) => setForm({ ...form, party_id: e.target.value })}>
                {parties.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={4}>
              <TextField fullWidth type="date" label="Invoice date" InputLabelProps={{ shrink: true }}
                value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} />
            </Grid>
            <Grid item xs={4}>
              <TextField fullWidth type="date" label="Due date" InputLabelProps={{ shrink: true }}
                value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2.5 }} />
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1.5 }}>Line items</Typography>

          {form.items.map((item, i) => (
            <Grid container spacing={1.5} key={i} sx={{ mb: 1.5, alignItems: 'center' }}>
              <Grid item xs={4}><TextField fullWidth size="small" placeholder="Description" value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} /></Grid>
              <Grid item xs={2}><TextField fullWidth size="small" placeholder="HSN/SAC" value={item.hsn_sac_code} onChange={(e) => updateItem(i, 'hsn_sac_code', e.target.value)} /></Grid>
              <Grid item xs={1.5}><TextField fullWidth size="small" type="number" label="Qty" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} /></Grid>
              <Grid item xs={2}><TextField fullWidth size="small" type="number" label="Unit price" value={item.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} /></Grid>
              <Grid item xs={1.5}><TextField fullWidth size="small" type="number" label="GST %" value={item.gst_rate} onChange={(e) => updateItem(i, 'gst_rate', e.target.value)} /></Grid>
              <Grid item xs={1}>
                <IconButton size="small" onClick={() => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) })} disabled={form.items.length === 1}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Grid>
            </Grid>
          ))}
          <Button size="small" onClick={() => setForm({ ...form, items: [...form.items, { ...emptyItem }] })}>+ Add line</Button>

          <Divider sx={{ my: 2.5 }} />
          <Typography sx={{ textAlign: 'right' }}>Subtotal (pre-tax): <Money amount={subtotal} size="1.05rem" /></Typography>
          <Typography sx={{ textAlign: 'right', color: 'text.secondary', fontSize: '0.8rem' }}>GST calculated automatically based on customer's state (CGST+SGST or IGST)</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !form.party_id || !form.due_date}>
            {saving ? 'Creating…' : 'Create & post invoice'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
