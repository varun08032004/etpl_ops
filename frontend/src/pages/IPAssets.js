import { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip, Tabs, Tab,
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
  useMobile,
} from '../components/MobileResponsive';

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
  const isMobile = useMobile();
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
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Intellectual Property</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Trademark and patent applications, status, and renewal dates.
          </Typography>
        </Box>
        {canEdit && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add {tab}</MobileButton>}
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider' }} variant="scrollable" scrollButtons="auto">
          <Tab label="Trademarks" value="trademark" />
          <Tab label="Patents" value="patent" />
        </Tabs>
      </MobilePaper>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
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
                  <TableCell sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{asset.title}</TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{asset.application_number || '—'}</TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{asset.registration_number || '—'}</TableCell>
                  <TableCell><Chip size="small" label={asset.status} color={STATUS_COLOR[asset.status]} /></TableCell>
                  <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{asset.next_renewal_date?.slice(0, 10) || '—'}</TableCell>
                  <TableCell align="right">
                    <MobileStack gap={1} direction="row">
                      {canEdit && <MobileButton size="small" onClick={() => openEdit(asset)}>Edit</MobileButton>}
                      {canDelete && <MobileButton size="small" color="error" onClick={() => handleDelete(asset)}>Delete</MobileButton>}
                    </MobileStack>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No {tab}s tracked yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Add'} {form.ip_type}</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField
              fullWidth
              select
              label="Type"
              value={form.ip_type}
              disabled={!!editingId}
              onChange={(e) => setForm({ ...form, ip_type: e.target.value })}
              options={[
                { value: 'trademark', label: 'Trademark' },
                { value: 'patent', label: 'Patent' },
              ]}
            />
            <MobileTextField fullWidth label={form.ip_type === 'trademark' ? 'Mark name' : 'Invention title'} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <MobileTextField fullWidth label="Application number" value={form.application_number} onChange={(e) => setForm({ ...form, application_number: e.target.value })} />
            <MobileTextField fullWidth label="Registration number" value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[
                { value: 'filed', label: 'Filed' },
                { value: 'examination', label: 'Examination' },
                { value: 'opposed', label: 'Opposed' },
                { value: 'granted', label: 'Granted' },
                { value: 'registered', label: 'Registered' },
                { value: 'abandoned', label: 'Abandoned' },
                { value: 'expired', label: 'Expired' },
              ]}
            />
            <MobileTextField fullWidth type="date" label="Filing date" InputLabelProps={{ shrink: true }} value={form.filing_date} onChange={(e) => setForm({ ...form, filing_date: e.target.value })} />
            <MobileTextField fullWidth type="date" label="Grant date" InputLabelProps={{ shrink: true }} value={form.grant_date} onChange={(e) => setForm({ ...form, grant_date: e.target.value })} />
            <MobileTextField fullWidth type="date" label="Next renewal date" InputLabelProps={{ shrink: true }} value={form.next_renewal_date} onChange={(e) => setForm({ ...form, next_renewal_date: e.target.value })} />
            <MobileTextField fullWidth label="Notes" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleSave} disabled={saving || !form.title}>
            {saving ? 'Saving…' : 'Save'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}