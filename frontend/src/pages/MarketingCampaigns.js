import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
  LinearProgress, Tabs, Tab,
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
  useMobile,
} from '../components/MobileResponsive';

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
  const isMobile = useMobile();
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
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Campaigns</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Budget, channel, timeline, and results for every marketing push.
          </Typography>
        </Box>
        {canEdit && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New campaign</MobileButton>}
      </MobilePageHeader>

      <MobileStack gap={2} direction="row" sx={{ mb: 3, flexWrap: 'wrap' }}>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Total budget</Typography>
          <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }}><Money amount={totals.budget} /></Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Total spent</Typography>
          <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }}><Money amount={totals.spent} /></Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Leads generated</Typography>
          <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }} className="figure">{totals.leads}</Typography>
        </MobilePaper>
      </MobileStack>

      <MobilePaper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider' }} variant="scrollable" scrollButtons="auto">
          {TABS.map((t) => <Tab key={t.value} label={t.label} value={t.value} />)}
        </Tabs>
      </MobilePaper>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
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
                      <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{c.name}</Typography>
                      {c.objective && <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>{c.objective}</Typography>}
                    </TableCell>
                    <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{c.channel || '—'}</TableCell>
                    <TableCell><Chip size="small" label={c.status} color={STATUS_COLOR[c.status]} sx={{ textTransform: 'capitalize' }} /></TableCell>
                    <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }} className="figure">
                      {c.start_date?.slice(0, 10) || '—'} → {c.end_date?.slice(0, 10) || '—'}
                    </TableCell>
                    <TableCell sx={{ minWidth: 140 }}>
                      <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.78rem' }} className="figure">
                        <Money amount={spent} /> / <Money amount={budget} />
                      </Typography>
                      {budget > 0 && <LinearProgress variant="determinate" value={pct} sx={{ mt: 0.5, height: 5, borderRadius: 3 }} color={pct >= 100 ? 'error' : 'primary'} />}
                    </TableCell>
                    <TableCell align="right" className="figure">{c.leads_generated || 0}</TableCell>
                    <TableCell align="right">
                      <MobileStack gap={1} direction="row">
                        {canEdit && <MobileButton size="small" onClick={() => openEdit(c)}>Edit</MobileButton>}
                        {canDelete && <MobileButton size="small" color="error" onClick={() => handleDelete(c)}>Delete</MobileButton>}
                      </MobileStack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!filtered.length && (
                <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No campaigns here yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'New'} campaign</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth label="Campaign name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <MobileTextField fullWidth label="Objective" multiline rows={2} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
            <MobileTextField fullWidth label="Channel (e.g. Instagram Ads, LinkedIn, Email, SEO, Event)" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[
                { value: 'planned', label: 'Planned' },
                { value: 'active', label: 'Active' },
                { value: 'paused', label: 'Paused' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
            <MobileStack gap={1.5} direction="row" flexWrap="wrap">
              <MobileTextField fullWidth type="date" label="Start date" InputLabelProps={{ shrink: true }} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              <MobileTextField fullWidth type="date" label="End date" InputLabelProps={{ shrink: true }} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </MobileStack>
            <MobileStack gap={1.5} direction="row" flexWrap="wrap">
              <MobileTextField fullWidth type="number" label="Budget (₹)" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
              <MobileTextField fullWidth type="number" label="Amount spent (₹)" value={form.amount_spent} onChange={(e) => setForm({ ...form, amount_spent: e.target.value })} />
            </MobileStack>
            <MobileStack gap={1.5} direction="row" flexWrap="wrap">
              <MobileTextField fullWidth type="number" label="Leads generated" value={form.leads_generated} onChange={(e) => setForm({ ...form, leads_generated: e.target.value })} />
              <MobileTextField fullWidth type="number" label="Conversions" value={form.conversions} onChange={(e) => setForm({ ...form, conversions: e.target.value })} />
            </MobileStack>
            <MobileTextField fullWidth label="Notes" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? 'Saving…' : 'Save'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}