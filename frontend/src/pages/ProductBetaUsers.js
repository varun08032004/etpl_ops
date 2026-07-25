import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const STAGE_COLOR = { waitlist: 'default', onboarded: 'info', active: 'success', churned: 'error', inactive: 'default' };
const STAGES = ['waitlist', 'onboarded', 'active', 'churned', 'inactive'];
const AREAS = ['portfolio_management', 'marketplace', 'emission_tracking', 'reports', 'platform', 'other'];
const AREA_LABEL = { portfolio_management: 'Portfolio Mgmt', marketplace: 'Marketplace', emission_tracking: 'Emission Tracking', reports: 'Reports', platform: 'Platform', other: 'Other' };

const emptyForm = { name: '', company_name: '', email: '', phone: '', stage: 'waitlist', areas_of_interest: [], joined_date: '', notes: '' };

export default function ProductBetaUsers() {
  const { staff } = useAuth();
  const [isProductHead, setIsProductHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isProductHead;
  const canConvert = ['owner', 'admin', 'finance'].includes(staff?.role) || isProductHead;
  const canDelete = staff?.role === 'owner';

  const [betaUsers, setBetaUsers] = useState([]);
  const [stageFilter, setStageFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    const params = stageFilter ? { stage: stageFilter } : {};
    client.get('/product/beta-users', { params }).then(({ data }) => setBetaUsers(data.betaUsers)).catch(() => setBetaUsers([]));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [stageFilter]);

  useEffect(() => {
    if (['owner', 'admin'].includes(staff?.role)) return;
    client.get('/departments/my-access')
      .then(({ data }) => {
        const dept = data.deptAccess;
        setIsProductHead(!!(dept?.isHOD && dept?.departmentName === 'Product'));
      })
      .catch(() => setIsProductHead(false));
  }, [staff?.role]);

  const totals = betaUsers.reduce((acc, b) => {
    acc.total++;
    if (b.stage === 'active') acc.active++;
    return acc;
  }, { total: 0, active: 0 });

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setError(''); setOpen(true); };
  const openEdit = (b) => {
    setEditingId(b.id);
    setForm({
      name: b.name, company_name: b.company_name || '', email: b.email || '', phone: b.phone || '',
      stage: b.stage, areas_of_interest: b.areas_of_interest || [], joined_date: b.joined_date?.slice(0, 10) || '',
      notes: b.notes || '',
    });
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingId) await client.put(`/product/beta-users/${editingId}`, form);
      else await client.post('/product/beta-users', form);
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async (b) => {
    if (!window.confirm(`Convert "${b.name}" into a real CRM customer?`)) return;
    try {
      await client.post(`/product/beta-users/${b.id}/convert`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to convert');
    }
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Delete "${b.name}"? This cannot be undone.`)) return;
    await client.delete(`/product/beta-users/${b.id}`);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">Beta / Pilot Users</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Early testers and design partners on ethertrack.in — separate from paying customers until they convert.
          </Typography>
        </Box>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add tester</Button>}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 2, minWidth: 140 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Total testers</Typography>
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }} className="figure">{totals.total}</Typography>
        </Paper>
        <Paper sx={{ p: 2, minWidth: 140 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Active</Typography>
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }} className="figure">{totals.active}</Typography>
        </Paper>
      </Box>

      <TextField select size="small" label="Filter stage" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} sx={{ mb: 2, minWidth: 180 }}>
        <MenuItem value="">All stages</MenuItem>
        {STAGES.map((s) => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>)}
      </TextField>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name / company</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Interested in</TableCell>
              <TableCell>Stage</TableCell>
              <TableCell>Joined</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {betaUsers.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{b.name}</Typography>
                  {b.company_name && <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{b.company_name}</Typography>}
                </TableCell>
                <TableCell sx={{ fontSize: '0.8rem' }}>
                  {b.email && <div>{b.email}</div>}
                  {b.phone && <div>{b.phone}</div>}
                </TableCell>
                <TableCell>
                  {(b.areas_of_interest || []).map((a) => <Chip key={a} size="small" label={AREA_LABEL[a] || a} sx={{ mr: 0.5, mb: 0.5, fontSize: '0.68rem' }} />)}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={b.stage} color={STAGE_COLOR[b.stage]} sx={{ textTransform: 'capitalize' }} />
                  {b.converted_party_id && <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mt: 0.5 }}>→ Converted to CRM</Typography>}
                </TableCell>
                <TableCell className="figure" sx={{ fontSize: '0.8rem' }}>{b.joined_date?.slice(0, 10) || '—'}</TableCell>
                <TableCell align="right">
                  {canConvert && !b.converted_party_id && <Button size="small" onClick={() => handleConvert(b)}>Convert</Button>}
                  {canEdit && <Button size="small" onClick={() => openEdit(b)}>Edit</Button>}
                  {canDelete && <Button size="small" color="error" onClick={() => handleDelete(b)}>Delete</Button>}
                </TableCell>
              </TableRow>
            ))}
            {!betaUsers.length && (
              <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No beta users yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Add'} beta user</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Name" margin="normal" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField fullWidth label="Company (optional)" margin="normal" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          <TextField fullWidth label="Email" margin="normal" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField fullWidth label="Phone" margin="normal" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <TextField fullWidth select label="Stage" margin="normal" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
            {STAGES.map((s) => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>)}
          </TextField>
          <TextField
            fullWidth select label="Areas of interest" margin="normal" SelectProps={{ multiple: true }}
            value={form.areas_of_interest} onChange={(e) => setForm({ ...form, areas_of_interest: e.target.value })}
          >
            {AREAS.map((a) => <MenuItem key={a} value={a}>{AREA_LABEL[a] || a}</MenuItem>)}
          </TextField>
          <TextField fullWidth type="date" label="Joined date" InputLabelProps={{ shrink: true }} margin="normal" value={form.joined_date} onChange={(e) => setForm({ ...form, joined_date: e.target.value })} />
          <TextField fullWidth label="Notes" margin="normal" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}