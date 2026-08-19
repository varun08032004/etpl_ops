import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
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
  useMobile,
} from '../components/MobileResponsive';

const STATUS_COLOR = { new: 'info', contacted: 'warning', qualified: 'primary', converted: 'success', disqualified: 'error' };
const SOURCES = ['website_form', 'demo_request', 'event', 'referral', 'social', 'email', 'ad', 'organic_search', 'other'];

const emptyForm = {
  full_name: '', company_name: '', email: '', phone: '', source: 'website_form',
  campaign_id: '', status: 'new', message: '', received_at: '', notes: '',
};

export default function MarketingLeads() {
  const isMobile = useMobile();
  const { staff } = useAuth();
  const [isMarketingHead, setIsMarketingHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isMarketingHead;
  const canConvert = ['owner', 'admin', 'finance'].includes(staff?.role) || isMarketingHead;
  const canDelete = staff?.role === 'owner';

  const [leads, setLeads] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const params = statusFilter ? { status: statusFilter } : {};
    client.get('/marketing/leads', { params }).then(({ data }) => setLeads(data.leads)).catch(() => setLeads([]));
  }, [statusFilter]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    client.get('/marketing/campaigns').then(({ data }) => setCampaigns(data.campaigns)).catch(() => setCampaigns([]));
  }, []);

  useEffect(() => {
    if (['owner', 'admin'].includes(staff?.role)) return;
    client.get('/departments/my-access')
      .then(({ data }) => {
        const dept = data.deptAccess;
        setIsMarketingHead(!!(dept?.isHOD && dept?.departmentName === 'Marketing'));
      })
      .catch(() => setIsMarketingHead(false));
  }, [staff?.role]);

  const totals = leads.reduce((acc, l) => ({
    total: acc.total + 1,
    new: acc.new + (l.status === 'new' ? 1 : 0),
    converted: acc.converted + (l.status === 'converted' ? 1 : 0),
  }), { total: 0, new: 0, converted: 0 });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
  };

  const openEdit = (l) => {
    setEditingId(l.id);
    setForm({
      full_name: l.full_name, company_name: l.company_name || '', email: l.email || '', phone: l.phone || '',
      source: l.source, campaign_id: l.campaign_id || '', status: l.status, message: l.message || '',
      received_at: l.received_at?.slice(0, 10) || '', notes: l.notes || '',
    });
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await client.put(`/marketing/leads/${editingId}`, form);
      } else {
        await client.post('/marketing/leads', form);
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async (l) => {
    if (!window.confirm(`Convert "${l.full_name}" into a CRM customer record?`)) return;
    try {
      await client.post(`/marketing/leads/${l.id}/convert`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to convert lead');
    }
  };

  const handleDelete = async (l) => {
    if (!window.confirm(`Delete lead "${l.full_name}"? This cannot be undone.`)) return;
    await client.delete(`/marketing/leads/${l.id}`);
    load();
  };

  return (
    <Box>
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Leads</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Inbound interest from ethertrack.in — demo requests, website forms, events. Convert qualified ones straight into the CRM.
          </Typography>
        </Box>
        {canEdit && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add lead</MobileButton>}
      </MobilePageHeader>

      <MobileStack gap={2} direction="row" sx={{ mb: 3, flexWrap: 'wrap' }}>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Total leads</Typography>
          <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }} className="figure">{totals.total}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>New</Typography>
          <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }} className="figure">{totals.new}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Converted</Typography>
          <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }} className="figure">{totals.converted}</Typography>
        </MobilePaper>
      </MobileStack>

      <MobilePaper sx={{ mb: 2 }}>
        <MobileTextField
          select
          size="small"
          label="Filter status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[{ value: '', label: 'All statuses' }, ...Object.keys(STATUS_COLOR).map((s) => ({ value: s, label: s.replace('_', ' ') }))]}
        />
      </MobilePaper>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Received</TableCell>
                <TableCell>Name / company</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leads.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{l.received_at?.slice(0, 10) || '—'}</TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{l.full_name}</Typography>
                    {l.company_name && <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>{l.company_name}</Typography>}
                  </TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }}>
                    {l.email && <div>{l.email}</div>}
                    {l.phone && <div>{l.phone}</div>}
                  </TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', textTransform: 'capitalize' }}>{l.source?.replace('_', ' ')}</TableCell>
                  <TableCell>
                    <Chip size="small" label={l.status} color={STATUS_COLOR[l.status]} sx={{ textTransform: 'capitalize' }} />
                    {l.converted_party_name && <Typography sx={{ fontSize: isMobile ? '0.6rem' : '0.7rem', color: 'text.secondary', mt: 0.5 }}>→ {l.converted_party_name}</Typography>}
                  </TableCell>
                  <TableCell align="right">
                    <MobileStack gap={1} direction="row">
                      {canConvert && l.status !== 'converted' && <MobileButton size="small" onClick={() => handleConvert(l)}>Convert</MobileButton>}
                      {canEdit && <MobileButton size="small" onClick={() => openEdit(l)}>Edit</MobileButton>}
                      {canDelete && <MobileButton size="small" color="error" onClick={() => handleDelete(l)}>Delete</MobileButton>}
                    </MobileStack>
                  </TableCell>
                </TableRow>
              ))}
              {!leads.length && (
                <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No leads logged yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Add'} lead</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth label="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <MobileTextField fullWidth label="Company name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            <MobileTextField fullWidth label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <MobileTextField fullWidth label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Source"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              options={SOURCES.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
            />
            <MobileTextField
              fullWidth
              select
              label="Campaign"
              value={form.campaign_id}
              onChange={(e) => setForm({ ...form, campaign_id: e.target.value })}
              options={[{ value: '', label: '—' }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <MobileTextField
              fullWidth
              select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={Object.keys(STATUS_COLOR).map((s) => ({ value: s, label: s }))}
            />
            <MobileTextField fullWidth type="date" label="Received on" InputLabelProps={{ shrink: true }} value={form.received_at} onChange={(e) => setForm({ ...form, received_at: e.target.value })} />
            <MobileTextField fullWidth label="Message" multiline rows={2} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            <MobileTextField fullWidth label="Notes" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleSave} disabled={saving || !form.full_name}>
            {saving ? 'Saving…' : 'Save'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}