import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import {
  MobilePaper,
  MobilePageHeader,
  MobileFormGrid,
  MobileActionButtons,
  MobileDialog,
  MobileButton,
  MobileTextField,
  MobileStack,
  ResponsiveTableContainer,
  useMobile,
} from '../components/MobileResponsive';

const CATEGORIES = ['gst', 'tds', 'roc', 'pf', 'esic', 'iso', 'trademark', 'labour', 'dpiit', 'other'];
const STATUS_COLOR = { not_started: 'default', in_progress: 'info', filed: 'success' };

const emptyForm = { category: 'gst', title: '', description: '', owner_employee_id: '', due_date: '', recurring_interval: '', valid_from: '', valid_till: '' };

export default function Compliance() {
  const isMobile = useMobile();
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [fileTarget, setFileTarget] = useState(null);
  const [fileUploading, setFileUploading] = useState(false);

  const load = useCallback(() => {
    const params = statusFilter ? { status: statusFilter } : {};
    client.get('/compliance', { params }).then(({ data }) => setItems(data.items)).catch(() => setItems([]));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { client.get('/employees').then(({ data }) => setEmployees(data.employees)).catch(() => {}); }, []);

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post('/compliance', { ...form, owner_employee_id: form.owner_employee_id || null, recurring_interval: form.recurring_interval || null });
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create item');
    } finally {
      setSaving(false);
    }
  };

  const startItem = async (id) => {
    await client.post(`/compliance/${id}/start`);
    load();
  };

  const revertItem = async (id) => {
    if (!window.confirm('Revert this back to "Not started"? Use this if Start was clicked by mistake.')) return;
    await client.post(`/compliance/${id}/revert-to-not-started`);
    load();
  };

  const openFile = (item) => setFileTarget(item);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file || !fileTarget) return;
    setFileUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', `${fileTarget.title} — Filing evidence`);
      fd.append('doc_type', 'compliance_filing');
      fd.append('entity_type', 'compliance_item');
      fd.append('entity_id', fileTarget.id);
      const { data: docRes } = await client.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await client.post(`/compliance/${fileTarget.id}/file`, { filed_document_id: docRes.document.id });
      setFileTarget(null);
      load();
    } finally {
      setFileUploading(false);
    }
  };

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Compliance</Typography>
        <MobileButton variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Add item</MobileButton>
      </MobilePageHeader>

      <MobileStack gap={2} direction="row" sx={{ mb: 2.5 }}>
        <MobileTextField
          select
          size="small"
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[{ value: '', label: 'All' }, ...Object.keys(STATUS_COLOR).map((s) => ({ value: s, label: s.replace('_', ' ') }))]}
        />
      </MobileStack>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Due date</TableCell>
                <TableCell>Valid till</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{item.title}</TableCell>
                  <TableCell><Chip size="small" label={item.category} variant="outlined" /></TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{item.owner_name || '—'}</TableCell>
                  <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>
                    {item.due_date?.slice(0, 10)}
                    {item.is_overdue && <Chip size="small" color="error" label="Overdue" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell className="figure" sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary' }}>
                    {item.valid_till ? item.valid_till.slice(0, 10) : '—'}
                  </TableCell>
                  <TableCell><Chip size="small" label={item.status.replace('_', ' ')} color={STATUS_COLOR[item.status]} variant={item.status === 'not_started' ? 'outlined' : 'filled'} /></TableCell>
                  <TableCell align="right">
                    <MobileStack gap={1} direction="row">
                      {item.status === 'not_started' && <MobileButton size="small" onClick={() => startItem(item.id)}>Start</MobileButton>}
                      {item.status === 'in_progress' && <MobileButton size="small" color="warning" onClick={() => revertItem(item.id)}>Revert</MobileButton>}
                      {item.status !== 'filed' && <MobileButton size="small" onClick={() => openFile(item)}>File</MobileButton>}
                    </MobileStack>
                  </TableCell>
                </TableRow>
              ))}
              {!items.length && (
                <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No compliance items.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add compliance item</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField
              fullWidth
              select
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={CATEGORIES.map((c) => ({ value: c, label: c.toUpperCase() }))}
            />
            <MobileTextField fullWidth label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <MobileTextField fullWidth label="Description" multiline rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Owner"
              value={form.owner_employee_id}
              onChange={(e) => setForm({ ...form, owner_employee_id: e.target.value })}
              options={[{ value: '', label: 'Unassigned' }, ...employees.map((e) => ({ value: e.id, label: e.full_name }))]}
            />
            <MobileTextField fullWidth type="date" label="Due date" InputLabelProps={{ shrink: true }} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            <MobileTextField fullWidth type="date" label="Valid from" InputLabelProps={{ shrink: true }} value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} helperText="When this registration/license starts" />
            <MobileTextField fullWidth type="date" label="Valid till" InputLabelProps={{ shrink: true }} value={form.valid_till} onChange={(e) => setForm({ ...form, valid_till: e.target.value })} helperText="When it expires/needs renewal" />
            <MobileTextField
              fullWidth
              select
              label="Recurs"
              value={form.recurring_interval}
              onChange={(e) => setForm({ ...form, recurring_interval: e.target.value })}
              options={[{ value: '', label: 'One-off' }, { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'annual', label: 'Annual' }]}
            />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleCreate} disabled={saving || !form.title || !form.due_date}>
            {saving ? 'Creating…' : 'Create'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      <MobileDialog open={!!fileTarget} onClose={() => setFileTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>File — {fileTarget?.title}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>Upload the evidentiary document (filed return, certificate, receipt) to mark this filed.</Alert>
          <MobileButton component="label" variant="outlined" fullWidth disabled={fileUploading}>
            {fileUploading ? 'Uploading…' : 'Choose file'}
            <input type="file" hidden onChange={handleFile} />
          </MobileButton>
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setFileTarget(null)}>Cancel</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}