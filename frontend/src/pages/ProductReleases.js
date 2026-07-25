import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Chip, MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const AREA_LABEL = { portfolio_management: 'Portfolio Mgmt', marketplace: 'Marketplace', emission_tracking: 'Emission Tracking', reports: 'Reports', platform: 'Platform', other: 'Other' };

const emptyForm = { version: '', release_date: '', summary: '', feature_ids: [] };

export default function ProductReleases() {
  const { staff } = useAuth();
  const [isProductHead, setIsProductHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isProductHead;
  const canDelete = staff?.role === 'owner';

  const [releases, setReleases] = useState([]);
  const [shippedFeatures, setShippedFeatures] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => client.get('/product/releases').then(({ data }) => setReleases(data.releases)).catch(() => setReleases([]));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    client.get('/product/features').then(({ data }) => setShippedFeatures(data.features)).catch(() => setShippedFeatures([]));
  }, []);

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
  const openEdit = (r) => {
    setEditingId(r.id);
    setForm({ version: r.version, release_date: r.release_date?.slice(0, 10) || '', summary: r.summary || '', feature_ids: r.feature_ids || [] });
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingId) await client.put(`/product/releases/${editingId}`, form);
      else await client.post('/product/releases', form);
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Delete release "${r.version}"? This cannot be undone.`)) return;
    await client.delete(`/product/releases/${r.id}`);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">Releases</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Changelog of what's shipped on ethertrack.in.
          </Typography>
        </Box>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New release</Button>}
      </Box>

      {releases.map((r) => (
        <Paper key={r.id} sx={{ p: 2.5, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>{r.version}</Typography>
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }} className="figure">{r.release_date?.slice(0, 10)}</Typography>
            </Box>
            <Box>
              {canEdit && <Button size="small" onClick={() => openEdit(r)}>Edit</Button>}
              {canDelete && <Button size="small" color="error" onClick={() => handleDelete(r)}>Delete</Button>}
            </Box>
          </Box>
          {r.summary && <Typography sx={{ fontSize: '0.85rem', mt: 1.5 }}>{r.summary}</Typography>}
          {!!(r.features && r.features.length) && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1.5 }}>
              {r.features.map((f) => (
                <Chip key={f.id} size="small" label={`${AREA_LABEL[f.area] || f.area}: ${f.title}`} variant="outlined" />
              ))}
            </Box>
          )}
        </Paper>
      ))}
      {!releases.length && (
        <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>No releases logged yet.</Paper>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'New'} release</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Version (e.g. v1.2.0 or 'July Update')" margin="normal" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
          <TextField fullWidth type="date" label="Release date" InputLabelProps={{ shrink: true }} margin="normal" value={form.release_date} onChange={(e) => setForm({ ...form, release_date: e.target.value })} />
          <TextField fullWidth label="Summary" margin="normal" multiline rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          <TextField
            fullWidth select label="Features shipped in this release" margin="normal" SelectProps={{ multiple: true }}
            value={form.feature_ids} onChange={(e) => setForm({ ...form, feature_ids: e.target.value })}
          >
            {shippedFeatures.map((f) => <MenuItem key={f.id} value={f.id}>{f.title}</MenuItem>)}
          </TextField>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.version}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}