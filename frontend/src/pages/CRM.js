import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, InputAdornment, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, MenuItem, Chip, Alert, IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import client from '../api/client';
import Money from '../components/Money';
import StatusChip from '../components/StatusChip';

const emptyForm = {
  name: '', party_type: 'customer', email: '', phone: '', gstin: '', pan: '', cin: '',
  industry: '', employee_band: '', turnover_band: '', lead_source: '',
};

function CompanyList() {
  const [parties, setParties] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = (q) => client.get('/parties', { params: { party_type: 'customer', ...(q ? { search: q } : {}) } }).then(({ data }) => setParties(data.parties));
  useEffect(() => { load(); }, []);

  const handleSearch = (e) => { setSearch(e.target.value); load(e.target.value); };

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post('/parties', form);
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create company');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">CRM</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Add company</Button>
      </Box>

      <TextField
        fullWidth placeholder="Search by name or GSTIN" value={search} onChange={handleSearch}
        size="small" sx={{ mb: 2, maxWidth: 360 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Company</TableCell>
              <TableCell>Industry</TableCell>
              <TableCell>GSTIN</TableCell>
              <TableCell>Renewal</TableCell>
              <TableCell>Health</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {parties.map((p) => (
              <TableRow key={p.id} component={Link} to={`/crm/${p.id}`}
                sx={{ cursor: 'pointer', textDecoration: 'none', '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                <TableCell>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.name}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{p.email || '—'}</Typography>
                </TableCell>
                <TableCell sx={{ fontSize: '0.85rem' }}>{p.industry || '—'}</TableCell>
                <TableCell className="figure" sx={{ fontSize: '0.8rem' }}>{p.gstin || '—'}</TableCell>
                <TableCell className="figure" sx={{ fontSize: '0.8rem' }}>{p.renewal_date?.slice(0, 10) || '—'}</TableCell>
                <TableCell>{p.health_score != null ? <Chip size="small" label={p.health_score} color={p.health_score >= 70 ? 'success' : p.health_score >= 40 ? 'warning' : 'error'} /> : '—'}</TableCell>
              </TableRow>
            ))}
            {!parties.length && (
              <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No companies yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add company</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField fullWidth label="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="GSTIN" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} helperText="15 characters, e.g. 27ABCDE1234F1Z5" /></Grid>
            <Grid item xs={6}><TextField fullWidth label="PAN" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="CIN" value={form.cin} onChange={(e) => setForm({ ...form, cin: e.target.value.toUpperCase() })} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Employee band" placeholder="e.g. 50-200" value={form.employee_band} onChange={(e) => setForm({ ...form, employee_band: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Turnover band" placeholder="e.g. ₹10-50 Cr" value={form.turnover_band} onChange={(e) => setForm({ ...form, turnover_band: e.target.value })} /></Grid>
            <Grid item xs={6}>
              <TextField fullWidth select label="Lead source" value={form.lead_source} onChange={(e) => setForm({ ...form, lead_source: e.target.value })}>
                {['referral', 'outbound', 'inbound', 'event', 'other'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !form.name}>{saving ? 'Creating…' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

const TIMELINE_LABEL = {
  deal: (d) => `Deal — ${d.stage.replace('_', ' ')}`,
  invoice: (d) => `Invoice ${d.invoice_number} — ${d.status}`,
  document: (d) => `Document — ${d.title}`,
  note: (d) => 'Note',
};

function CompanyDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ full_name: '', role: '', email: '', phone: '' });
  const [noteText, setNoteText] = useState('');
  const [mergeOpen, setMergeOpen] = useState(false);
  const [allParties, setAllParties] = useState([]);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [message, setMessage] = useState(null);

  const load = () => client.get(`/parties/${id}`).then(({ data }) => setData(data));
  useEffect(() => { load(); }, [id]);

  const addContact = async () => {
    await client.post(`/parties/${id}/contacts`, contactForm);
    setContactOpen(false);
    setContactForm({ full_name: '', role: '', email: '', phone: '' });
    load();
  };

  const removeContact = async (contactId) => {
    await client.delete(`/parties/contacts/${contactId}`);
    load();
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    await client.post(`/parties/${id}/notes`, { note: noteText });
    setNoteText('');
    load();
  };

  const openMerge = () => {
    client.get('/parties', { params: { party_type: 'customer' } }).then(({ data }) => setAllParties(data.parties.filter((p) => p.id !== id)));
    setMergeTargetId('');
    setMergeOpen(true);
  };

  const doMerge = async () => {
    try {
      const { data: res } = await client.post(`/parties/${id}/merge`, { canonical_party_id: mergeTargetId });
      if (res.pending) {
        setMessage({ severity: 'info', text: res.message });
      } else {
        setMessage({ severity: 'success', text: 'Merged.' });
      }
      setMergeOpen(false);
      load();
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to merge' });
    }
  };

  if (!data) return null;
  const { party, contacts, timeline } = data;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5">{party.name}</Typography>
          <Typography sx={{ color: 'text.secondary' }}>{party.industry || 'No industry set'} · {party.email || 'No email'}</Typography>
        </Box>
        <Button variant="outlined" startIcon={<MergeTypeIcon />} onClick={openMerge}>Merge into another company</Button>
      </Box>

      {message && <Alert severity={message.severity} sx={{ mb: 2.5 }}>{message.text}</Alert>}
      {party.merged_into_party_id && <Alert severity="warning" sx={{ mb: 2.5 }}>This record has been merged into another company.</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography sx={{ fontWeight: 600, mb: 2 }}>Company details</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}><Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>GSTIN</Typography><Typography className="figure">{party.gstin || '—'}</Typography></Grid>
              <Grid item xs={6}><Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>PAN</Typography><Typography className="figure">{party.pan || '—'}</Typography></Grid>
              <Grid item xs={6}><Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>CIN</Typography><Typography className="figure">{party.cin || '—'}</Typography></Grid>
              <Grid item xs={6}><Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Phone</Typography><Typography>{party.phone || '—'}</Typography></Grid>
              <Grid item xs={6}><Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Employee band</Typography><Typography>{party.employee_band || '—'}</Typography></Grid>
              <Grid item xs={6}><Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Turnover band</Typography><Typography>{party.turnover_band || '—'}</Typography></Grid>
              <Grid item xs={6}><Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Lead source</Typography><Typography sx={{ textTransform: 'capitalize' }}>{party.lead_source || '—'}</Typography></Grid>
              <Grid item xs={6}><Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Renewal date</Typography><Typography className="figure">{party.renewal_date?.slice(0, 10) || '—'}</Typography></Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 600 }}>Contacts</Typography>
              <Button size="small" onClick={() => setContactOpen(true)}>+ Add contact</Button>
            </Box>
            {contacts.map((c) => (
              <Box key={c.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.875rem' }}>{c.full_name} {c.role && <Chip size="small" label={c.role} sx={{ ml: 1 }} />}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{c.email || '—'} · {c.phone || '—'}</Typography>
                </Box>
                <IconButton size="small" onClick={() => removeContact(c.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
              </Box>
            ))}
            {!contacts.length && <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>No contacts yet.</Typography>}
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3 }}>
            <Typography sx={{ fontWeight: 600, mb: 2 }}>Timeline</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField fullWidth size="small" placeholder="Add a note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
              <Button size="small" variant="contained" onClick={addNote}>Add</Button>
            </Box>
            {timeline.map((item, i) => (
              <Box key={i} sx={{ py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '0.85rem' }}>{TIMELINE_LABEL[item.type](item.data)}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{new Date(item.at).toLocaleDateString('en-IN')}</Typography>
                </Box>
                {item.type === 'note' && <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{item.data.note} — {item.data.created_by_email}</Typography>}
                {item.type === 'deal' && <Money amount={item.data.deal_value} size="0.8rem" />}
                {item.type === 'invoice' && <Money amount={item.data.total_amount} size="0.8rem" />}
              </Box>
            ))}
            {!timeline.length && <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>Nothing yet.</Typography>}
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={contactOpen} onClose={() => setContactOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add contact</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Full name" margin="normal" value={contactForm.full_name} onChange={(e) => setContactForm({ ...contactForm, full_name: e.target.value })} />
          <TextField fullWidth select label="Role" margin="normal" value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}>
            {['decision_maker', 'technical', 'billing', 'other'].map((r) => <MenuItem key={r} value={r}>{r.replace('_', ' ')}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Email" margin="normal" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
          <TextField fullWidth label="Phone" margin="normal" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={addContact} disabled={!contactForm.full_name}>Add</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={mergeOpen} onClose={() => setMergeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Merge "{party.name}" into…</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            All deals, invoices, contacts, and documents move to the surviving company. This record is
            deactivated, never deleted. Touches financial records — Admin and Finance requests need
            Founder approval; only the Founder can do this immediately.
          </Alert>
          <TextField fullWidth select label="Surviving company" value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)}>
            {allParties.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMergeOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={doMerge} disabled={!mergeTargetId}>Merge</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export { CompanyList, CompanyDetail };