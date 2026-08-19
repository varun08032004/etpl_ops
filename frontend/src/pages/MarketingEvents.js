import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import Money from '../components/Money';
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
  MobileCardGrid,
  useMobile,
} from '../components/MobileResponsive';

const STATUS_COLOR = { planned: 'default', confirmed: 'info', completed: 'success', cancelled: 'error' };
const EVENT_TYPES = ['conference', 'webinar', 'meetup', 'trade_show', 'panel', 'workshop', 'other'];
const ROLES = ['attendee', 'sponsor', 'speaker', 'exhibitor', 'host'];

const emptyForm = {
  name: '', event_type: 'conference', role: 'attendee', status: 'planned', start_date: '', end_date: '',
  location: '', is_virtual: false, cost: '', leads_generated: '', url: '', notes: '',
};

export default function MarketingEvents() {
  const isMobile = useMobile();
  const { staff } = useAuth();
  const [isMarketingHead, setIsMarketingHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isMarketingHead;
  const canDelete = staff?.role === 'owner';

  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => client.get('/marketing/events').then(({ data }) => setEvents(data.events)).catch(() => setEvents([]));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (['owner', 'admin'].includes(staff?.role)) return;
    client.get('/departments/my-access')
      .then(({ data }) => {
        const dept = data.deptAccess;
        setIsMarketingHead(!!(dept?.isHOD && dept?.departmentName === 'Marketing'));
      })
      .catch(() => setIsMarketingHead(false));
  }, [staff?.role]);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setError(''); setOpen(true); };
  const openEdit = (e) => {
    setEditingId(e.id);
    setForm({
      name: e.name, event_type: e.event_type, role: e.role, status: e.status,
      start_date: e.start_date?.slice(0, 10) || '', end_date: e.end_date?.slice(0, 10) || '',
      location: e.location || '', is_virtual: !!e.is_virtual, cost: e.cost ?? '',
      leads_generated: e.leads_generated ?? '', url: e.url || '', notes: e.notes || '',
    });
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingId) await client.put(`/marketing/events/${editingId}`, form);
      else await client.post('/marketing/events', form);
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e) => {
    if (!window.confirm(`Delete "${e.name}"? This cannot be undone.`)) return;
    await client.delete(`/marketing/events/${e.id}`);
    load();
  };

  return (
    <Box>
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Events & Webinars</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Conferences, panels, and webinars — cost, role, and leads generated.
          </Typography>
        </Box>
        {canEdit && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add event</MobileButton>}
      </MobilePageHeader>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Event</TableCell>
                <TableCell>Type / role</TableCell>
                <TableCell>Dates</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Cost</TableCell>
                <TableCell align="right">Leads</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{e.name}</Typography>
                    {e.url && <Typography component="a" href={e.url} target="_blank" rel="noopener noreferrer" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>Link</Typography>}
                  </TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', textTransform: 'capitalize' }}>{e.event_type?.replace('_', ' ')} · {e.role}</TableCell>
                  <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.8rem' }}>{e.start_date?.slice(0, 10) || '—'}{e.end_date ? ` → ${e.end_date.slice(0, 10)}` : ''}</TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.8rem' }}>{e.is_virtual ? 'Virtual' : (e.location || '—')}</TableCell>
                  <TableCell><Chip size="small" label={e.status} color={STATUS_COLOR[e.status]} sx={{ textTransform: 'capitalize' }} /></TableCell>
                  <TableCell align="right"><Money amount={e.cost} /></TableCell>
                  <TableCell align="right" className="figure">{e.leads_generated || 0}</TableCell>
                  <TableCell align="right">
                    <MobileStack gap={1} direction="row">
                      {canEdit && <MobileButton size="small" onClick={() => openEdit(e)}>Edit</MobileButton>}
                      {canDelete && <MobileButton size="small" color="error" onClick={() => handleDelete(e)}>Delete</MobileButton>}
                    </MobileStack>
                  </TableCell>
                </TableRow>
              ))}
              {!events.length && (
                <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No events tracked yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Add'} event</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth label="Event name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Type"
              value={form.event_type}
              onChange={(e) => setForm({ ...form, event_type: e.target.value })}
              options={EVENT_TYPES.map((t) => ({ value: t, label: t.replace('_', ' ') }))}
            />
            <MobileTextField
              fullWidth
              select
              label="Our role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              options={ROLES.map((r) => ({ value: r, label: r }))}
            />
            <MobileTextField
              fullWidth
              select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={Object.keys(STATUS_COLOR).map((s) => ({ value: s, label: s }))}
            />
            <MobileStack gap={1.5} direction="row" flexWrap="wrap">
              <MobileTextField fullWidth type="date" label="Start date" InputLabelProps={{ shrink: true }} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              <MobileTextField fullWidth type="date" label="End date" InputLabelProps={{ shrink: true }} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </MobileStack>
            <MobileTextField fullWidth label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} disabled={form.is_virtual} />
            <MobileTextField
              fullWidth
              select
              label="Virtual?"
              value={form.is_virtual ? 'yes' : 'no'}
              onChange={(e) => setForm({ ...form, is_virtual: e.target.value === 'yes' })}
              options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
            />
            <MobileStack gap={1.5} direction="row" flexWrap="wrap">
              <MobileTextField fullWidth type="number" label="Cost (₹)" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              <MobileTextField fullWidth type="number" label="Leads generated" value={form.leads_generated} onChange={(e) => setForm({ ...form, leads_generated: e.target.value })} />
            </MobileStack>
            <MobileTextField fullWidth label="Event URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            <MobileTextField fullWidth label="Notes" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleSave} disabled={saving || !form.name}>{saving ? 'Saving…' : 'Save'}</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}