import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';

const CATEGORIES = ['gst', 'tds', 'roc', 'pf', 'esic', 'iso', 'trademark', 'labour', 'dpiit', 'other'];
const STATUS_COLOR = { not_started: 'default', in_progress: 'info', filed: 'success' };

const emptyForm = { category: 'gst', title: '', description: '', owner_employee_id: '', due_date: '', recurring_interval: '', valid_from: '', valid_till: '' };

export default function Compliance() {
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [fileTarget, setFileTarget] = useState(null);
  const [fileUploading, setFileUploading] = useState(false);

  const load = () => {
    const params = statusFilter ? { status: statusFilter } : {};
    client.get('/compliance', { params }).then(({ data }) => setItems(data.items)).catch(() => setItems([]));
  };

  useEffect(() => { load(); }, [statusFilter]);
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Compliance</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Add item</Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
        <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">All</MenuItem>
          {Object.keys(STATUS_COLOR).map((s) => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
        </TextField>
      </Box>

      <Paper>
        <Table>
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
                <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.title}</TableCell>
                <TableCell><Chip size="small" label={item.category} variant="outlined" /></TableCell>
                <TableCell sx={{ fontSize: '0.85rem' }}>{item.owner_name || '—'}</TableCell>
                <TableCell className="figure" sx={{ fontSize: '0.85rem' }}>
                  {item.due_date?.slice(0, 10)}
                  {item.is_overdue && <Chip size="small" color="error" label="Overdue" sx={{ ml: 1 }} />}
                </TableCell>
                <TableCell className="figure" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                  {item.valid_till ? item.valid_till.slice(0, 10) : '—'}
                </TableCell>
                <TableCell><Chip size="small" label={item.status.replace('_', ' ')} color={STATUS_COLOR[item.status]} variant={item.status === 'not_started' ? 'outlined' : 'filled'} /></TableCell>
                <TableCell align="right">
                  {item.status === 'not_started' && <Button size="small" onClick={() => startItem(item.id)}>Start</Button>}
                  {item.status !== 'filed' && <Button size="small" onClick={() => openFile(item)}>File</Button>}
                </TableCell>
              </TableRow>
            ))}
            {!items.length && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No compliance items.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add compliance item</DialogTitle>
        <DialogContent>
          <TextField fullWidth select label="Category" margin="normal" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c.toUpperCase()}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Title" margin="normal" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField fullWidth label="Description" margin="normal" multiline rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <TextField fullWidth select label="Owner" margin="normal" value={form.owner_employee_id} onChange={(e) => setForm({ ...form, owner_employee_id: e.target.value })}>
            <MenuItem value="">Unassigned</MenuItem>
            {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}
          </TextField>
          <TextField fullWidth type="date" label="Due date" InputLabelProps={{ shrink: true }} margin="normal" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField fullWidth type="date" label="Valid from" InputLabelProps={{ shrink: true }} margin="normal" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} helperText="When this registration/license starts" />
            <TextField fullWidth type="date" label="Valid till" InputLabelProps={{ shrink: true }} margin="normal" value={form.valid_till} onChange={(e) => setForm({ ...form, valid_till: e.target.value })} helperText="When it expires/needs renewal" />
          </Box>
          <TextField fullWidth select label="Recurs" margin="normal" value={form.recurring_interval} onChange={(e) => setForm({ ...form, recurring_interval: e.target.value })}>
            <MenuItem value="">One-off</MenuItem>
            <MenuItem value="monthly">Monthly</MenuItem>
            <MenuItem value="quarterly">Quarterly</MenuItem>
            <MenuItem value="annual">Annual</MenuItem>
          </TextField>
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !form.title || !form.due_date}>
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!fileTarget} onClose={() => setFileTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>File — {fileTarget?.title}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>Upload the evidentiary document (filed return, certificate, receipt) to mark this filed.</Alert>
          <Button component="label" variant="outlined" fullWidth disabled={fileUploading}>
            {fileUploading ? 'Uploading…' : 'Choose file'}
            <input type="file" hidden onChange={handleFile} />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFileTarget(null)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}