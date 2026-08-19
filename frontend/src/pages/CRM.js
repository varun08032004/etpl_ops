import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, MenuItem, Chip, Alert, IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import client from '../api/client';
import Money from '../components/Money';
import {
  MobilePaper,
  MobilePageHeader,
  MobileFormGrid,
  MobileActionButtons,
  MobileDialog,
  MobileButton,
  MobileTextField,
  MobileStack,
  useMobile,
} from '../components/MobileResponsive';

const emptyForm = {
  name: '', party_type: 'customer', email: '', phone: '', gstin: '', pan: '', cin: '',
  industry: '', employee_band: '', turnover_band: '', lead_source: '',
};

function CompanyList() {
  const isMobile = useMobile();
  const [parties, setParties] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback((q) => client.get('/parties', { params: { party_type: 'customer', ...(q ? { search: q } : {}) } }).then(({ data }) => setParties(data.parties)), []);
  useEffect(() => { load(); }, [load]);

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
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>CRM</Typography>
        <MobileButton variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Add company</MobileButton>
      </MobilePageHeader>

      <MobileTextField
        fullWidth
        placeholder="Search by name or GSTIN"
        value={search}
        onChange={handleSearch}
        size="small"
        sx={{ mb: 2, maxWidth: 360 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />

      <MobilePaper>
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
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add company</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth label="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <MobileTextField fullWidth label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <MobileTextField fullWidth label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <MobileTextField fullWidth label="GSTIN" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} helperText="15 characters, e.g. 27ABCDE1234F1Z5" />
            <MobileTextField fullWidth label="PAN" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
            <MobileTextField fullWidth label="CIN" value={form.cin} onChange={(e) => setForm({ ...form, cin: e.target.value.toUpperCase() })} />
            <MobileTextField fullWidth label="Industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            <MobileTextField fullWidth label="Employee band" placeholder="e.g. 50-200" value={form.employee_band} onChange={(e) => setForm({ ...form, employee_band: e.target.value })} />
            <MobileTextField fullWidth label="Turnover band" placeholder="e.g. ₹10-50 Cr" value={form.turnover_band} onChange={(e) => setForm({ ...form, turnover_band: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Lead source"
              value={form.lead_source}
              onChange={(e) => setForm({ ...form, lead_source: e.target.value })}
              options={['referral', 'outbound', 'inbound', 'event', 'other'].map((s) => ({ value: s, label: s }))}
            />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleCreate} disabled={saving || !form.name}>{saving ? 'Creating…' : 'Create'}</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
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
  const isMobile = useMobile();
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ full_name: '', role: '', email: '', phone: '' });
  const [noteText, setNoteText] = useState('');
  const [mergeOpen, setMergeOpen] = useState(false);
  const [allParties, setAllParties] = useState([]);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [message, setMessage] = useState(null);

  const load = useCallback(() => client.get(`/parties/${id}`).then(({ data }) => setData(data)), [id]);
  useEffect(() => { load(); }, [load]);

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
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>{party.name}</Typography>
          <Typography sx={{ color: 'text.secondary' }}>{party.industry || 'No industry set'} · {party.email || 'No email'}</Typography>
        </Box>
        <MobileButton variant="outlined" startIcon={<MergeTypeIcon />} onClick={openMerge}>Merge into another company</MobileButton>
      </MobilePageHeader>

      {message && <Alert severity={message.severity} sx={{ mb: 2.5 }}>{message.text}</Alert>}
      {party.merged_into_party_id && <Alert severity="warning" sx={{ mb: 2.5 }}>This record has been merged into another company.</Alert>}

      <MobilePaper sx={{ mb: 3 }}>
        <Typography sx={{ fontWeight: 600, mb: 2 }}>Company details</Typography>
        <MobileFormGrid>
          <Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>GSTIN</Typography>
            <Typography className="figure">{party.gstin || '—'}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>PAN</Typography>
            <Typography className="figure">{party.pan || '—'}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>CIN</Typography>
            <Typography className="figure">{party.cin || '—'}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Phone</Typography>
            <Typography>{party.phone || '—'}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Employee band</Typography>
            <Typography>{party.employee_band || '—'}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Turnover band</Typography>
            <Typography>{party.turnover_band || '—'}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Lead source</Typography>
            <Typography sx={{ textTransform: 'capitalize' }}>{party.lead_source || '—'}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Renewal date</Typography>
            <Typography className="figure">{party.renewal_date?.slice(0, 10) || '—'}</Typography>
          </Box>
        </MobileFormGrid>
      </MobilePaper>

      <MobilePaper sx={{ mb: 3 }}>
        <MobilePageHeader>
          <Typography sx={{ fontWeight: 600 }}>Contacts</Typography>
          <MobileButton size="small" onClick={() => setContactOpen(true)}>+ Add contact</MobileButton>
        </MobilePageHeader>
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
      </MobilePaper>

      <MobilePaper>
        <Typography sx={{ fontWeight: 600, mb: 2 }}>Timeline</Typography>
        <MobileStack gap={1} direction="row" sx={{ mb: 2 }}>
          <MobileTextField fullWidth size="small" placeholder="Add a note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          <MobileButton size="small" variant="contained" onClick={addNote}>Add</MobileButton>
        </MobileStack>
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
      </MobilePaper>

      <MobileDialog open={contactOpen} onClose={() => setContactOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add contact</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField fullWidth label="Full name" value={contactForm.full_name} onChange={(e) => setContactForm({ ...contactForm, full_name: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Role"
              value={contactForm.role}
              onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
              options={['decision_maker', 'technical', 'billing', 'other'].map((r) => ({ value: r, label: r.replace('_', ' ') }))}
            />
            <MobileTextField fullWidth label="Email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
            <MobileTextField fullWidth label="Phone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
          </MobileFormGrid>
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setContactOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={addContact} disabled={!contactForm.full_name}>Add</MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      <MobileDialog open={mergeOpen} onClose={() => setMergeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Merge "{party.name}" into…</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            All deals, invoices, contacts, and documents move to the surviving company. This record is
            deactivated, never deleted. Touches financial records — Admin and Finance requests need
            Founder approval; only the Founder can do this immediately.
          </Alert>
          <MobileTextField
            fullWidth
            select
            label="Surviving company"
            value={mergeTargetId}
            onChange={(e) => setMergeTargetId(e.target.value)}
            options={allParties.map((p) => ({ value: p.id, label: p.name }))}
          />
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setMergeOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" color="warning" onClick={doMerge} disabled={!mergeTargetId}>Merge</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}

export { CompanyList, CompanyDetail };