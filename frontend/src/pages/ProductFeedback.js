import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
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

const TYPE_COLOR = { bug: 'error', feature_request: 'primary', feedback: 'info', question: 'default' };
const STATUS_COLOR = { open: 'warning', in_progress: 'info', resolved: 'success', wont_fix: 'default', duplicate: 'default' };
const SEVERITY_COLOR = { critical: 'error', high: 'warning', medium: 'info', low: 'default' };
const TYPES = ['bug', 'feature_request', 'feedback', 'question'];
const STATUSES = ['open', 'in_progress', 'resolved', 'wont_fix', 'duplicate'];
const AREAS = ['portfolio_management', 'marketplace', 'emission_tracking', 'reports', 'platform', 'other'];
const SOURCES = ['internal', 'beta_user', 'advisor', 'other'];

const emptyForm = {
  title: '', feedback_type: 'bug', severity: 'medium', status: 'open', area: 'other', description: '',
  reported_by_name: '', reported_by_email: '', source: 'internal', notes: '',
};

export default function ProductFeedback() {
  const isMobile = useMobile();
  const { staff } = useAuth();
  const [isProductHead, setIsProductHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isProductHead;

  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    const params = statusFilter ? { status: statusFilter } : {};
    client.get('/product/feedback', { params }).then(({ data }) => setItems(data.feedback)).catch(() => setItems([]));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  useEffect(() => {
    if (['owner', 'admin'].includes(staff?.role)) return;
    client.get('/departments/my-access')
      .then(({ data }) => {
        const dept = data.deptAccess;
        setIsProductHead(!!(dept?.isHOD && dept?.departmentName === 'Product'));
      })
      .catch(() => setIsProductHead(false));
  }, [staff?.role]);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setError(''); setOpen(true); };
  const openEdit = (i) => {
    setEditingId(i.id);
    setForm({
      title: i.title, feedback_type: i.feedback_type, severity: i.severity, status: i.status, area: i.area,
      description: i.description || '', reported_by_name: i.reported_by_name || '', reported_by_email: i.reported_by_email || '',
      source: i.source, notes: i.notes || '',
    });
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingId) await client.put(`/product/feedback/${editingId}`, form);
      else await client.post('/product/feedback', form);
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (i) => {
    if (!window.confirm(`Delete "${i.title}"? This cannot be undone.`)) return;
    await client.delete(`/product/feedback/${i.id}`);
    load();
  };

  return (
    <Box>
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Feedback & Bugs</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Bugs, feature requests, and feedback — from the team, advisors, or beta users.
          </Typography>
        </Box>
        {canEdit && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Log item</MobileButton>}
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 2 }}>
        <MobileTextField
          select
          size="small"
          label="Filter status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[{ value: '', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: s.replace('_', ' ') }))]}
        />
      </MobilePaper>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Area</TableCell>
                <TableCell>Reported by</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{i.title}</Typography>
                    {i.related_feature_title && <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: 'text.secondary' }}>Re: {i.related_feature_title}</Typography>}
                  </TableCell>
                  <TableCell><Chip size="small" label={i.feedback_type.replace('_', ' ')} color={TYPE_COLOR[i.feedback_type]} sx={{ textTransform: 'capitalize' }} /></TableCell>
                  <TableCell><Chip size="small" label={i.severity} color={SEVERITY_COLOR[i.severity]} sx={{ textTransform: 'capitalize' }} /></TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.8rem', textTransform: 'capitalize' }}>{i.area?.replace('_', ' ')}</TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.8rem' }}>{i.reported_by_name || (i.source === 'internal' ? 'Internal' : '—')}</TableCell>
                  <TableCell><Chip size="small" label={i.status.replace('_', ' ')} color={STATUS_COLOR[i.status]} sx={{ textTransform: 'capitalize' }} /></TableCell>
                  <TableCell align="right">
                    <MobileStack gap={1} direction="row">
                      {canEdit && <MobileButton size="small" onClick={() => openEdit(i)}>Edit</MobileButton>}
                      {canEdit && <MobileButton size="small" color="error" onClick={() => handleDelete(i)}>Delete</MobileButton>}
                    </MobileStack>
                  </TableCell>
                </TableRow>
              ))}
              {!items.length && (
                <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>Nothing logged yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Log'} feedback/bug</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Type"
              value={form.feedback_type}
              onChange={(e) => setForm({ ...form, feedback_type: e.target.value })}
              options={TYPES.map((t) => ({ value: t, label: t.replace('_', ' ') }))}
            />
            <MobileTextField
              fullWidth
              select
              label="Severity"
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'critical', label: 'Critical' },
              ]}
            />
            <MobileTextField
              fullWidth
              select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={STATUSES.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
            />
            <MobileTextField
              fullWidth
              select
              label="Area"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
              options={AREAS.map((a) => ({ value: a, label: a.replace('_', ' ') }))}
            />
            <MobileTextField fullWidth label="Description" multiline rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Source"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              options={SOURCES.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
            />
            <MobileTextField fullWidth label="Reported by (name)" value={form.reported_by_name} onChange={(e) => setForm({ ...form, reported_by_name: e.target.value })} />
            <MobileTextField fullWidth label="Reported by (email)" value={form.reported_by_email} onChange={(e) => setForm({ ...form, reported_by_email: e.target.value })} />
            <MobileTextField fullWidth label="Notes" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleSave} disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save'}</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}