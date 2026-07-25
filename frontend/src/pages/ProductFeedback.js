import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">Feedback & Bugs</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Bugs, feature requests, and feedback — from the team, advisors, or beta users.
          </Typography>
        </Box>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Log item</Button>}
      </Box>

      <TextField select size="small" label="Filter status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ mb: 2, minWidth: 180 }}>
        <MenuItem value="">All statuses</MenuItem>
        {STATUSES.map((s) => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace(/_/g, ' ')}</MenuItem>)}
      </TextField>

      <Paper>
        <Table>
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
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{i.title}</Typography>
                  {i.related_feature_title && <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Re: {i.related_feature_title}</Typography>}
                </TableCell>
                <TableCell><Chip size="small" label={i.feedback_type.replace('_', ' ')} color={TYPE_COLOR[i.feedback_type]} sx={{ textTransform: 'capitalize' }} /></TableCell>
                <TableCell><Chip size="small" label={i.severity} color={SEVERITY_COLOR[i.severity]} sx={{ textTransform: 'capitalize' }} /></TableCell>
                <TableCell sx={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>{i.area?.replace(/_/g, ' ')}</TableCell>
                <TableCell sx={{ fontSize: '0.8rem' }}>{i.reported_by_name || (i.source === 'internal' ? 'Internal' : '—')}</TableCell>
                <TableCell><Chip size="small" label={i.status.replace('_', ' ')} color={STATUS_COLOR[i.status]} sx={{ textTransform: 'capitalize' }} /></TableCell>
                <TableCell align="right">
                  {canEdit && <Button size="small" onClick={() => openEdit(i)}>Edit</Button>}
                  {canEdit && <Button size="small" color="error" onClick={() => handleDelete(i)}>Delete</Button>}
                </TableCell>
              </TableRow>
            ))}
            {!items.length && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>Nothing logged yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Log'} feedback/bug</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title" margin="normal" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField fullWidth select label="Type" margin="normal" value={form.feedback_type} onChange={(e) => setForm({ ...form, feedback_type: e.target.value })}>
            {TYPES.map((t) => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t.replace('_', ' ')}</MenuItem>)}
          </TextField>
          <TextField fullWidth select label="Severity" margin="normal" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            <MenuItem value="low">Low</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="critical">Critical</MenuItem>
          </TextField>
          <TextField fullWidth select label="Status" margin="normal" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUSES.map((s) => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>)}
          </TextField>
          <TextField fullWidth select label="Area" margin="normal" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
            {AREAS.map((a) => <MenuItem key={a} value={a} sx={{ textTransform: 'capitalize' }}>{a.replace(/_/g, ' ')}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Description" margin="normal" multiline rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <TextField fullWidth select label="Source" margin="normal" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            {SOURCES.map((s) => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Reported by (name)" margin="normal" value={form.reported_by_name} onChange={(e) => setForm({ ...form, reported_by_name: e.target.value })} />
          <TextField fullWidth label="Reported by (email)" margin="normal" value={form.reported_by_email} onChange={(e) => setForm({ ...form, reported_by_email: e.target.value })} />
          <TextField fullWidth label="Notes" margin="normal" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}