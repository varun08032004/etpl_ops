import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Paper, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody, TextField, Chip, Grid, Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import client from '../api/client';
import Money from '../components/Money';
import {
  MobilePageHeader,
  MobileButton,
  MobilePaper,
  MobileTextField,
  MobileFormGrid,
  MobileStack,
  ResponsiveTableContainer,
  useMobile,
} from '../components/MobileResponsive';

const LEVEL_COLOR = { full: 'success', view: 'info', none: 'default' };
const CHANNELS = ['google', 'meta', 'linkedin', 'email', 'referral', 'organic', 'other'];

function PermissionsMatrix() {
  const [data, setData] = useState(null);
  const isMobile = useMobile();
  useEffect(() => { client.get('/admin/permissions-matrix').then(({ data }) => setData(data)); }, []);
  if (!data) return null;

  return (
    <Box>
      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2.5 }}>
        This documents what's actually enforced in code — it's a reference view, not a separate
        configurable permission engine. Changing access levels means changing the underlying route code.
      </Typography>
      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Module</TableCell>
                {data.roles.map((r) => <TableCell key={r} sx={{ textTransform: 'capitalize' }}>{r}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.modules.map((m) => (
                <TableRow key={m.module}>
                  <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 600 }}>{m.module}</TableCell>
                  {data.roles.map((r) => {
                    const val = m[r];
                    const color = LEVEL_COLOR[val] || 'warning';
                    return (
                      <TableCell key={r}>
                        <Chip size="small" label={val} color={color} variant={color === 'default' ? 'outlined' : 'filled'} sx={{ fontSize: isMobile ? '0.6rem' : '0.68rem' }} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>
    </Box>
  );
}

function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [actionFilter, setActionFilter] = useState('');
  const isMobile = useMobile();

  const load = useCallback(() => client.get('/admin/audit-log', { params: actionFilter ? { action: actionFilter } : {} }).then(({ data }) => setEntries(data.entries)), [actionFilter]);
  useEffect(() => { load(); }, [load]);

  return (
    <Box>
      <MobileTextField size="small" label="Filter by action (e.g. 'role_changed')" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} sx={{ mb: 2.5, minWidth: isMobile ? '100%' : 320 }} />
      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>When</TableCell><TableCell>Who</TableCell><TableCell>Action</TableCell><TableCell>Entity</TableCell><TableCell>Details</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell sx={{ fontSize: '0.78rem' }} className="figure">{new Date(e.created_at).toLocaleString()}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{e.staff_email || 'system'}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}><Chip size="small" label={e.action} variant="outlined" /></TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{e.entity}</TableCell>
                  <TableCell sx={{ fontSize: '0.72rem', color: 'text.secondary', maxWidth: isMobile ? '100%' : 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.old_value && <span>from {JSON.stringify(e.old_value)} </span>}
                    {e.new_value && <span>→ {JSON.stringify(e.new_value)}</span>}
                  </TableCell>
                </TableRow>
              ))}
              {!entries.length && <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No audit entries yet — they'll appear as staff accounts get created, roles change, or employees exit.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>
    </Box>
  );
}

const PROFILE_FIELDS = [
  { key: 'name', label: 'Company name' },
  { key: 'cin', label: 'CIN' },
  { key: 'gstin', label: 'GSTIN' },
  { key: 'registered_address', label: 'Registered address', multiline: true },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Website' },
  { key: 'phone', label: 'Phone' },
  { key: 'default_signatory_name', label: 'Default signatory name' },
  { key: 'default_signatory_title', label: 'Default signatory title' },
  { key: 'logo_url', label: 'Logo URL' },
  { key: 'seal_image_url', label: 'Seal image URL' },
  { key: 'signature_image_url', label: 'Signature image URL' },
  { key: 'verification_base_url', label: 'Verification base URL', helperText: 'Documents\' QR codes link to {this}/{document_number}' },
];

function MarketingSpend() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ spend_date: new Date().toISOString().split('T')[0], channel: '', campaign: '', amount_inr: '', new_customers: 0, notes: '' });
  const [saving, setSaving] = useState(false);
  const isMobile = useMobile();

  const load = useCallback(() => {
    setLoading(true);
    client.get('/analytics/marketing-spend', { params: { from: new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0] } })
      .then(({ data }) => { setEntries(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await client.put(`/analytics/marketing-spend/${editing.id}`, form);
      } else {
        await client.post('/analytics/marketing-spend', form);
      }
      setDialogOpen(false);
      setEditing(null);
      setForm({ spend_date: new Date().toISOString().split('T')[0], channel: '', campaign: '', amount_inr: '', new_customers: 0, notes: '' });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await client.delete(`/analytics/marketing-spend/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const openDialog = (entry = null) => {
    if (entry) {
      setEditing(entry);
      setForm({ ...entry, spend_date: entry.spend_date.split('T')[0] });
    } else {
      setEditing(null);
      setForm({ spend_date: new Date().toISOString().split('T')[0], channel: '', campaign: '', amount_inr: '', new_customers: 0, notes: '' });
    }
    setDialogOpen(true);
  };

  if (loading) return <Typography>Loading marketing spend…</Typography>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
          Record marketing spend by channel/campaign to enable accurate CAC calculation in Analytics → Unit Economics.
        </Typography>
        <MobileButton variant="contained" startIcon={<AddIcon />} onClick={() => openDialog()}>Add Spend Entry</MobileButton>
      </Box>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Channel</TableCell>
                <TableCell>Campaign</TableCell>
                <TableCell align="right">Spend (₹)</TableCell>
                <TableCell align="right">New Customers</TableCell>
                <TableCell align="right">Implied CAC</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id} hover>
                  <TableCell sx={{ fontSize: '0.78rem' }}>{new Date(e.spend_date).toLocaleDateString()}</TableCell>
                  <TableCell><Chip size="small" label={e.channel} variant="outlined" /></TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.campaign || '—'}</TableCell>
                  <TableCell align="right"><Money amount={e.amount_inr} /></TableCell>
                  <TableCell align="right">{e.new_customers}</TableCell>
                  <TableCell align="right">{e.new_customers > 0 ? <Money amount={e.amount_inr / e.new_customers} /> : '—'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openDialog(e)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(e.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!entries.length && <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No marketing spend recorded yet. Click "Add Spend Entry" to start tracking.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editing ? 'Edit' : 'Add'} Marketing Spend Entry</DialogTitle>
          <DialogContent>
            <MobileFormGrid sx={{ mt: 1 }}>
              <MobileTextField fullWidth label="Date" type="date" name="spend_date" value={form.spend_date} onChange={(e) => setForm({ ...form, spend_date: e.target.value })} required />
              <MobileTextField fullWidth select label="Channel" name="channel" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} required>
                {CHANNELS.map(c => <TextField key={c} select={true} value={c} label={c.charAt(0).toUpperCase() + c.slice(1)} />)}
              </MobileTextField>
              <MobileTextField fullWidth label="Campaign (optional)" name="campaign" value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} />
              <MobileTextField fullWidth label="Amount (INR)" type="number" name="amount_inr" value={form.amount_inr} onChange={(e) => setForm({ ...form, amount_inr: e.target.value })} required inputProps={{ step: '0.01', min: '0' }} />
              <MobileTextField fullWidth label="New Customers Attributed" type="number" name="new_customers" value={form.new_customers} onChange={(e) => setForm({ ...form, new_customers: parseInt(e.target.value) || 0 })} inputProps={{ min: '0' }} />
              <MobileTextField fullWidth label="Notes (optional)" multiline rows={2} name="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </MobileFormGrid>
          </DialogContent>
          <DialogActions>
            <MobileButton onClick={() => setDialogOpen(false)}>Cancel</MobileButton>
            <MobileButton variant="contained" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</MobileButton>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

function CompanyProfile() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const isMobile = useMobile();

  const load = useCallback(() => client.get('/document-engine/company-profile').then(({ data }) =>
    setForm(data.profile || Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, ''])))), []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { data } = await client.put('/document-engine/company-profile', form);
      setForm(data.profile);
      setMessage({ severity: 'success', text: 'Company profile saved.' });
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  if (!form) return null;

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2.5 }}>
        Powers the letterhead on every generated document (offer letters, NDAs, etc.) — logo, seal,
        signatory, and the base URL each document's QR code verifies against.
      </Typography>
      {message && <Alert severity={message.severity} sx={{ mb: 2.5 }}>{message.text}</Alert>}
      <MobilePaper>
        <MobileFormGrid>
          {PROFILE_FIELDS.map((f) => (
            <MobileTextField
              key={f.key}
              fullWidth
              label={f.label}
              multiline={f.multiline}
              rows={f.multiline ? 2 : undefined}
              helperText={f.helperText}
              value={form[f.key] || ''}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          ))}
        </MobileFormGrid>
        <MobileButton variant="contained" onClick={save} disabled={saving} sx={{ mt: 3 }}>
          {saving ? 'Saving…' : 'Save company profile'}
        </MobileButton>
      </MobilePaper>
    </Box>
  );
}

export default function Admin() {
  const [tab, setTab] = useState(0);
  const isMobile = useMobile();

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ mb: 0 }}>Admin</Typography>
      </MobilePageHeader>
      <MobilePaper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider' }} variant="scrollable" scrollButtons="auto">
          <Tab label="Permissions Matrix" />
          <Tab label="Audit Log" />
          <Tab label="Company Profile" />
          <Tab label="Marketing Spend" />
        </Tabs>
      </MobilePaper>
      {tab === 0 && <PermissionsMatrix />}
      {tab === 1 && <AuditLog />}
      {tab === 2 && <CompanyProfile />}
      {tab === 3 && <MarketingSpend />}
    </Box>
  );
}