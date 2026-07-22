import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Chip, IconButton, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const TIER_COLOR = { direct: 'error', indirect: 'warning', adjacent: 'default' };

const emptyForm = { name: '', website: '', tier: 'direct', pricing_notes: '', strengths: '', weaknesses: '', last_reviewed_date: '', notes: '' };

export default function MarketingCompetitors() {
  const { staff } = useAuth();
  const [isMarketingHead, setIsMarketingHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isMarketingHead;

  const [competitors, setCompetitors] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => client.get('/marketing/competitors').then(({ data }) => setCompetitors(data.competitors)).catch(() => setCompetitors([]));
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
  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({
      name: c.name, website: c.website || '', tier: c.tier, pricing_notes: c.pricing_notes || '',
      strengths: c.strengths || '', weaknesses: c.weaknesses || '',
      last_reviewed_date: c.last_reviewed_date?.slice(0, 10) || '', notes: c.notes || '',
    });
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingId) await client.put(`/marketing/competitors/${editingId}`, form);
      else await client.post('/marketing/competitors', form);
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
    await client.delete(`/marketing/competitors/${c.id}`);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">Competitors</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Other players in CCTS/BRSR/ESG compliance software — pricing, positioning, and how EtherTrack stacks up.
          </Typography>
        </Box>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add competitor</Button>}
      </Box>

      <Grid container spacing={2}>
        {competitors.map((c) => (
          <Grid item xs={12} sm={6} md={4} key={c.id}>
            <Paper sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', flex: 1 }} noWrap>{c.name}</Typography>
                <Chip size="small" label={c.tier} color={TIER_COLOR[c.tier]} sx={{ textTransform: 'capitalize' }} />
              </Box>
              {c.pricing_notes && <Typography sx={{ fontSize: '0.78rem' }}><strong>Pricing:</strong> {c.pricing_notes}</Typography>}
              {c.strengths && <Typography sx={{ fontSize: '0.78rem', color: 'success.main' }}><strong>Strengths:</strong> {c.strengths}</Typography>}
              {c.weaknesses && <Typography sx={{ fontSize: '0.78rem', color: 'error.main' }}><strong>Weaknesses:</strong> {c.weaknesses}</Typography>}
              {c.last_reviewed_date && <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Last reviewed {c.last_reviewed_date.slice(0, 10)}</Typography>}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto', pt: 1 }}>
                {c.website ? (
                  <Button size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />} href={c.website} target="_blank" rel="noopener noreferrer">Website</Button>
                ) : <span />}
                {canEdit && (
                  <Box>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(c)}><EditIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(c)}><DeleteIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>
        ))}
        {!competitors.length && (
          <Grid item xs={12}><Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>No competitors tracked yet.</Paper></Grid>
        )}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Add'} competitor</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Name" margin="normal" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField fullWidth label="Website" margin="normal" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <TextField fullWidth select label="Tier" margin="normal" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
            <MenuItem value="direct">Direct</MenuItem>
            <MenuItem value="indirect">Indirect</MenuItem>
            <MenuItem value="adjacent">Adjacent</MenuItem>
          </TextField>
          <TextField fullWidth label="Pricing notes" margin="normal" multiline rows={2} value={form.pricing_notes} onChange={(e) => setForm({ ...form, pricing_notes: e.target.value })} />
          <TextField fullWidth label="Strengths" margin="normal" multiline rows={2} value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} />
          <TextField fullWidth label="Weaknesses" margin="normal" multiline rows={2} value={form.weaknesses} onChange={(e) => setForm({ ...form, weaknesses: e.target.value })} />
          <TextField fullWidth type="date" label="Last reviewed" InputLabelProps={{ shrink: true }} margin="normal" value={form.last_reviewed_date} onChange={(e) => setForm({ ...form, last_reviewed_date: e.target.value })} />
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