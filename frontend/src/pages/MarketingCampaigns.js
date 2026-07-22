import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
  LinearProgress, Tabs, Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import Money from '../components/Money';
import { useAuth } from '../context/AuthContext';

const STATUS_COLOR = { planned: 'default', active: 'success', paused: 'warning', completed: 'info', cancelled: 'error' };
const TABS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'planned', label: 'Planned' },
  { value: 'completed', label: 'Completed' },
];

const emptyForm = {
  name: '', objective: '', channel: '', status: 'planned', start_date: '', end_date: '',
  budget: '', amount_spent: '', leads_generated: '', conversions: '', notes: '',
};

export default function MarketingCampaigns() {
  const { staff } = useAuth();
  const [isMarketingHead, setIsMarketingHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isMarketingHead;
  const canDelete = staff?.role === 'owner';

  const [tab, setTab] = useState('all');
  const [campaigns, setCampaigns] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    client.get('/marketing/campaigns').then(({ data }) => setCampaigns(data.campaigns)).catch(() => setCampaigns([]));
  };
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

  const filtered = tab === 'all' ? campaigns : campaigns.filter((c) => c.status === tab);

  const totals = campaigns.reduce((acc, c) => ({
    budget: acc.budget + Number(c.budget || 0),
    spent: acc.spent + Number(c.amount_spent || 0),
    leads: acc.leads + Number(c.leads_generated || 0),
  }), { budget: 0, spent: 0, leads: 0 });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({
      name: c.name, objective: c.objective || '', channel: c.channel || '', status: c.status,
      start_date: c.start_date?.slice(0, 10) || '', end_date: c.end_date?.slice(0, 10) || '',
      budget: c.budget ?? '', amount_spent: c.amount_spent ?? '', leads_generated: c.leads_generated ?? '',
      conversions: c.conversions ?? '', notes: c.notes || '',
    });
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await client.put(`/marketing/campaigns/${editingId}`, form);
      } else {
        await client.post('/marketing/campaigns', form);
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete campaign "${c.name}"? This cannot be undone.`)) return;
    await client.delete(`/marketing/campaigns/${c.id}`);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">Campaigns</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Budget, channel, timeline, and results for every marketing push.
          </Typography>
        </Box>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New campaign</Button>}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 2, minWidth: 160 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Total budget</Typography>
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }}><Money amount={totals.budget} /></Typography>
        </Paper>
        <Paper sx={{ p: 2, minWidth: 160 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Total spent</Typography>
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }}><Money amount={totals.spent} /></Typography>
        </Paper>
        <Paper sx={{ p: 2, minWidth: 160 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Leads generated</Typography>
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }} className="figure">{totals.leads}</Typography>
        </Paper>
      </Box>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        {TABS.map((t) => <Tab key={t.value} label={t.label} value={t.value} />)}
      </Tabs>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Campaign</TableCell>
              <TableCell>Channel</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Dates</TableCell>
              <TableCell>Budget vs spent</TableCell>
              <TableCell align="right">Leads</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((c) => {
              const budget = Number(c.budget || 0);
              const spent = Number(c.amount_spent || 0);
              const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.name}</Typography>
                    {c.objective && <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{c.objective}</Typography>}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.85rem' }}>{c.channel || '—'}</TableCell>
                  <TableCell><Chip size="small" label={c.status} color={STATUS_COLOR[c.status]} sx={{ textTransform: 'capitalize' }} /></TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }} className="figure">
                    {c.start_date?.slice(0, 10) || '—'} → {c.end_date?.slice(0, 10) || '—'}
                  </TableCell>
                  <TableCell sx={{ minWidth: 140 }}>
                    <Typography sx={{ fontSize: '0.78rem' }} className="figure">
                      <Money amount={spent} /> / <Money amount={budget} />
                    </Typography>
                    {budget > 0 && <LinearProgress variant="determinate" value={pct} sx={{ mt: 0.5, height: 5, borderRadius: 3 }} color={pct >= 100 ? 'error' : 'primary'} />}
                  </TableCell>
                  <TableCell align="right" className="figure">{c.leads_generated || 0}</TableCell>
                  <TableCell align="right">
                    {canEdit && <Button size="small" onClick={() => openEdit(c)}>Edit</Button>}
                    {canDelete && <Button size="small" color="error" onClick={() => handleDelete(c)}>Delete</Button>}
                  </TableCell>
                </TableRow>
              );
            })}
            {!filtered.length && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No campaigns here yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'New'} campaign</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Campaign name" margin="normal" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField fullWidth label="Objective" margin="normal" multiline rows={2} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
          <TextField fullWidth label="Channel (e.g. Instagram Ads, LinkedIn, Email, SEO, Event)" margin="normal" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} />
          <TextField fullWidth select label="Status" margin="normal" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <MenuItem value="planned">Planned</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="paused">Paused</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </TextField>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField fullWidth type="date" label="Start date" InputLabelProps={{ shrink: true }} margin="normal" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            <TextField fullWidth type="date" label="End date" InputLabelProps={{ shrink: true }} margin="normal" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField fullWidth type="number" label="Budget (₹)" margin="normal" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
            <TextField fullWidth type="number" label="Amount spent (₹)" margin="normal" value={form.amount_spent} onChange={(e) => setForm({ ...form, amount_spent: e.target.value })} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField fullWidth type="number" label="Leads generated" margin="normal" value={form.leads_generated} onChange={(e) => setForm({ ...form, leads_generated: e.target.value })} />
            <TextField fullWidth type="number" label="Conversions" margin="normal" value={form.conversions} onChange={(e) => setForm({ ...form, conversions: e.target.value })} />
          </Box>
          <TextField fullWidth label="Notes" margin="normal" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}