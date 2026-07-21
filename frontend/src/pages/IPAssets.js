import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip, Tabs, Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_COLOR = {
  filed: 'default', examination: 'info', opposed: 'warning',
  granted: 'success', registered: 'success', abandoned: 'error', expired: 'error',
};

const emptyForm = {
  ip_type: 'trademark', title: '', application_number: '', registration_number: '',
  status: 'filed', filing_date: '', grant_date: '', next_renewal_date: '', renewal_interval_years: '', notes: '',
};

export default function IPAssets() {
  const { staff } = useAuth();
  const [isComplianceHead, setIsComplianceHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isComplianceHead;
  const canDelete = staff?.role === 'owner';

  const [tab, setTab] = useState('trademark');
  const [assets, setAssets] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    client.get('/ip-assets').then(({ data }) => setAssets(data.ipAssets)).catch(() => setAssets([]));
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (['owner', 'admin'].includes(staff?.role)) return;
    client.get('/departments/my-access')
      .then(({ data }) => {
        const dept = data.deptAccess;
        setIsComplianceHead(!!(dept?.isHOD && dept?.departmentName === 'Legal & Compliance'));
      })
      .catch(() => setIsComplianceHead(false));
  }, [staff?.role]);

  const filtered = assets.filter((a) => a.ip_type === tab);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, ip_type: tab });
    setError('');
    setOpen(true);
  };

  const openEdit = (asset) => {
    setEditingId(asset.id);
    setForm({
      ip_type: asset.ip_type, title: asset.title, application_number: asset.application_number || '',
      registration_number: asset.registration_number || '', status: asset.status,
      filing_date: asset.filing_date?.slice(0, 10) || '', grant_date: asset.grant_date?.slice(0, 10) || '',
      next_renewal_date: asset.next_renewal_date?.slice(0, 10) || '', renewal_interval_years: asset.renewal_interval_years || '',
      notes: asset.notes || '',
    });
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await client.put(`/ip-assets/${editingId}`, form);
      } else {
        await client.post('/ip-assets', form);
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (asset) => {
    if (!window.confirm(`Delete "${asset.title}"? This cannot be undone.`)) return;
    await client.delete(`/ip-assets/${asset.id}`);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">Intellectual Property</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Trademark and patent applications, status, and renewal dates.
          </Typography>
        </Box>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add {tab}</Button>}
      </Box>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Trademarks" value="trademark" />
        <Tab label="Patents" value="patent" />
      </Tabs>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Application #</TableCell>
              <TableCell>Registration #</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Next renewal</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((asset) => (
              <TableRow key={asset.id}>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{asset.title}</TableCell>
                <TableCell sx={{ fontSize: '0.85rem' }}>{asset.application_number || '—'}</TableCell>
                <TableCell sx={{ fontSize: '0.85rem' }}>{asset.registration_number || '—'}</TableCell>
                <TableCell><Chip size="small" label={asset.status} color={STATUS_COLOR[asset.status]} /></TableCell>
                <TableCell className="figure" sx={{ fontSize: '0.85rem' }}>{asset.next_renewal_date?.slice(0, 10) || '—'}</TableCell>
                <TableCell align="right">
                  {canEdit && <Button size="small" onClick={() => openEdit(asset)}>Edit</Button>}
                  {canDelete && <Button size="small" color="error" onClick={() => handleDelete(asset)}>Delete</Button>}
                </TableCell>
              </TableRow>
            ))}
            {!filtered.length && (
              <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No {tab}s tracked yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Add'} {form.ip_type}</DialogTitle>
        <DialogContent>
          <TextField fullWidth select label="Type" margin="normal" value={form.ip_type} disabled={!!editingId} onChange={(e) => setForm({ ...form, ip_type: e.target.value })}>
            <MenuItem value="trademark">Trademark</MenuItem>
            <MenuItem value="patent">Patent</MenuItem>
          </TextField>
          <TextField fullWidth label={form.ip_type === 'trademark' ? 'Mark name' : 'Invention title'} margin="normal" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField fullWidth label="Application number" margin="normal" value={form.application_number} onChange={(e) => setForm({ ...form, application_number: e.target.value })} />
          <TextField fullWidth label="Registration number" margin="normal" value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} />
          <TextField fullWidth select label="Status" margin="normal" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <MenuItem value="filed">Filed</MenuItem>
            <MenuItem value="examination">Examination</MenuItem>
            <MenuItem value="opposed">Opposed</MenuItem>
            <MenuItem value="granted">Granted</MenuItem>
            <MenuItem value="registered">Registered</MenuItem>
            <MenuItem value="abandoned">Abandoned</MenuItem>
            <MenuItem value="expired">Expired</MenuItem>
          </TextField>
          <TextField fullWidth type="date" label="Filing date" InputLabelProps={{ shrink: true }} margin="normal" value={form.filing_date} onChange={(e) => setForm({ ...form, filing_date: e.target.value })} />
          <TextField fullWidth type="date" label="Grant date" InputLabelProps={{ shrink: true }} margin="normal" value={form.grant_date} onChange={(e) => setForm({ ...form, grant_date: e.target.value })} />
          <TextField fullWidth type="date" label="Next renewal date" InputLabelProps={{ shrink: true }} margin="normal" value={form.next_renewal_date} onChange={(e) => setForm({ ...form, next_renewal_date: e.target.value })} />
          <TextField fullWidth label="Notes" margin="normal" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.title}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}