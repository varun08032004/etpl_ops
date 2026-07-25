import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Chip, Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['backlog', 'planned', 'in_progress', 'testing', 'shipped', 'cancelled'];
const STATUS_LABEL = { backlog: 'Backlog', planned: 'Planned', in_progress: 'In Progress', testing: 'Testing', shipped: 'Shipped', cancelled: 'Cancelled' };
const AREAS = ['portfolio_management', 'marketplace', 'emission_tracking', 'reports', 'platform', 'other'];
const AREA_LABEL = { portfolio_management: 'Portfolio Mgmt', marketplace: 'Marketplace', emission_tracking: 'Emission Tracking', reports: 'Reports', platform: 'Platform' };
const PRIORITY_COLOR = { critical: 'error', high: 'warning', medium: 'info', low: 'default' };

const emptyForm = { title: '', description: '', area: 'portfolio_management', status: 'backlog', priority: 'medium', target_date: '', notes: '' };

export default function ProductRoadmap() {
  const { staff } = useAuth();
  const [isProductHead, setIsProductHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isProductHead;
  const canDelete = staff?.role === 'owner';

  const [features, setFeatures] = useState([]);
  const [areaFilter, setAreaFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    const params = areaFilter ? { area: areaFilter } : {};
    client.get('/product/features', { params }).then(({ data }) => setFeatures(data.features)).catch(() => setFeatures([]));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [areaFilter]);

  useEffect(() => {
    if (['owner', 'admin'].includes(staff?.role)) return;
    client.get('/departments/my-access')
      .then(({ data }) => {
        const dept = data.deptAccess;
        setIsProductHead(!!(dept?.isHOD && dept?.departmentName === 'Product'));
      })
      .catch(() => setIsProductHead(false));
  }, [staff?.role]);

  const openCreate = (status) => { setEditingId(null); setForm({ ...emptyForm, status: status || 'backlog' }); setError(''); setOpen(true); };
  const openEdit = (f) => {
    setEditingId(f.id);
    setForm({
      title: f.title, description: f.description || '', area: f.area, status: f.status,
      priority: f.priority, target_date: f.target_date?.slice(0, 10) || '', notes: f.notes || '',
    });
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingId) await client.put(`/product/features/${editingId}`, form);
      else await client.post('/product/features', form);
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (f) => {
    if (!window.confirm(`Delete "${f.title}"? This cannot be undone.`)) return;
    await client.delete(`/product/features/${f.id}`);
    load();
  };

  const quickStatusChange = async (f, newStatus) => {
    await client.put(`/product/features/${f.id}`, { status: newStatus });
    load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5">Roadmap</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            What's being built across Portfolio Management, Marketplace, Emission Tracking, and Reports.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField select size="small" label="Filter area" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">All areas</MenuItem>
            {AREAS.map((a) => <MenuItem key={a} value={a}>{AREA_LABEL[a] || a}</MenuItem>)}
          </TextField>
          {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreate()}>Add item</Button>}
        </Box>
      </Box>

      <Grid container spacing={2}>
        {STATUSES.map((status) => {
          const items = features.filter((f) => f.status === status);
          return (
            <Grid item xs={12} sm={6} md={4} lg={2} key={status}>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                {STATUS_LABEL[status]} ({items.length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minHeight: 60 }}>
                {items.map((f) => (
                  <Paper key={f.id} variant="outlined" sx={{ p: 1.5, cursor: canEdit ? 'pointer' : 'default' }} onClick={() => canEdit && openEdit(f)}>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{f.title}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
                      <Chip size="small" label={AREA_LABEL[f.area] || f.area} sx={{ fontSize: '0.65rem', height: 20 }} />
                      <Chip size="small" label={f.priority} color={PRIORITY_COLOR[f.priority]} sx={{ fontSize: '0.65rem', height: 20, textTransform: 'capitalize' }} />
                    </Box>
                    {f.target_date && <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.5 }} className="figure">{f.target_date.slice(0, 10)}</Typography>}
                    {f.owner_name && <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{f.owner_name}</Typography>}
                    {canEdit && (
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }} onClick={(e) => e.stopPropagation()}>
                        <TextField
                          select size="small" value={f.status} variant="standard"
                          onChange={(e) => quickStatusChange(f, e.target.value)}
                          sx={{ fontSize: '0.7rem', flex: 1 }}
                          SelectProps={{ sx: { fontSize: '0.7rem' } }}
                        >
                          {STATUSES.map((s) => <MenuItem key={s} value={s} sx={{ fontSize: '0.75rem' }}>{STATUS_LABEL[s]}</MenuItem>)}
                        </TextField>
                      </Box>
                    )}
                  </Paper>
                ))}
                {!items.length && (
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', color: 'text.secondary', fontSize: '0.75rem' }}>—</Paper>
                )}
              </Box>
            </Grid>
          );
        })}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Add'} roadmap item</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title" margin="normal" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField fullWidth label="Description" margin="normal" multiline rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <TextField fullWidth select label="Area" margin="normal" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
            {AREAS.map((a) => <MenuItem key={a} value={a}>{AREA_LABEL[a] || a}</MenuItem>)}
          </TextField>
          <TextField fullWidth select label="Status" margin="normal" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{STATUS_LABEL[s]}</MenuItem>)}
          </TextField>
          <TextField fullWidth select label="Priority" margin="normal" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <MenuItem value="low">Low</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="critical">Critical</MenuItem>
          </TextField>
          <TextField fullWidth type="date" label="Target date" InputLabelProps={{ shrink: true }} margin="normal" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
          <TextField fullWidth label="Notes" margin="normal" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          {editingId && canDelete && <Button color="error" onClick={() => { handleDelete({ id: editingId, title: form.title }); setOpen(false); }} sx={{ mr: 'auto' }}>Delete</Button>}
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}