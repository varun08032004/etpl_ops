import { useEffect, useState, useCallback } from 'react';
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
  MobileCardGrid,
  useMobile,
} from '../components/MobileResponsive';

const STAGE_COLOR = { waitlist: 'default', onboarded: 'info', active: 'success', churned: 'error', inactive: 'default' };
const STAGES = ['waitlist', 'onboarded', 'active', 'churned', 'inactive'];
const AREAS = ['portfolio_management', 'marketplace', 'emission_tracking', 'reports', 'platform', 'other'];
const AREA_LABEL = { portfolio_management: 'Portfolio Mgmt', marketplace: 'Marketplace', emission_tracking: 'Emission Tracking', reports: 'Reports', platform: 'Platform', other: 'Other' };

const emptyForm = { name: '', company_name: '', email: '', phone: '', stage: 'waitlist', areas_of_interest: [], joined_date: '', notes: '' };

export default function ProductBetaUsers() {
  const isMobile = useMobile();
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

  const load = useCallback(() => {
    const params = stageFilter ? { stage: stageFilter } : {};
    client.get('/product/beta-users', { params }).then(({ data }) => setBetaUsers(data.betaUsers)).catch(() => setBetaUsers([]));
  }, [stageFilter]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [load]);

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
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Beta / Pilot Users</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Early testers and design partners on ethertrack.in — separate from paying customers until they convert.
          </Typography>
        </Box>
        {canEdit && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add tester</MobileButton>}
      </MobilePageHeader>

      <MobileCardGrid sx={{ mb: 3 }}>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Total testers</Typography>
          <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }} className="figure">{totals.total}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Active</Typography>
          <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }} className="figure">{totals.active}</Typography>
        </MobilePaper>
      </MobileCardGrid>

      <MobilePaper sx={{ mb: 2 }}>
        <MobileTextField
          select
          size="small"
          label="Filter stage"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          options={[{ value: '', label: 'All stages' }, ...STAGES.map((s) => ({ value: s, label: s }))]}
        />
      </MobilePaper>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
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
                    <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{b.name}</Typography>
                    {b.company_name && <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>{b.company_name}</Typography>}
                  </TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }}>
                    {b.email && <div>{b.email}</div>}
                    {b.phone && <div>{b.phone}</div>}
                  </TableCell>
                  <TableCell>
                    {(b.areas_of_interest || []).map((a) => <Chip key={a} size="small" label={AREA_LABEL[a] || a} sx={{ mr: 0.5, mb: 0.5, fontSize: isMobile ? '0.62rem' : '0.68rem' }} />)}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={b.stage} color={STAGE_COLOR[b.stage]} sx={{ textTransform: 'capitalize' }} />
                    {b.converted_party_id && <Typography sx={{ fontSize: isMobile ? '0.6rem' : '0.68rem', color: 'text.secondary', mt: 0.5 }}>→ Converted to CRM</Typography>}
                  </TableCell>
                  <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.8rem' }}>{b.joined_date?.slice(0, 10) || '—'}</TableCell>
                  <TableCell align="right">
                    <MobileStack gap={1} direction="row">
                      {canConvert && !b.converted_party_id && <MobileButton size="small" onClick={() => handleConvert(b)}>Convert</MobileButton>}
                      {canEdit && <MobileButton size="small" onClick={() => openEdit(b)}>Edit</MobileButton>}
                      {canDelete && <MobileButton size="small" color="error" onClick={() => handleDelete(b)}>Delete</MobileButton>}
                    </MobileStack>
                  </TableCell>
                </TableRow>
              ))}
              {!betaUsers.length && (
                <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No beta users yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Add'} beta user</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <MobileTextField fullWidth label="Company (optional)" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            <MobileTextField fullWidth label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <MobileTextField fullWidth label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Stage"
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value })}
              options={STAGES.map((s) => ({ value: s, label: s }))}
            />
            <MobileTextField
              fullWidth
              select
              label="Areas of interest"
              value={form.areas_of_interest}
              onChange={(e) => setForm({ ...form, areas_of_interest: e.target.value })}
              options={AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] || a }))}
            />
            <MobileTextField fullWidth type="date" label="Joined date" InputLabelProps={{ shrink: true }} value={form.joined_date} onChange={(e) => setForm({ ...form, joined_date: e.target.value })} />
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