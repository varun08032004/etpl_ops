import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Chip, Grid,
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
  useMobile,
} from '../components/MobileResponsive';

const STATUSES = ['backlog', 'planned', 'in_progress', 'testing', 'shipped', 'cancelled'];
const STATUS_LABEL = { backlog: 'Backlog', planned: 'Planned', in_progress: 'In Progress', testing: 'Testing', shipped: 'Shipped', cancelled: 'Cancelled' };
const AREAS = ['portfolio_management', 'marketplace', 'emission_tracking', 'reports', 'platform', 'other'];
const AREA_LABEL = { portfolio_management: 'Portfolio Mgmt', marketplace: 'Marketplace', emission_tracking: 'Emission Tracking', reports: 'Reports', platform: 'Platform' };
const PRIORITY_COLOR = { critical: 'error', high: 'warning', medium: 'info', low: 'default' };

const emptyForm = { title: '', description: '', area: 'portfolio_management', status: 'backlog', priority: 'medium', target_date: '', notes: '' };

export default function ProductRoadmap() {
  const isMobile = useMobile();
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
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Roadmap</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            What's being built across Portfolio Management, Marketplace, Emission Tracking, and Reports.
          </Typography>
        </Box>
        <MobileStack gap={1} direction="row" flexWrap="wrap">
          <MobileTextField
            select
            size="small"
            label="Filter area"
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            options={[{ value: '', label: 'All areas' }, ...AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] || a }))]}
          />
          {canEdit && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={() => openCreate()}>Add item</MobileButton>}
        </MobileStack>
      </MobilePageHeader>

      <MobileStack gap={2} direction="column">
        {STATUSES.map((status) => {
          const items = features.filter((f) => f.status === status);
          return (
            <MobilePaper key={status} sx={{ mb: 1 }}>
              <Box sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.78rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {STATUS_LABEL[status]} ({items.length})
                </Typography>
              </Box>
              <MobileStack gap={1} direction="column">
                {items.map((f) => (
                  <MobilePaper key={f.id} variant="outlined" sx={{ p: 1.5, cursor: canEdit ? 'pointer' : 'default' }} onClick={() => canEdit && openEdit(f)}>
                    <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.82rem', fontWeight: 600 }}>{f.title}</Typography>
                    <MobileStack gap={0.5} direction="row" flexWrap="wrap" sx={{ mt: 0.75 }}>
                      <Chip size="small" label={AREA_LABEL[f.area] || f.area} sx={{ fontSize: isMobile ? '0.6rem' : '0.65rem', height: 20 }} />
                      <Chip size="small" label={f.priority} color={PRIORITY_COLOR[f.priority]} sx={{ fontSize: isMobile ? '0.6rem' : '0.65rem', height: 20, textTransform: 'capitalize' }} />
                    </MobileStack>
                    {f.target_date && <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.7rem', color: 'text.secondary', mt: 0.5 }} className="figure">{f.target_date.slice(0, 10)}</Typography>}
                    {f.owner_name && <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.7rem', color: 'text.secondary' }}>{f.owner_name}</Typography>}
                    {canEdit && (
                      <MobileStack gap={0.5} direction="row" sx={{ mt: 1 }}>
                        <MobileTextField
                          select
                          size="small"
                          value={f.status}
                          onChange={(e) => quickStatusChange(f, e.target.value)}
                          options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
                        />
                      </MobileStack>
                    )}
                  </MobilePaper>
                ))}
                {!items.length && (
                  <MobilePaper variant="outlined" sx={{ p: 1.5, textAlign: 'center', color: 'text.secondary', fontSize: isMobile ? '0.7rem' : '0.75rem' }}>—</MobilePaper>
                )}
              </MobileStack>
            </MobilePaper>
          );
        })}
      </MobileStack>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Add'} roadmap item</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <MobileTextField fullWidth label="Description" multiline rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Area"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
              options={AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] || a }))}
            />
            <MobileTextField
              fullWidth
              select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
            <MobileTextField
              fullWidth
              select
              label="Priority"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'critical', label: 'Critical' },
              ]}
            />
            <MobileTextField fullWidth type="date" label="Target date" InputLabelProps={{ shrink: true }} value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
            <MobileTextField fullWidth label="Notes" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          {editingId && canDelete && <MobileButton color="error" onClick={() => { handleDelete({ id: editingId, title: form.title }); setOpen(false); }}>Delete</MobileButton>}
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleSave} disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save'}</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}