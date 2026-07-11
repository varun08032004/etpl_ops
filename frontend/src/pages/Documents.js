import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, IconButton, Tooltip,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import HistoryIcon from '@mui/icons-material/History';
import client from '../api/client';
import StatusChip from '../components/StatusChip';

const DOC_TYPES = ['contract', 'offer_letter', 'nda', 'policy', 'certificate', 'board_resolution', 'invoice_attachment', 'id_proof', 'other'];
const ENTITY_TYPES = ['company', 'employee', 'vendor_customer', 'invoice', 'bill'];

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', doc_type: 'contract', entity_type: 'company', entity_id: '', expiry_date: '' });
  const [file, setFile] = useState(null);
  const [historyDoc, setHistoryDoc] = useState(null);
  const [history, setHistory] = useState([]);

  const load = () => client.get('/documents').then(({ data }) => setDocs(data.documents));
  useEffect(() => { load(); }, []);

  const handleUpload = async () => {
    if (!file) return;
    setSaving(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      Object.entries(form).forEach(([k, v]) => { if (v) formData.append(k, v); });
      await client.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setOpen(false);
      setFile(null);
      setForm({ title: '', doc_type: 'contract', entity_type: 'company', entity_id: '', expiry_date: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (doc) => {
    const { data } = await client.get(`/documents/${doc.id}/download`);
    window.open(data.url, '_blank');
  };

  const openHistory = async (doc) => {
    setHistoryDoc(doc);
    const { data } = await client.get(`/documents/${doc.id}/history`);
    setHistory(data.history);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Documents</Typography>
        <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => setOpen(true)}>Upload document</Button>
      </Box>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Linked to</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Expiry</TableCell>
              <TableCell>Uploaded by</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {docs.map((d) => (
              <TableRow key={d.id} hover>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{d.title}</TableCell>
                <TableCell><StatusChip status={d.doc_type} /></TableCell>
                <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{d.entity_type}{d.entity_id ? ` · ${d.entity_id.slice(0, 8)}` : ''}</TableCell>
                <TableCell className="figure">v{d.version}</TableCell>
                <TableCell className="figure">
                  {d.expiry_date ? (
                    <Typography component="span" sx={{ color: new Date(d.expiry_date) < new Date() ? 'error.main' : 'inherit', fontSize: '0.85rem' }}>
                      {d.expiry_date.slice(0, 10)}
                    </Typography>
                  ) : '—'}
                </TableCell>
                <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{d.uploaded_by_email || '—'}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Download">
                    <IconButton size="small" onClick={() => handleDownload(d)}><DownloadIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Version history">
                    <IconButton size="small" onClick={() => openHistory(d)}><HistoryIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {!docs.length && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No documents yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload document</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title" margin="normal" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField fullWidth select label="Document type" margin="normal" value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })}>
            {DOC_TYPES.map((t) => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}
          </TextField>
          <TextField fullWidth select label="Linked to" margin="normal" value={form.entity_type} onChange={(e) => setForm({ ...form, entity_type: e.target.value })}>
            {ENTITY_TYPES.map((t) => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}
          </TextField>
          {form.entity_type !== 'company' && (
            <TextField fullWidth label={`${form.entity_type} ID (optional — leave blank for general)`} margin="normal" value={form.entity_id} onChange={(e) => setForm({ ...form, entity_id: e.target.value })} />
          )}
          <TextField fullWidth type="date" label="Expiry date (optional)" margin="normal" InputLabelProps={{ shrink: true }} value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />

          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ mt: 2 }}>
            {file ? file.name : 'Choose file'}
            <input type="file" hidden onChange={(e) => setFile(e.target.files[0])} />
          </Button>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpload} disabled={saving || !file || !form.title}>
            {saving ? 'Uploading…' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!historyDoc} onClose={() => setHistoryDoc(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Version history — {historyDoc?.title}</DialogTitle>
        <DialogContent>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>Version</TableCell><TableCell>Uploaded</TableCell><TableCell>File</TableCell><TableCell align="right"></TableCell></TableRow>
            </TableHead>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="figure">v{h.version}{h.is_current ? ' (current)' : ''}</TableCell>
                  <TableCell className="figure">{new Date(h.created_at).toLocaleDateString()}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{h.file_name}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleDownload(h)}><DownloadIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDoc(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}